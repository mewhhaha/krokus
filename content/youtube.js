(() => {
  const { DEFAULT_OPTIONS, getOptions, watchOptions } = globalThis.FrictionSwitch;
  const STYLE_ID = "friction-switch-youtube-style";
  const SHORTS_LINK_SELECTORS = [
    'a[href="/shorts"]',
    'a[href^="/shorts/"]',
    'a[href^="/shorts?"]'
  ];
  const SHORTS_CONTAINER_SELECTORS = [
    "ytd-guide-entry-renderer",
    "ytd-mini-guide-entry-renderer",
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-compact-video-renderer"
  ];
  const SHORTS_ITEM_SELECTORS = [
    ...SHORTS_CONTAINER_SELECTORS,
    "ytd-rich-shelf-renderer",
    "ytd-reel-shelf-renderer",
    "ytd-rich-section-renderer"
  ];
  const HIDDEN_ATTR = "data-friction-switch-hidden";
  const SHORTS_HREF_RE = /\/shorts(?:[/?#]|$)/;
  const SHORTS_TEXT_RE = /^\s*shorts\s*$/i;
  let options = { ...DEFAULT_OPTIONS };
  let observerStarted = false;

  function getShortsId() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] !== "shorts" || !parts[1]) {
      return null;
    }

    return parts[1];
  }

  function redirectShortsPage() {
    if (!options.blockYoutubeShorts) {
      return;
    }

    const shortsId = getShortsId();
    if (!shortsId) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const target = new URL("/watch", window.location.origin);
    target.searchParams.set("v", shortsId);

    for (const [key, value] of params.entries()) {
      if (key !== "v") {
        target.searchParams.set(key, value);
      }
    }

    if (target.href !== window.location.href) {
      window.location.replace(target.href);
    }
  }

  function removeStyle() {
    document.getElementById(STYLE_ID)?.remove();
  }

  function closestShortsContainer(node) {
    if (!(node instanceof Element)) {
      return null;
    }

    return node.closest(SHORTS_ITEM_SELECTORS.join(", "));
  }

  function looksLikeShortsNode(node) {
    if (!(node instanceof Element)) {
      return false;
    }

    const title = node.getAttribute("title");
    const ariaLabel = node.getAttribute("aria-label");
    const text = node.textContent;
    return [title, ariaLabel, text].some((value) => value && SHORTS_TEXT_RE.test(value));
  }

  function hideContainer(container) {
    if (!(container instanceof Element)) {
      return;
    }

    container.setAttribute(HIDDEN_ATTR, "true");
    container.style.setProperty("display", "none", "important");
  }

  function hideShortsContainers() {
    if (!options.hideYoutubeShortsUi) {
      return;
    }

    const shortsLinks = document.querySelectorAll('a[href], [href]');
    for (const link of shortsLinks) {
      const href = link.getAttribute("href");
      if (!href || !SHORTS_HREF_RE.test(href)) {
        continue;
      }

      const container = closestShortsContainer(link);
      if (!container) {
        continue;
      }

      hideContainer(container);
    }

    const guideItems = document.querySelectorAll(
      'ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, a#endpoint, tp-yt-paper-item'
    );

    for (const item of guideItems) {
      if (!looksLikeShortsNode(item)) {
        continue;
      }

      const container =
        closestShortsContainer(item) ||
        item.closest("a#endpoint") ||
        item;
      hideContainer(container);
    }
  }

  function restoreShortsContainers() {
    const hiddenItems = document.querySelectorAll(`[${HIDDEN_ATTR}="true"]`);
    for (const item of hiddenItems) {
      item.removeAttribute(HIDDEN_ATTR);
      item.style.removeProperty("display");
    }
  }

  function ensureStyle() {
    if (!options.hideYoutubeShortsUi || !document.documentElement) {
      removeStyle();
      restoreShortsContainers();
      return;
    }

    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    const containerRules = [];
    for (const containerSelector of SHORTS_CONTAINER_SELECTORS) {
      for (const linkSelector of SHORTS_LINK_SELECTORS) {
        containerRules.push(`${containerSelector}:has(${linkSelector})`);
      }
    }

    style.textContent = `
      ${[
        ...SHORTS_LINK_SELECTORS,
        ...containerRules,
        "ytd-reel-shelf-renderer",
        "ytd-rich-shelf-renderer[is-shorts]",
        "ytd-rich-section-renderer:has(ytd-reel-shelf-renderer)"
      ].join(",\n      ")} {
        display: none !important;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function applyOptions() {
    ensureStyle();
    hideShortsContainers();
    redirectShortsPage();
  }

  function hookNavigation() {
    if (window.__frictionSwitchYoutubeHooked) {
      return;
    }

    window.__frictionSwitchYoutubeHooked = true;

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
    window.addEventListener("yt-navigate-finish", applyOptions, true);
    document.addEventListener("readystatechange", applyOptions, true);
  }

  function startObserver() {
    if (observerStarted) {
      return;
    }

    observerStarted = true;
    const observer = new MutationObserver(() => {
      applyOptions();
    });

    observer.observe(document, {
      childList: true,
      subtree: true
    });
  }

  hookNavigation();
  startObserver();

  getOptions().then((savedOptions) => {
    options = { ...options, ...savedOptions };
    applyOptions();
  });

  watchOptions((updatedOptions) => {
    options = { ...options, ...updatedOptions };
    applyOptions();
  });
})();
