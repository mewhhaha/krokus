(() => {
  const DEFAULT_OPTIONS = Object.freeze({
    blockYoutubeShorts: true,
    hideYoutubeShortsUi: true,
    laggyReddit: false
  });

  async function getOptions() {
    try {
      return await browser.storage.sync.get(DEFAULT_OPTIONS);
    } catch (error) {
      console.error("Friction Switch: failed to read options", error);
      return { ...DEFAULT_OPTIONS };
    }
  }

  function watchOptions(listener) {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }

      const nextOptions = {};
      for (const key of Object.keys(DEFAULT_OPTIONS)) {
        if (changes[key]) {
          nextOptions[key] = changes[key].newValue;
        }
      }

      if (Object.keys(nextOptions).length > 0) {
        listener(nextOptions);
      }
    });
  }

  globalThis.FrictionSwitch = {
    DEFAULT_OPTIONS,
    getOptions,
    watchOptions
  };
})();
