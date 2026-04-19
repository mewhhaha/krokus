# Friction Switch

Firefox extension.

## Clone

```bash
git clone <repo-url> krokus
cd krokus
```

## Build

```bash
bash scripts/build-xpi.sh
```

Creates `dist/friction-switch.xpi`.

## Install Properly In Firefox

Firefox release builds need signed extension for permanent install.

1. Build `dist/friction-switch.xpi`.
2. Sign it through Firefox Add-on Developer Hub / AMO.
3. Install signed `.xpi` in Firefox.

## Dev Only

For temporary local testing:

1. Open `about:debugging`.
2. Pick `This Firefox`.
3. Click `Load Temporary Add-on...`.
4. Choose [`manifest.json`](/home/mewhhaha/src/krokus/manifest.json).
