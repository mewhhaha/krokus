#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
OUTPUT_FILE="$DIST_DIR/friction-switch.xpi"

mkdir -p "$DIST_DIR"
rm -f "$OUTPUT_FILE"

python3 - "$ROOT_DIR" "$OUTPUT_FILE" <<'PY'
import json
import pathlib
import shutil
import sys
import zipfile

root = pathlib.Path(sys.argv[1])
latest_output = pathlib.Path(sys.argv[2])
manifest = json.loads((root / "manifest.json").read_text())
version = manifest["version"]
versioned_output = root / "dist" / f"friction-switch-{version}.xpi"
paths = [
    root / "manifest.json",
    root / "content",
    root / "popup",
    root / "README.md",
]

for output in (latest_output, versioned_output):
    if output.exists():
        output.unlink()

with zipfile.ZipFile(versioned_output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in paths:
        if path.is_dir():
            for child in sorted(path.rglob("*")):
                if child.is_file() and child.name != ".DS_Store":
                    archive.write(child, child.relative_to(root))
        elif path.is_file():
            archive.write(path, path.relative_to(root))

shutil.copyfile(versioned_output, latest_output)
PY

printf 'Built %s\n' "$OUTPUT_FILE"
