# Angry Mantis — frontend

Svelte 5 + PixiJS 8 app on the Stake Engine web-sdk, forked from `apps/ways`.

```bash
# from web-sdk/
pnpm install
./apps/angry_mantis/copy-placeholders.sh         # stand-in art from the ways sample (not tracked in git)
pnpm turbo run build --filter=angry_mantis...    # builds the workspace packages + the app
cd apps/angry_mantis && pnpm dev                 # http://localhost:3007
```

Local play without the real RGS: run `math-sdk/env/bin/python tools/mock_rgs.py` (serves the real books from the math run), then open
`http://localhost:3007/?rgs_url=localhost:8443&sessionID=test&lang=en`.
Replay: add `&replay=true&game=angry_mantis&version=1&mode=BASE&event=<bookId>&amount=1000000`.

## UI / chrome (from the Claude Design project, "Graffiti Grunge" v5.2)
The control bar, stats, bonus-buy, bet picker, menu and Game Info are **HTML** (`src/ui/`), layered over the
Pixi canvas. Both layers are authored in the design masters — 1280×720 landscape, 412×760 portrait — and
scaled uniformly (`src/game/layoutSpec.ts` is the single source of truth for frame geometry, Marty placement
and free-spin HUD slots). The reel frame is pre-rendered from the design CSS (`static/assets/ui/frame-*.png`,
regenerate via the script in the compliance doc history / `make_frames` snippet) and drawn in Pixi under the
symbols; the jungle background is `bg-jungle.webp`. `src/ui/controls.svelte.ts` mirrors the SDK's Pixi buttons
(spin/stop, autoplay, turbo, bonus/ante, bet) so the xstate + RGS flow is untouched.

- Fonts: Outfit (UI/Pixi text) + Sora (numbers) are bundled in `static/assets/fonts/ui` (@font-face in `ChromeStyles.svelte`).
- Pixi-side text (wins, intros, counters) is `components/GameText.svelte` — Pixi `Text` with a gold/silver
  gradient+stroke preset, standing in for the Sigmar bitmap font. No Mining Mayhem assets remain.
- Audio: `tools/build_audiosprite.py` concatenates `assets/audio/**` into `static/assets/audio/sounds.{ogg,m4a,mp3}` +
  `sounds.json` (Howler sprite). Re-run it after adding clips, then extend `src/game/sound.ts`.
- Board lattice: `src/game/boardGrid.ts` snaps/reports symbol drift after every settle; `tools/drift_test.js` spins N rounds
  headlessly and fails if any correction was needed.
- The design's 3-state turbo (off/turbo/instant) maps to the SDK's on/off.

- Boot sequence: Stake Engine loader → `ui/PolyMathIntro.svelte` (design "PolyMath Intro", accent `#9CD92F`) → loading screen.
- `tools/smoke.sh [spins]` starts the mock RGS + dev server if needed and runs the drift test.
- Marty reactions (angry ~1/15 losses, celebrate on big wins, poke on click) are placeholder tweens in `MartyArt.svelte`
  driven by the `martyReact` emitter event — the Spine rig replaces the tween bodies only.

## Where things are
- `src/game/config.ts` — mirrors `math-sdk/games/angry_mantis/game_config.py`
- `src/game/typesBookEvent.ts` + `bookEventHandlerMap.ts` — the event contract (`math-sdk/games/angry_mantis/EVENT_SCHEMA.md`)
- `src/game/betModeMeta.ts` — bonus-buy cards / ante toggle text
- `src/game/gameInfoText.ts` — rules + the verbatim Stake disclaimer shown in `components/GameInfo.svelte`
- `src/components/` — `BonusIntro`, `Mantis` (placeholder for the Spine `MantisRig`), `PoolHud`, `AnteLock`, `RetriggerBanner`,
  `MaxWinCinematic`, `SessionSummary`, `ReplayOverlay`
- `tools/make_placeholders.py` — regenerates the placeholder symbol/character sheets (run with the math-sdk venv)

## Swapping in real art
Symbol states are looked up in `SYMBOL_INFO_MAP` (`src/game/constants.ts`); replace individual entries with `spine` entries as the rigs land
(see `apps/ways` for the Spine pattern). The two mantises should become `MantisRig.svelte` per the design spec §16 (one skeleton, `marty` /
`marky` skins). Background/frame/fonts/sounds are the `ways` stand-ins until the Angry Mantis assets exist (`assets.csv`).
