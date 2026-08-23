#!/usr/bin/env bash
# Copies the stand-in art (background, frame, fonts, big-win, transition, sounds...) from the `ways` sample app.
# Only the Angry Mantis sprite sheets (static/assets/sprites/amSymbols, amCharacters) are tracked in git.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
rsync -a --ignore-existing "$HERE/../ways/static/assets/" "$HERE/static/assets/"
echo "placeholders copied into $HERE/static/assets"
