(() => {
  const { DEFAULT_OPTIONS, getOptions, watchOptions } = globalThis.FrictionSwitch;
  const STYLE_ID = "friction-switch-reddit-style";
  const HEAVY_LAG_PROFILE = [320, 160];
  const BOOT_ATTR = "data-friction-switch-booting";
  const REDDIT_VIEW_ATTR = "data-friction-switch-reddit-view";
  const LAGGY_CLASS = "friction-switch-laggy";
  const MONO_CLASS = "friction-switch-reddit-monochrome";
  const FEED_POST_SELECTOR = [
    "shreddit-ad-post",
    "shreddit-post",
    "article[data-testid=\"post-container\"]",
    "faceplate-tracker[slot=\"content\"]"
  ].join(", ");
  const FEED_AD_SELECTOR = [
    "shreddit-ad-post",
    "shreddit-ad-post:has(shreddit-dynamic-ad-link)",
    "shreddit-post[ad-post]",
    "shreddit-post[post-type=\"promoted\"]",
    "shreddit-post:has(shreddit-dynamic-ad-link)",
    "article[data-testid=\"post-container\"][data-promoted=\"true\"]",
    "article[data-testid=\"post-container\"]:has(shreddit-dynamic-ad-link)",
    "article[data-testid=\"post-container\"]:has([data-testid*=\"promoted\"])",
    "article[data-testid=\"post-container\"]:has([data-click-id=\"promoted_user_content\"])",
    "article[data-testid=\"post-container\"]:has(a[href*=\"promoted\"])",
    "faceplate-tracker[slot=\"content\"]:has([data-testid*=\"promoted\"])"
  ].join(", ");
  const FEED_AD_LABEL_SELECTOR = [
    "[data-testid*=\"promoted\"]",
    "[data-click-id=\"promoted_user_content\"]",
    "[id*=\"promoted\"]",
    "[slot=\"credit-bar\"]",
    "span",
    "a"
  ].join(", ");
  const HIDDEN_FEED_AD_ATTR = "data-friction-switch-hidden-feed-ad";
  const AD_TEXT_RE = /\b(promoted|sponsored|advertisement|ad)\b/i;
  let options = { ...DEFAULT_OPTIONS };
  let lastLagAt = 0;
  let bootTimer = 0;
  let feedObserverStarted = false;
  let listenersAttached = false;
  let navigationHooked = false;

  function busyWait(durationMs) {
    const stopAt = performance.now() + durationMs;
    while (performance.now() < stopAt) {
      // Busy spin on purpose. Feature is sabotage.
    }
  }

  function currentLagMs(multiplier = 1) {
    const [base, jitter] = HEAVY_LAG_PROFILE;
    return Math.round(base * multiplier + Math.random() * jitter);
  }

  function hasActiveRedditEffects() {
    return Boolean(options.laggyReddit || options.monochromeReddit);
  }

  function maybeLag(multiplier = 1) {
    if (!options.laggyReddit) {
      return;
    }

    const now = performance.now();
    if (now - lastLagAt < 200) {
      return;
    }

    lastLagAt = now;
    busyWait(currentLagMs(multiplier));
  }

  function removeStyle() {
    document.getElementById(STYLE_ID)?.remove();
    document.documentElement?.classList.remove(LAGGY_CLASS);
    document.documentElement?.classList.remove(MONO_CLASS);
    document.documentElement?.removeAttribute(BOOT_ATTR);
    document.documentElement?.removeAttribute(REDDIT_VIEW_ATTR);
  }

  function armBootWindow() {
    if (!options.laggyReddit || !document.documentElement) {
      return;
    }

    document.documentElement.setAttribute(BOOT_ATTR, "true");
    window.clearTimeout(bootTimer);
    bootTimer = window.setTimeout(() => {
      document.documentElement?.removeAttribute(BOOT_ATTR);
    }, 180);
  }

  function isPostDetailPage() {
    return /\/comments\//.test(window.location.pathname);
  }

  function syncPageView() {
    if (!document.documentElement) {
      return;
    }

    if (!options.laggyReddit) {
      document.documentElement.removeAttribute(REDDIT_VIEW_ATTR);
      return;
    }

    document.documentElement.setAttribute(
      REDDIT_VIEW_ATTR,
      isPostDetailPage() ? "detail" : "feed"
    );
  }

  function hideFeedAd(container) {
    if (!(container instanceof Element)) {
      return;
    }

    container.setAttribute(HIDDEN_FEED_AD_ATTR, "true");
    container.style.setProperty("display", "none", "important");
  }

  function restoreFeedAds() {
    const hiddenAds = document.querySelectorAll(`[${HIDDEN_FEED_AD_ATTR}="true"]`);
    for (const ad of hiddenAds) {
      ad.removeAttribute(HIDDEN_FEED_AD_ATTR);
      ad.style.removeProperty("display");
    }
  }

  function maybeHideFeedAd(container) {
    if (!(container instanceof Element) || !options.laggyReddit) {
      return;
    }

    if (container.matches(FEED_AD_SELECTOR) || container.querySelector("shreddit-dynamic-ad-link")) {
      hideFeedAd(container);
      return;
    }

    for (const label of container.querySelectorAll(FEED_AD_LABEL_SELECTOR)) {
      const text = label.textContent?.trim();
      if (text && AD_TEXT_RE.test(text)) {
        hideFeedAd(container);
        return;
      }
    }
  }

  function hideFeedAds(root = document) {
    if (!options.laggyReddit || !(root instanceof Document || root instanceof Element)) {
      return;
    }

    if (root instanceof Element && root.matches(FEED_AD_SELECTOR)) {
      hideFeedAd(root);
      return;
    }

    if (root instanceof Element && root.matches(FEED_POST_SELECTOR)) {
      maybeHideFeedAd(root);
    }

    for (const ad of root.querySelectorAll?.(FEED_AD_SELECTOR) || []) {
      hideFeedAd(ad);
    }

    for (const post of root.querySelectorAll?.(FEED_POST_SELECTOR) || []) {
      maybeHideFeedAd(post);
    }
  }

  function ensureStyle() {
    if (!hasActiveRedditEffects() || !document.documentElement) {
      removeStyle();
      restoreFeedAds();
      return;
    }

    document.documentElement.classList.toggle(LAGGY_CLASS, Boolean(options.laggyReddit));
    document.documentElement.classList.toggle(MONO_CLASS, Boolean(options.monochromeReddit));

    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html.${LAGGY_CLASS}[${BOOT_ATTR}="true"] *,
      html.${LAGGY_CLASS}[${BOOT_ATTR}="true"] *::before,
      html.${LAGGY_CLASS}[${BOOT_ATTR}="true"] *::after {
        transition: none !important;
        animation: none !important;
      }

      html.${LAGGY_CLASS}:not(.${MONO_CLASS}) body {
        filter: saturate(0.94) contrast(0.98);
      }

      html.${MONO_CLASS} body {
        filter: grayscale(1) contrast(1.02);
      }

      html.${LAGGY_CLASS}.${MONO_CLASS} body {
        filter: grayscale(1) contrast(1.02);
      }

      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [slot="post-media-container"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [slot="thumbnail"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [slot="expando-media-container"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [data-post-click-location="post-media"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [data-click-id="media"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] [slot="post-media-container"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] [slot="thumbnail"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] [slot="expando-media-container"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] [data-post-click-location="post-media"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] [data-click-id="media"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [data-click-id="image"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [data-click-id="media"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [data-testid="post-image"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [slot="post-media-container"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [slot="thumbnail"],
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [data-testid="post-thumbnail"] {
        background: #000 !important;
        border-color: #111 !important;
        color: transparent !important;
      }

      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [slot="post-media-container"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [slot="thumbnail"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [slot="expando-media-container"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [data-post-click-location="post-media"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [data-click-id="media"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] [data-testid="post-thumbnail"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] [slot="post-media-container"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] [slot="thumbnail"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] [slot="expando-media-container"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [data-testid="post-thumbnail"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [data-testid="post-image"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [slot="post-media-container"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [slot="thumbnail"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [data-click-id="image"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [data-click-id="media"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] recent-posts [data-testid="post-thumbnail"] *,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] recent-posts [data-testid="post-thumbnail"] img,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] recent-posts [data-testid="post-thumbnail"] video,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] recent-posts [data-testid="post-thumbnail"] iframe,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] recent-posts [data-testid="post-thumbnail"] shreddit-player-2 {
        opacity: 0 !important;
      }

      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] recent-posts {
        display: none !important;
      }

      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] community-highlight-carousel {
        display: none !important;
      }

      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] recent-posts [data-testid="post-thumbnail"] {
        background: #000 !important;
        border-color: #111 !important;
      }

      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post:has(shreddit-dynamic-ad-link),
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post,
      html.${LAGGY_CLASS}[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"]:has(shreddit-dynamic-ad-link) {
        display: none !important;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function shouldLagLink(link, event) {
    if (!(link instanceof HTMLAnchorElement) || !options.laggyReddit) {
      return false;
    }

    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return false;
    }

    if (!link.href || link.target === "_blank") {
      return false;
    }

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) {
      return true;
    }

    return `${url.pathname}${url.search}` !== `${window.location.pathname}${window.location.search}`;
  }

  function attachListeners() {
    if (listenersAttached) {
      return;
    }

    listenersAttached = true;

    window.addEventListener("click", (event) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!shouldLagLink(link, event)) {
        return;
      }

      maybeLag(1);
    }, true);
  }

  function startFeedObserver() {
    if (feedObserverStarted) {
      return;
    }

    feedObserverStarted = true;
    const observer = new MutationObserver((mutations) => {
      if (!options.laggyReddit) {
        return;
      }

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            if (options.laggyReddit) {
              armBootWindow();
            }
            hideFeedAds(node);
          }
        }
      }
    });

    observer.observe(document, {
      childList: true,
      subtree: true
    });
  }

  function hookNavigation() {
    if (navigationHooked) {
      return;
    }

    navigationHooked = true;
    const wrapHistoryMethod = (methodName) => {
      const original = history[methodName];
      history[methodName] = function wrappedHistoryMethod(...args) {
        const result = original.apply(this, args);
        queueMicrotask(applyOptions);
        return result;
      };
    };

    wrapHistoryMethod("pushState");
    wrapHistoryMethod("replaceState");

    window.addEventListener("popstate", applyOptions, true);
  }

  function applyOptions() {
    if (options.laggyReddit) {
      armBootWindow();
    }
    ensureStyle();
    syncPageView();
    hideFeedAds();
  }

  attachListeners();
  startFeedObserver();
  hookNavigation();

  getOptions().then((savedOptions) => {
    options = { ...options, ...savedOptions };
    applyOptions();
  });

  watchOptions((updatedOptions) => {
    options = { ...options, ...updatedOptions };
    applyOptions();
  });
})();
