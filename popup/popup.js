(() => {
  const { DEFAULT_OPTIONS } = globalThis.FrictionSwitch;
  const fields = {
    blockYoutubeShorts: document.getElementById("blockYoutubeShorts"),
    hideYoutubeShortsUi: document.getElementById("hideYoutubeShortsUi"),
    laggyReddit: document.getElementById("laggyReddit")
  };

  function render(options) {
    fields.blockYoutubeShorts.checked = Boolean(options.blockYoutubeShorts);
    fields.hideYoutubeShortsUi.checked = Boolean(options.hideYoutubeShortsUi);
    fields.laggyReddit.checked = Boolean(options.laggyReddit);
  }

  function currentOptions() {
    return {
      blockYoutubeShorts: fields.blockYoutubeShorts.checked,
      hideYoutubeShortsUi: fields.hideYoutubeShortsUi.checked,
      laggyReddit: fields.laggyReddit.checked
    };
  }

  async function load() {
    const savedOptions = await browser.storage.sync.get(DEFAULT_OPTIONS);
    render(savedOptions);
  }

  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const nextOptions = currentOptions();
    await browser.storage.sync.set(nextOptions);
    render(nextOptions);
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }

    const updated = { ...currentOptions() };
    for (const key of Object.keys(DEFAULT_OPTIONS)) {
      if (changes[key]) {
        updated[key] = changes[key].newValue;
      }
    }
    render(updated);
  });

  load();
})();
