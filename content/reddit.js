(() => {
  const { DEFAULT_OPTIONS, getOptions, watchOptions } = globalThis.FrictionSwitch;
  const STYLE_ID = "friction-switch-reddit-style";
  const HEAVY_LAG_PROFILE = [320, 160];
  const REDDIT_VIEW_ATTR = "data-friction-switch-reddit-view";
  const REVEAL_ATTR = "data-friction-switch-reveal";
  const PENDING_REVEAL_ATTR = "data-friction-switch-pending";
  const COMMENT_SELECTOR = [
    "shreddit-comment",
    "[data-testid=\"comment\"]",
    "[thingid^=\"t1_\"]",
    "faceplate-comment",
    "article[data-testid*=\"comment\"]"
  ].join(", ");
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
  let listenersAttached = false;
  let revealObserverStarted = false;
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
    document.documentElement?.classList.remove("friction-switch-laggy");
    document.documentElement?.removeAttribute(REDDIT_VIEW_ATTR);
  }

  function revealDelayMs(kind) {
    if (kind === "comment") {
      return 2200 + Math.round(Math.random() * 1800);
    }

    return 1400 + Math.round(Math.random() * 1800);
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

  function isCommentNode(node) {
    return node instanceof Element && node.matches(COMMENT_SELECTOR);
  }

  function markDelayed(node, kind) {
    if (!(node instanceof Element) || !options.laggyReddit) {
      return;
    }

    if (node.hasAttribute(PENDING_REVEAL_ATTR) || node.getAttribute(REVEAL_ATTR) === "done") {
      return;
    }

    node.setAttribute(PENDING_REVEAL_ATTR, kind);
    node.setAttribute(REVEAL_ATTR, kind);

    window.setTimeout(() => {
      node.removeAttribute(PENDING_REVEAL_ATTR);
      if (options.laggyReddit) {
        node.setAttribute(REVEAL_ATTR, "done");
      } else {
        node.removeAttribute(REVEAL_ATTR);
      }
    }, revealDelayMs(kind));
  }

  function queueSlowReveals(root = document) {
    if (!options.laggyReddit || !(root instanceof Document || root instanceof Element)) {
      return;
    }

    if (root instanceof Element) {
      if (isCommentNode(root)) {
        markDelayed(root, "comment");
      }
    }

    for (const comment of root.querySelectorAll?.(COMMENT_SELECTOR) || []) {
      markDelayed(comment, "comment");
    }
  }

  function restoreDelayedNodes() {
    const delayedNodes = document.querySelectorAll(
      `[${REVEAL_ATTR}], [${PENDING_REVEAL_ATTR}]`
    );
    for (const node of delayedNodes) {
      node.removeAttribute(REVEAL_ATTR);
      node.removeAttribute(PENDING_REVEAL_ATTR);
    }
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
    if (!options.laggyReddit || !document.documentElement) {
      removeStyle();
      restoreDelayedNodes();
      restoreFeedAds();
      return;
    }

    document.documentElement.classList.add("friction-switch-laggy");

    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html.friction-switch-laggy * {
        transition-duration: 1200ms !important;
        animation-duration: 2200ms !important;
      }

      html.friction-switch-laggy body {
        filter: saturate(0.94) contrast(0.98);
      }

      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [slot="post-media-container"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [slot="thumbnail"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [slot="expando-media-container"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [data-post-click-location="post-media"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-post [data-click-id="media"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-post img,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-post video,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-post shreddit-player-2,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-post gallery-carousel,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-post shreddit-gallery-carousel,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-post iframe,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post [slot="post-media-container"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post [slot="thumbnail"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post [slot="expando-media-container"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post [data-post-click-location="post-media"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post [data-click-id="media"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post img,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post video,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post shreddit-player-2,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post gallery-carousel,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post shreddit-gallery-carousel,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post iframe,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] [slot="post-media-container"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] [slot="thumbnail"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] [slot="expando-media-container"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] [data-post-click-location="post-media"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] [data-click-id="media"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-ad-post:has(shreddit-dynamic-ad-link),
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] gallery-carousel,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] shreddit-gallery-carousel,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] shreddit-player-2,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] video,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] faceplate-tracker[slot="content"] iframe,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [data-click-id="image"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [data-click-id="media"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [data-testid="post-image"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [slot="post-media-container"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [slot="thumbnail"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] img,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] video,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] shreddit-player-2,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] gallery-carousel,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] shreddit-gallery-carousel,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] iframe,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"]:has(shreddit-dynamic-ad-link) {
        display: none !important;
      }

      html.friction-switch-laggy [${REVEAL_ATTR}="comment"] {
        opacity: 0.001 !important;
        filter: blur(16px) saturate(0.65) !important;
      }

      html.friction-switch-laggy [${PENDING_REVEAL_ATTR}="comment"] {
        pointer-events: none !important;
      }

      html.friction-switch-laggy [${REVEAL_ATTR}="done"] {
        opacity: 1 !important;
        filter: none !important;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function attachListeners() {
    if (listenersAttached) {
      return;
    }

    listenersAttached = true;

    window.addEventListener("pointerdown", () => {
      maybeLag(1);
    }, true);

    window.addEventListener("keydown", () => {
      maybeLag(0.7);
    }, true);

    window.addEventListener("wheel", () => {
      maybeLag(0.45);
    }, {
      capture: true,
      passive: true
    });

    window.addEventListener("scroll", () => {
      maybeLag(0.35);
    }, true);
  }

  function startRevealObserver() {
    if (revealObserverStarted) {
      return;
    }

    revealObserverStarted = true;
    const observer = new MutationObserver((mutations) => {
      if (!options.laggyReddit) {
        return;
      }

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            queueSlowReveals(node);
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
    ensureStyle();
    syncPageView();
    queueSlowReveals();
    hideFeedAds();
  }

  attachListeners();
  startRevealObserver();
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
