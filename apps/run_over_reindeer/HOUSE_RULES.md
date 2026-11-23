# Run Over Reindeer house rules

Read before touching rendering, layout, the HUD, the road or win presentation in `web-sdk/apps/run_over_reindeer`.
The current tree is `web-sdk-wt-symtap` (branch `wip/stage`). The cross-game traps are in the `slot-house-rules`
skill (R1 to R10, S1 to S5, L1 to L6, G1 to G3, measuring); this file holds this game's numbers and files. Every
number below was read from the code on 2026-11-21; paths are under `src/` unless they start with `tools/` (the app's
own `tools/`) or `docs/`.

A 5 x 4, 12 line slot drawn as a sideways four lane road, forked from Manticore Mayhem on 2026-11-09. The house HUD,
splash, landing screen, sound plumbing, layout system and dev hook came from Manticore. Outcomes only come from book
events (`game/bookEventHandlerMap.ts`). Every decision taken is one line in `docs/FIRST_PASS_DECISIONS.md`,
`docs/SECOND_PASS_DECISIONS.md` and `docs/THIRD_PASS_DECISIONS.md`.

## Run it

- `pnpm dev` on port 3014 (`package.json`), open `http://localhost:3014/?lang=en&sessionID=<sid>`. With no `rgs_url`
  the dev server plays the fixture rounds in the page (`fixtures/fixtureRgs.ts`, 24 named rounds over 21 real books).
- Force a round: `__reindeer.fixtures.next('<name>', sticky)`; leave one open to test a resume:
  `__reindeer.fixtures.resume(name, eventIndex)`. A named `rgs_url` (mock RGS on a free port) switches fixtures off.
- Ports 3007 / 3008 / 3013 and 8443 / 8444 belong to the other games.

## Resolution, device tiers and GPU memory (rules R3, R7)

- House rule (Corey 2026-11-21): prefer 3 physical px per CSS px whenever possible, on desktop and phone. Phones are
  at 3 today; desktop is 2, and raising it needs a proposal and a Decimus proof, never a builder's own change.
  Never lower quality or frame rate to save memory.
- Same code as Manticore: `RENDER_RESOLUTION_CAP = { phone: 3, desktop: 2, phone3x: 3 }`, both allowlists `on: false`,
  `RENDER_MAX_PIXELS = 8_300_000`, `RENDER_RESIZE = { settleMs: 250, band: 0.04 }` (`game/constants.ts` lines 2391 to
  2396). `PHONE_TIER` = coarse pointer and short side 500 CSS px or less (`game/deviceTier.ts` line 44).
  `?rescap=` and `?perf=1` are DEV or staging only (`game/staging.ts`, `scripts/check-production-bundle.mjs`).
- GPU warm-up, a Reindeer-only rule for now (coordinator resolution 2026-11-21; not a cross-game rule, Manticore owes
  no check) (`game/gpuWarm.ts`): every stage texture goes to the GPU while the player is on the press screen, through
  the game's OWN queue (`GPU_WARM.perFrame 1`, `afterSeatMs 200`), skipping sources already resident, destroyed or let
  go. Never `renderer.prepare.upload(stage)`: Pixi 8.8.1's prepare queue still uploads a source destroyed while queued
  (the upright phone's Pixi error in the roam build) or unloaded on purpose, and it also iterates Graphics contexts
  destroyed meanwhile. The texture GC idle limit is raised to `GPU_WARM.gcMaxIdle` (about 30 min) when the renderer starts
  (`components/Game.svelte` line 104), so a texture sent up during a long press-screen wait is not unloaded and re-sent.
- Column character clips (`game/road/columnClips.ts`): fetched as the book arrives, uploaded one sheet at a time
  (`COLUMN.upload = { gapMs: 120, quietMaxMs: 1200 }`, kept out of impact frames), a clip shown only once all its sheets
  are up; a column stands as its box and number if its pictures are more than `COLUMN.loadWaitMs` 4,000 ms late
  (constants lines 633 to 637). Phones keep the 0.7 sheets by default (`docs/THIRD_PASS_DECISIONS.md` section 5).
  `__reindeer.clipMemory()` lists the clips loaded and their GPU MB.
- Mipmaps (`game/mipmaps.ts` lines 11 to 26): WebGL1 cannot mipmap non-power-of-two sheets; they are skipped there.

## Layout

- Masters as in every game (`game/layoutSpec.ts` lines 16 to 20). The board is ONE picture in "road px" (the
  1536 x 1024 background, measured into `game/roadArtSpec.ts` by `tools/build_assets.py`); each layout only sets its
  width and center (`ROAD_LAYOUT`, line 82):
  - landscape width 982, center (640, 379.3); the bottom lane line stays on y 596, clear of the HUD row (top 610);
  - phone width 983, center (740, 368), standing between the HUD's two 340-unit side columns (`PHONE_SIDE_COLUMN`);
  - portrait spans the screen width (max 560), in the band from 150 to the HUD (622), `bandShare 0.47`, then lowered
    halfway toward `hudClear 24` (Corey 2026-11-15).
- There is no HUD table in `layoutSpec.ts`. The HUD is Manticore's glass dock copied file for file (`ui/hud/`), themed
  "Frost" (`ui/hudTheme.ts`; read `ui/HUD_THEME.md` for what differs from Manticore). Placement is
  `ui/hud/hudLayout.ts` (mock px, four variants); `portraitBoardBottoms` (line 112) answers the road's `boardRect` in
  the place Manticore's plaque took. `components/HudBeds.svelte` draws the dark canvas beds under the pale glass.
- THE GAME BAR IN USE is one constant, `HUD_BAR` in `ui/hudTheme.ts` (2026-11-22): `'sign'` is the road sign bar
  (`ui/sign/`: the diamond Play with its LED border, sign keys, the Fast Lane hexagon, bare bet symbols, plate
  headers, a Win box shown only on a win and through free spins); `'dock'` is the glass dock above, kept whole for a
  rollback. The sign bar's places are `ui/sign/signLayout.ts` (Corey's own windows and the rule between them;
  `tools/sign_layout_test.mjs`), its colors and drawing numbers `SIGN` in `ui/hudTheme.ts`, its lights one 2D canvas
  per key (`ui/sign/ledBand.ts`: capped at 30 frames a second, paused in a hidden tab). The board and the LED strip
  are still placed by the dock's rules (`hudLayout.ts`): they did not move with the bar. With the sign bar the
  desktop strip is taller at 16:9 (`DESKTOP.stripH`) and the upright SKIP button stands on Menu's row, to Menu's left (`skipBox`). On phones Balance and the amount are
  1.35 of the size he set (`BOOST`, Corey 2026-11-22: "very small"); the bar is laid out from `PHONE_PLACES`.
  A sign key takes presses as its drawn diamond; where that holds under 44 px an unseen press pad lies under every
  control, an exact outline 2 px from every other press region (`padPlaces`, `padShapes`). EVERY click a control
  of the sign bar gets is judged by where the pointer went down, by the drawn shapes (`pressOwner`, `pressVerdict`,
  `SignHud.svelte` barPress, 2026-11-23): a browser hands a touch to a nearby button by the buttons' upright boxes
  and paint order, and the diamonds' boxes overlap (a tap on Turbo's edge started a round). A round starts only from
  a press that went down inside the Play's own diamond. A new control on this bar goes through barPress.
- Active highlights use this game's own "Frost" accent (`accent-rgb` in `ui/hudTheme.ts`), never Manticore's gold
  (rule L6).
- CSS `filter` in the HTML chrome, allowed as shipped (rule R2): only the `.slot-btn` hover and press lift
  (`ui/ChromeStyles.svelte` lines 124 and 127). The glass dock (`ui/hud/hud.css`, `ui/hud/HudStyles.svelte`) uses none.
  No masks or Pixi filters exist in this app (rule R9).
- Touch (rule L4): drawn portrait keys from 34 px (`ROW6`, `hudLayout.ts` line 63), hit area grown to 44 CSS px by
  `.hit::after` (`ui/hud/hud.css` lines 77 to 83).
- `game/scoreboard/layout.ts` reads the window on every layout pass (line 4, rule L3).
- Scenes: Snow or Dark (`ui/hud/SceneSwitch.svelte`, `game/sceneChoice.ts`); a choice applies when the board is at rest.

## Road motion (rules G1, G2)

- The road runs on its OWN clock (`game/stateGame.svelte.ts` line 100). `ROAD_MOTION` (constants line 917): turbo 1
  `rate 1.7`, turbo 2 `rate 2.6`, a slam stop `hurryRate 3`, never above `maxRate 6`. `motionFor(level)` lays the
  turbo overrides over the base set. `__reindeer.clock(rate)` slows or freezes it for frame-by-frame checks.
- `LANE_FLOW` (line 963): lanes 100 ms apart, cars 70 ms, `driveInMs 680`, brake 270 ms; the scatter tease holds the
  tunnels 360 ms after two seen and 390 ms after three; press to rest never over `capMs 6500` at normal speed. The
  road knows the scatter count from the book; the tease follows the scatters as the player sees them (`seenMs 110`
  after a car leaves its tunnel), and a car already on the road never slows.
- Stoplights (`STOPLIGHT`, line 64): Corey's ruling of 2026-11-09 is quoted in the comment; red leads the stop, never
  after it.
- Every tunable is in `TUNE` (line 2230), live as `__reindeer.tune`; `__reindeer.tuneJson()` prints it to paste back.

## Win presentation

- Line wins: `LINE_WIN` (line 1000): lead in 120 ms, all lines shown together for 1300 ms, `holdShare [1, 0.6, 0.35]`
  by turbo, symbols pulse to 1.12 twice, others dim to 0.38. The amounts are Pixi Text set once per win
  (`game/road/roadBoard.ts` line 1035, `game/road/winLights.ts` line 1288), never per frame (rule R1).
- The bonus Total Win counts on the LED scoreboard (`game/scoreboard/`); the HUD's WIN readout rolls as an odometer
  meanwhile (`ui/hud/winOdometer.ts`, 2026-11-21; `tools/win_odometer_test.mjs`).
- LED pictures are made once and cached (glyphs, title masks, art bakes, currency sign dots). Two rules since
  2026-11-22 (rule R7; the Total Win card's first frame was 400 ms on an upright phone at device scale 3, 1.8 s at 4x):
  a size search asks widths only (`scoreboardDraw.ts` `advOf`, `ledSigns.ts` `signAdv`), never a glyph drawn per cap tried;
  and a bonus card the book holds is drawn ahead on a scratch face (`LED_BOARD.warm`, `scoreboard.ts` `prepare` and
  `warmStep`, `warmGate.ts`: 3 ms a frame, the entry from the trigger spin's reveal, the Total Win from the first free spin),
  so its first frame draws from the caches. A new picture maker calls `warmGate()` first, before it touches a shared
  canvas or a cache. `tools/led_warm_check.mjs` proves the cards dot for dot the same either way;
  `led_board_probe.mjs` section `hitch` (`__reindeer.cardFrames`) measures the frames round each card.
- Not built yet (README): win tiers and the big-win count-up, the max win scene. When they land they follow the
  recipe's house pacing and max win standard.

## Dev hook and probes

- `window.__reindeer` (DEV only; `components/Board.svelte` line 993 and the systems that extend it): `atRest()`,
  `board()`, `gameType()`, `boardLayout()`, `road()`, `setBoard()`, `signal(color)`, `step(ms, n)`, `clipMemory()`,
  `fixtures.*`, `tune`, `gpuWarm`. The README's table is the full list.
- Probes live in this app, `tools/*_probe.mjs` (30 today), inside the web-sdk repo. `node tools/probe_impact.mjs
  --game reindeer` (parent repo) names the ones a change touches. Decimus runs them; builders never run a browser on
  the Mac.
- Art builders: `tools/build_assets.py`, `tools/build_columns.py` and the other `tools/build_*.py` (math env Python, run
  with `nice -n 19`); they only read the sources.
