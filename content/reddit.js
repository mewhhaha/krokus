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

  function ensureStyle() {
    if (!options.laggyReddit || !document.documentElement) {
      removeStyle();
      restoreDelayedNodes();
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
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-post img,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] shreddit-post video,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [data-click-id="image"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] [data-testid="post-image"],
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] img,
      html.friction-switch-laggy[${REDDIT_VIEW_ATTR}="feed"] article[data-testid="post-container"] video {
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
