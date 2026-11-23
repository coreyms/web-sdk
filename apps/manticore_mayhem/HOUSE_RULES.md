# Manticore Mayhem house rules

Read before touching rendering, layout, the HUD, win presentation or the board in `web-sdk/apps/manticore_mayhem`
(current in the main `web-sdk` tree, branch `angry-mantis`). The cross-game traps are in the `slot-house-rules` skill
(R1 to R10, S1 to S5, L1 to L6, G1 to G3, measuring); this file holds this game's numbers and files. Every number
below was read from the code on 2026-11-21; paths are under `src/` unless they start with `tools/`.

An 8 x 8 cluster-drop board with doubling multiplier tiles, forked from Angry Mantis on 2026-09-22. Outcomes only come
from book events (`game/bookEventHandlerMap.ts`); `game/stateGame.svelte.ts` is the board engine (64 cells, one rAF
loop, every move book driven).

## Run it

- `pnpm dev` on port 3008 (`package.json`); mock RGS
  `math-sdk/env/bin/python tools/mock_rgs.py --game manticore_mayhem --port 8444`, then
  `http://localhost:3008/?rgs_url=localhost:8444&sessionID=<sid>&lang=en`. Accept the cert once at
  `https://localhost:8444/fair/state`.
- Force: `curl -sk "https://localhost:8444/debug/force?criteria=<criteria>&session=<sid>"` (or `criteria=book:<id>`).
- Ports 3007 / 8443 are Angry Mantis's, 3014 is Reindeer's.

## Resolution and device tiers (rule R3)

- House rule (Corey 2026-11-21): prefer 3 physical px per CSS px whenever possible, on desktop and phone. Phones are
  at 3 today; desktop is 2, and raising it needs a proposal and a Decimus proof, never a builder's own change.
  Never lower quality or frame rate to save memory.
- `RENDER_RESOLUTION_CAP = { phone: 3, desktop: 2, phone3x: 3 }` (`game/constants.ts` line 220). The renderer is
  `min(devicePixelRatio, cap)`, so a DPR 2 phone draws at 2 and a DPR 3 phone at 3. History in the comment above it:
  1.5 everywhere until 2026-10-09; desktop 2 (Corey 2026-10-09); every phone 3 (Corey 2026-10-17 12:30, "Yes let's
  raise it to 3x for all phones", after 9.4 minutes on his Samsung A13 at a steady 16.6 ms).
- `PHONE_2X_ALLOW` and `PHONE_3X_ALLOW` are `on: false` since 2026-10-17 (lines 229, 239), kept for the rollback
  (`phone: 1.5` and both lists on restores the 2026-10-14 rule). `docs/device-quality-plan-v3.md` section 0
  (2026-11-21) records the current rule; its older allowlist sections are marked superseded.
- Off the phone tier, `RENDER_MAX_PIXELS = 8_300_000` (a 4K canvas; line 249) also caps the resolution, recomputed on
  resize only after `RENDER_RESIZE.settleMs` with a hysteresis band (`components/Game.svelte` lines 130 to 170).
- `PHONE_TIER` (`game/deviceTier.ts` line 44): coarse pointer AND short screen side 500 CSS px or less, read once at
  module load. It picks the half-resolution phone sheets; it never changes the renderer cap.
- `?rescap=<n>` (DEV or `PUBLIC_STAGING=1` builds) and `?perf=1` (`staging/perfMeter.ts`) never reach Stake
  (`scripts/check-production-bundle.mjs`).

## Layout

- Masters as in every game (`game/layoutSpec.ts` lines 16 to 20). The board is SQUARE; landscape and phone keep a
  column clear on the RIGHT for the manticore: `MANTICORE` (line 169) landscape x 1080 y 380 size 430, phone x 1300 y 390
  size 380, portrait hidden. Phone sideways keeps `PHONE_SIDE_COLUMN = 340` master units clear at each end (line 316).
- The HTML HUD is the glass dock (round 5 "Drop 6", approved 2026-11-12; portrait row round 6 "Row of Seven",
  2026-11-13). Placement is `ui/hud/hudLayout.ts`, in "mock px" from the mock stills (portrait 390 x 844, landscape
  phone 844 x 390, tablet 1180 x 820, desktop 1440 x 810, wide 1920 x 810), scaled by `u` from the chrome's fit
  (`MOCK_K`, line 28). FOUR variants: desktop, tablet, portrait, landscape. A different board or creature placement is
  re-measured there, never in a component.
- `layoutSpec.HUD` (line 439) now holds only the Pixi-side overlay slots: `pressToContinue`, `modePlaque`, `spinWin`.
- THE GEAR BAR (2026-11-22, `ui/gear/`): desktop and laptop windows draw the approved gear layout in place of the dock
  (Play as a gear by the frame's top right wheel, Auto and Turbo meshed on it, Menu and the Armoury as war standards
  under the logo). One typed file holds its tables and its rule, `ui/gear/gearLayout.ts`: `DESKTOP` (Corey's places at
  1920 x 1080), `desktopLayout()` (every other desktop window), empty `sideways` and `upright` phone tables, and
  `barKind()`, the one switch. Phones, tablets and Stake's two popouts keep the dock until their tables are filled.
  Rollback: `GAME_BAR = 'dock'`. On the dev server `?bar=dock` or `?bar=gear` picks a bar for a probe run. It is a
  re-skin: `HudSpin`, `HudReadout`, `HudStep` and `HudMenuPanel` are reused over the same `controls`. The gears turn
  from the frame's own haul (`game/frameGears.ts`, called from `components/BoardFrame.svelte`'s tick) by a CSS rotate
  on five layers, and the hub ring's color is drawn on the frame's two top wheels as plain sprites. Dev hook:
  `__manticore.gearBar()`, `__manticore.frame.wheelRings`. Node test: `tools/gear_layout_test.mjs`.
- THE UPRIGHT PHONE'S GEAR TRAIN (2026-11-22, `ui/gear/GearBarUpright.svelte`): phones from 360 px wide draw Corey's
  train under the plaque (Play on the center line; Turbo on its right; Auto, Menu and the Armoury as a chain on its
  left; icons only). `gearLayout.ts` `UPRIGHT` is his setup at 402 x 874 and `uprightLayout()` the one rule for every
  other phone window (the scale, the chain's angles, where each readout goes, the bottom safe area); its comment lists
  every move from his places. A window where nothing fits (320 x 568, 390 x 620, 360 x 740) keeps the dock, and so do
  tablets. The readouts are real text: a 9 px word over a 15 px number.
- THE SIDEWAYS PHONE'S GEAR CHAIN (2026-11-22, `ui/gear/GearBarSideways.svelte`): a chain from the board frame's own
  top right wheel: Auto on the wheel, Turbo on Auto, the Play on Turbo at the right; Menu and the Armoury as standards
  under the logo; Win over Balance bottom left; the amount with `<` `>` bottom right. `gearLayout.ts` `SIDEWAYS` is
  Corey's own placing at 874 x 402 and `sidewaysLayout()` the one rule (his chain scaled with the board wherever it
  fits; other bends, then a smaller Play, where it does not; `SKYLINE` is the Manticore's top edge, and the Play may
  reach under it only as far as his own placing does). The HTML gears are phased to the wheel (`WHEEL_REST`). With
  this bar the studio name of the top line is drawn under the clock line at the left (`ui/ChromePhone.svelte`): the
  Play gear stands where it was. Under 640 x 340, and where no chain fits, the dock stays. Desktop popouts keep the dock.
- The look is one theme block, `ui/hudTheme.ts` (tokens injected as `--hud-*`); read `ui/HUD_THEME.md` before restyling.
  `.am-glass` (`ui/ChromeStyles.svelte`) is the panel frame every HUD modal shares; the riveted bronze plate is
  `.am-plate`. Active highlights use this game's accent (gold, `accent-rgb` in `ui/hudTheme.ts`), rule L6.
- CSS `filter` in the HTML chrome, allowed as shipped (rule R2): the `.slot-btn` hover and press lift
  (`ui/ChromeStyles.svelte` lines 128 and 131) and the logo drop shadow (`ui/ChromeLandscape.svelte` line 105,
  `ui/ChromePortrait.svelte` line 118, `ui/ChromePhone.svelte` line 110, `ui/LandingScreen.svelte` line 830). The
  glass dock (`ui/hud/hud.css`) uses none.
- Touch (rule L4): drawn portrait keys are 34 px on a phone (`ROW6`, `hudLayout.ts` line 59; `kA` 36 on a tall
  phone); the hit area is grown to `--hit` 44 CSS px by `.hit::after` (`ui/hud/hud.css` lines 76 to 84).
- The Autoplay sheet must not scroll except in Stake's Popout S band (`ui/AutoplayModal.svelte` lines 36 to 42).

## Board motion (rules G1, G2)

- `GRID = 8`, `SYMBOL_SIZE = 110` board units, `CELL_FILL = 0.94`, `SYMBOL_FIT = 0.86` (constants lines 139 to 154;
  the fit is solved by `tools/build_board_layers.py`).
- Turbo: `TURBO_SCALE = [1, 2.2, 4]` (line 296), a divisor on every authored time. Manticore-local: the shared
  `stateBet.timeScale()` is a 1 / 2 switch that only frozen Angry Mantis reads. `SLAM_HURRY = true` (line 301): a Spin
  press or board tap during a spin runs the rest at the fastest allowed level.
- `DROP` (line 304): gravity `gravityMs 185.6 x sqrt(cells)` (8 cells = 525 ms), `columnStaggerMs 67`,
  `rowStaggerMs 36`, easing `quartIn`, bottom row lands first, no y-bounce; `GRAVITY_DROP` squash on contact.
- `BOARD_EXIT` (line 348): the old board falls off the bottom on the press, before the book arrives (60 ms between
  columns, 255 ms `quadIn` fall); `stateGame.exitGate()` keeps the new drop out of a column until it is empty.
- `TIMINGS` (line 2220): scatter stagger 110 ms, flash 180, spin settle 240, plaque in / hold / out 320 / 1400 / 300.

## Win presentation

- Tiers in base-bet multiples, every ladder in one block (`game/winLevelMap.ts`, "THE STINGER LADDERS", Corey
  2026-11-21): a base game spin (Ante and Super Ante included) Big 25x, Super 100x, Mega 400x, Epic 1,500x, Max
  10,000x (`WIN_TIER_STAGES`); a free spin's own win, every feature, NO Big: Super 200x (its plaque opens on SUPER;
  Super is 100x in the base game and 200x in a feature on purpose, Corey "take yours"),
  Mega 400x, Epic 1,500x, Max 10,000x (`WIN_TIER_STAGES_FEATURE_SPIN`). The end of feature TOTAL WIN's tier is the
  book's level; `WIN_TIER_STAGES_END_FEATURE` (50 / 100 / 400 / 1,500 / 10,000x) only paces its count.
  Node test: `tools/stinger_tiers_test.mjs`.
- The plaque is `components/StingerPlaque.svelte` with data in `game/stinger/`. Its motion runs in REAL time at every
  turbo level; turbo shortens the COUNT only (constants lines 2234 to 2238). House count-up pacing and the "number
  slides when a digit is added" rule are in the recipe (section 1); this game is the first to use the slide.
- Text: `components/GameText.svelte` (blurred drop shadow, as in Angry Mantis), `components/CountUpText.svelte`,
  `components/TextWarmup.svelte` (rules R1 and R7). Glyph amounts: `game/numeralLayout.ts`, `game/plaqueNumeralGlyphs.ts`.
- Max win scene: `components/MaxWinCinematic.svelte`, `game/maxWin.svelte.ts`, `game/medallionRain.ts`.

## Big art and memory (rule R7)

- The creature's big sheets are decoded in a same-origin module worker (`game/creatureDecode.worker.ts`) and uploaded
  in strips (`game/stripUpload.ts`): `CREATURE.upload = { on: true, gapMs: 300, pollMs: 100, strips: 'all', bands: 8 }`
  (constants line 3809). Measured Safari worst frame 42 to 44 ms, Chrome 18 ms.
- Raw Pixi layers (flames, sky, scene) join the stage through `getContextParent().addToParent(...)`; their headers state
  the house rules they keep (no filters, no texture created after the files land: `game/flames.ts` line 17,
  `game/scene.ts` line 45, `game/sky.ts` line 41).
- Masks (rule R9): two exist and no others may be added: the fall layer's (`components/BoardCells.svelte` line 116)
  and the searchlight's column mask (`components/Anticipation.svelte` line 107).

## Dev hook and probes

- `window.__manticore` (`components/Board.svelte` line 89): `atRest()`, `idle()` (wait for BOTH: atRest is true between
  the press and the first reveal), `gameType()`, `bonusMode()`, `board()` (board[reel][row]), plus per-system objects
  (`creature`, `flames`, `stinger`, `plaque`, `sky`, `fx` and more).
- Probes live in the parent repo, `tools/manticore/*_probe.js` (57 today). `node tools/probe_impact.mjs --game
  manticore` names the ones a change touches. Decimus runs them; builders never run a browser on the Mac.
