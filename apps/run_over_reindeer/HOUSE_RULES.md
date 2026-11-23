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

## Asset addresses (the build check)

- A built game is served from a subfolder (Stake, staging previews), so no address may climb out of the game's folder
  or start at the site's root. In a build `import.meta.url` is `<game>/_app/immutable/bundle.<hash>.js`: two `../`
  reach the game's folder, three leave it (`new URL('../../../assets/...', import.meta.url)` from a source file three
  folders deep is right on the dev server and a 404 in a build: the sister game's fault of 2026-11-23). Address an
  asset as `stamp(new URL('../../assets/...', import.meta.url).href)` from a file two folders deep (`game/assets.ts`
  holds nearly all of them), or `stamp('/assets/...')` from anywhere (`stamp` takes the leading slash off: relative
  to the page). Never a bare `/assets/...`.
- `scripts/check-production-bundle.mjs` fails on any such address, read from the BUILD (`scripts/build-addresses.mjs`:
  every `new URL(..., import.meta.url)`, stamped path, stamp table key, page link, stylesheet `url()`, JSON data file
  name, written-out fetch / import / worker call; 661 addresses today), and on one whose file is not in the build.
  `node tools/build_addresses_test.mjs` (after a build) is the node test: the sweep, and the guard held against
  planted faults.

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
  desktop strip is taller at 16:9 (`DESKTOP.stripH`) and the upright SKIP button stands on Menu's row, to Menu's left (`skipBox`). 
  PHONES ARE COREY'S ROUND 3 LAYOUT (2026-11-23): seven windows he laid out at the real sizes a phone browser gives the
  game (`PHONE_R3`: 440x742, 413x586, 375x530, 626x816 upright; 832x376, 667x311 sideways; `LAND_R3`: 890x552, the
  phablet held sideways, on the desktop bar by its width, `landShare`). The bar is laid out from `PHONE_PLACES` (round
  3 only; round 2's tables stay in the file as his record, `PHONE_R2`, and are not blended in: round 3 swaps the rows,
  Auto and Turbo beside the Spin, and a blend of the two drew them through each other). Exact at his windows, blended
  between them, and outside them the nearest window by SHAPE first (a tall phone takes 440x742's places at its own
  scale). His scene moves ride the same blend (`sceneFit`): the board with its LED strip as one piece (`boardDy`,
  through `layoutSpec.ts` `roadPlacement`; the strip keeps its size), the tree line (`treeDy`), his logo box and his
  SKIP box, which fade out with distance from his windows (`SCENE_REACH`), so a tall full screen phone and a tablet
  keep the scene's own rules. A tree line is drawn on upright windows up to his phablet's width (`forestOn`).
  ONE NUMBER SIZE: Balance, the amount and Win are the same size at a window, the largest all three of his boxes
  hold, and their tags one size (`commonType`, Corey: "Ideally those all stay about the same size"); a longer amount
  steps down on its own. His bet symbols stay where he put them (`amtHalf`).
  THE ROAMING REINDEER'S GROUND follows by construction and is written down in `game/roamGround.ts`: his area is in
  road px (it rides with the board), the tree line is the drawn forest's (`game/scene/forestPlace.ts`), every key
  is a keep-out. UNDER THE SIGN (Corey 2026-11-24: "Let him pass under the sign"): the Fast Lane and Menu signs
  are roam zones named `sign` (`components/Board.svelte` roamZones); he never stands under one; a walk IN may cross
  behind one, only where no way in is clear of every key (`roam.ts` pick, marked `underSign`; 360x560 is such a
  window). THE SHORT UPRIGHT GROUND (Corey 2026-11-25, his red shape on the 413x586 still: "Look at my shape";
  `game/roamGround.ts` `ROAM_SHORT`): where the tree line stands under the right tunnel mouth's top (413x586,
  375x530, 626x816 and that shape class) the old strip under the trees had no way past the mouth, and he never came.
  There his ground is Corey's band in front of the trees: its top edge follows the forest's snow mounds (it moves with
  the forest), its bottom edge is the wall's snow cap (road px), and it notches up over the arch. He comes in above the
  arch behind the Fast Lane sign and steps down (`roam.ts` `shortWayIn`), the logo keeps his body off it (not his
  shadow: the logo is drawn over both), the floor is never widened there, and a Super wheel run off may rise over the
  arch. Everywhere else his ground is unchanged; `tools/roam_ground_test.mjs` (sections 5 and 6) holds both.
  THE HOME INDICATOR'S STRIP (sideways, the bottom 20 px, `HOME_STRIP`): where the bet symbols' press boxes or the
  Win box's glass would stand in it, the amount group and the Win box rise together by the least that clears it
  and Balance with them by its own rule (`homeLifts`, in `SignGeo.lift`; Corey: "Nudge them up"): 9.5 px and 6.2 px
  at his 667x311, nothing at 832x376 or 568x320.
  AUTO AND TURBO ARE LEVEL UPRIGHT (`levelKeys`, Corey 2026-11-24: "I wanted the Turbo and Auto Modes to be at the
  same height"): their centers on one line (the mean of his two) and one size (the larger of his two), each center's
  x his; sideways they stay stacked as he placed them.
  THE AMOUNT: THE ARROWS STAY, THE NUMBER FOLLOWS THE GAME MODE (`amountType`, `ui/betStep.ts` betWidestEm; Corey
  2026-11-24: "I should have said per game mode ... The arrows should stay where they are at"). The seat (the slot
  and both bet symbols) is the BASE game's and does not move when an Ante level or a feature is loaded. The number
  is sized for the widest amount of the mode in play, in the room between the two DRAWN symbols (4 bar px clear of
  each; wider than the slot between their 44 px press boxes, which are unchanged), never over the window's common
  number size. It changes with the mode or the currency, never with a bet step. Do not size the amount to the
  slot again: that is what made the base game's amount smaller than Balance.
  THE FAST LANE KEY KEEPS ITS RESTING LOOK WHILE A ROUND PLAYS (Corey 2026-11-24: "leaving the button the way it
  is visibly during spins, and make user taps not work during a spin"). `controls.bonusDisabled()` says a press does
  nothing; `controls.bonusShownOff()` says the key also LOOKS disabled, and that is only a round held for its resume
  (and the operator's rule, where the key is not drawn). In a round the key is not a disabled button: it carries
  `aria-disabled="true"` and the class `is-busy` (no hover tint, no press tint), and `bonusPress` refuses. Both bars
  (`ui/sign/SignFastLane.svelte`, the dock's `ui/hud/HudFeature.svelte`). Do not put the steel look back on a spin.
  A DEV LOOK ONLY: `__reindeer.sign.matchNumbers(true)` or `?numbers=match` on a dev server draws Balance and Win
  at the amount's drawn size on the windows where the amount alone steps down (`matchedType`); the default is
  unchanged and nothing of it is in a production build.
  A sign key takes presses as its drawn diamond; where that holds under 44 px an unseen press pad lies under every
  control, an exact outline 2 px from every other press region (`padPlaces`, `padShapes`). EVERY click a control
  of the sign bar gets is judged by where the pointer went down, by the drawn shapes (`pressOwner`, `pressVerdict`,
  `SignHud.svelte` barPress, 2026-11-23): a browser hands a touch to a nearby button by the buttons' upright boxes
  and paint order, and the diamonds' boxes overlap (a tap on Turbo's edge started a round). A round starts only from
  a press that went down inside the Play's own diamond. A new control on this bar goes through barPress. The
  rule's shapes are the buttons' own (`pressShape`: turned squares with round corners, no slack), and each is drawn
  once more as an unseen catch outline under the controls, so a place the rule names a key's always has a taker.
- THE POP-UP PANELS ARE GREEN GUIDE SIGNS (2026-11-23, Corey's pick from the mock `menus_r1_2026-11-23`, style A:
  "Just green everywhere"): the Menu pop-out (`ui/sign/SignMenuPanel.svelte`), the Autoplay card and its amount
  stepper (`ui/AutoplayModal.svelte`, `ui/BetAdjuster.svelte`) and the Fast Lane confirm card (`ui/FeatureMenu.svelte`
  `.card`, green on Snow and on Dark; the white card is retired). One set of pieces, `ui/sign/signPanel.css` (a panel's
  root carries `sp`: the plate, the small dark plates set into it, the chosen white plate, the yellow main key, the
  slider with the bar's diamond, the switch), one set of tokens, `SIGN_PANEL` and `signPanelTokens` in
  `ui/hudTheme.ts` (the `--sp-*` custom properties, worked out from the bar's own `SIGN` colors). A new panel uses
  these, never a new hard-coded color. Places and size classes are `ui/sign/signPanelLayout.ts`
  (`tools/sign_panel_test.mjs`, node only): the pop-out is drawn at the bar's scale, never under 1, over, under or
  beside the Menu key; the Autoplay card is `desk`, `short` (a desktop window under 760 tall: the two switches side
  by side), `wide` (a phone held sideways and a desktop window under 670 tall: two columns, the stepper in the head
  row), `portrait` (a sheet from the bottom) or LOW (Popout S, 400 x 225: the small sizes fix of 2026-11-22 in the
  sign style: columns 1.25 : 1, the total over START, START's words over its amount, a tightened stepper under the
  card). The card's widths are `autoGeometry` in the same file; a wide card under 642 px (568 x 320, 667 x 375) takes
  LOW's column split, three limit chips to a row and the stacked START. With STOP OPTIONS shut the card fits every
  window with no scroll and every tile keeps its price line (`fast_lane_probe` section `smallsizes`,
  `sign_panel_test`). Touch layouts keep every press box at 44 CSS px; with STOP OPTIONS open the card scrolls inside
  itself where it cannot fit: Popout S, a wide card under 642 px, and an upright window under 628 tall. The glass
  dock (`HUD_BAR = 'dock'`) keeps its own glass Menu panel (`ui/hud/HudMenuPanel.svelte`); the Autoplay card and the
  confirm card are green with either bar.
  The same style, as a plain restyle with every box kept (`.sp-skin` in `signPanel.css`: the band and the lines are
  inset shadows, type and sizes as they were), is on the bet list (`ui/DenomModal.svelte`), the notice
  (`ui/NoticeModal.svelte`), the replay card (`ui/ReplayModal.svelte`), the press screen's Scene panel
  (`ui/LandingScreen.svelte`), the skip prompt (`components/SkipButton.svelte` `.ask`), the Fast Lane's amount
  keys (the bar's own bet symbols) and the resume card (`ui/ResumeCard.svelte`: the confirm card's green sign).
  Not restyled, each to be mocked for Corey first: the Fast Lane's tiles (they frame art), the SKIP key itself and
  `ui/RoundCard.svelte` (its per-bonus accent colors would not read on green).
- Active highlights use this game's own "Frost" accent (`accent-rgb` in `ui/hudTheme.ts`), never Manticore's gold
  (rule L6).
- CSS `filter` in the HTML chrome, allowed as shipped (rule R2): only the `.slot-btn` hover and press lift
  (`ui/ChromeStyles.svelte` lines 124 and 127). The glass dock (`ui/hud/hud.css`, `ui/hud/HudStyles.svelte`) uses none.
  No masks or Pixi filters exist in this app (rule R9).
- Touch (rule L4): drawn portrait keys from 34 px (`ROW6`, `hudLayout.ts` line 63), hit area grown to 44 CSS px by
  `.hit::after` (`ui/hud/hud.css` lines 77 to 83).
- `game/scoreboard/layout.ts` reads the window on every layout pass (line 4, rule L3). Its faces are then laid out for the
  renderer's resolution by the smallest dot rule (`ledPitchGeo`, under Win presentation); `scoreboard.ts` asks again every
  frame, since the resolution settles after a resize.
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
  by turbo, symbols pulse to 1.12 twice, others dim to 0.38. The amounts are set once per win, never per frame (rule R1).
  Since 2026-11-22 (wip/winlights) each line's slam label is four `AheadText` (`game/road/winLabelText.ts`): Pixi's own
  text painter (`CanvasTextSystem.renderTextToCanvas`, the same style and resolution, so the Text's pixels, quad and size)
  on a canvas each label keeps, drawn and sent to the GPU in the frames before it shows (`LINE_WIN.slam.ahead`, 3 ms a
  frame, at least one piece a frame) instead of on its own frame; a label still not ready when it shows is made then. The
  old Text cost two canvas text draws and two uploads (2048 x 512 power of two canvases on the upright phone) on the frame
  each amount popped in. A new label text on the board follows the same rule. The strip's small win is drawn ahead from
  the win's start (`LED_BOARD.warm.small`, `scoreboard.ts` `prepareSmall`). Proofs: `tools/win_text_check.mjs` (node: the
  same drawing calls as the Text), `tools/led_warm_check.mjs` (the small win dot for dot), `led_board_probe.mjs` section
  `hitch` (`__reindeer.lightsFrames`, `winLabels`, `winTextCompare`: pixel for pixel in a browser).
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
- THE LED BOARD'S DOT COUNT FOLLOWS THE WINDOW (the smallest dot rule, 2026-11-22, `LED_BOARD.pitch`; Corey: "It must be
  recongizeable as an LED board at all sizes for phone and Desktop, not the mini player", his pick from the mock
  `led_dot_size_r1_2026-11-22`). `game/scoreboard/layout.ts` `ledPitchGeo` lays both faces out again for the renderer's
  resolution: a dot is at least 2.5 CSS px on the desktop and tablet layouts and 2 on phones, never under the board's own
  before the rule, a whole number of renderer pixels; the face is whole dots centred in its housing; the grille's hole is
  made for exactly that size (`scoreboard.ts` `makeGrille` `exact`: no 16 px tile shrunk with mipmaps, which was the blur).
  There is no fixed 362 across: every layout works from the live grid (`F.dotsW`, `F.dotsH`), as it always did on phones.
  - The finer words (`LED_BOARD.density`, 1.5 dots per layout dot) stay only where the face still holds 1.5 x the layout's
    dots (2560 x 1440 at 2x); everywhere else one dot per layout dot and the 5 x 7 dot font.
  - THE DOT FONT STEP (`scoreboardDraw.ts` `setRowDots`, `dotRowCap`, `dotRowCap2`): on such a face an amount or line under
    14 dots tall is the 5 x 7 font, under 21 that font at size 2, and only from 21 the heavy face (drawn small it is blobs).
    (2026-11-23: a row of 21 to 23 dots is that font at size 3, 21 rows, `dotRowCap3`: on a 167 dot upright board a nine
    sign amount in the heavy face at 21 rows is as wide as the board, and fell to 14 rows. A LAYOUT THAT COMPARES TWO
    AMOUNT SIZES COMPARES THE ROWS DRAWN, `rowCapEff`, never the caps: a cap of 20 and one of 14 are the same 14 rows,
    and the win's one row layout beat the stacked one on a tall board by that. `tools/led_center_check.mjs` holds it.)
    A new line of words uses `drawText` or `drawRow` and gets this for free; never rasterize a font by hand.
  - THE STRIP keeps the board's dots where that leaves it `stripMinRows` (8) rows; on a short strip (the desktop at
    1200 x 675 and under) its own dots step down a renderer pixel at a time until it has them. (That was the glass dock's
    47 px strip. With the sign bar the desktop strip is Corey's own height, `signLayout.ts` `DESKTOP.stripH`, 63 px there:
    the rule lays its dots inside that box, and the board's dots already give it 17 rows at 2x, so nothing steps down.) A face of one dot per layout
    dot under 11 rows draws no chase border, bulbs or hazard stripes (`BORDER_MIN_ROWS`): the rows are the words'.
  - The mini player (a window under `miniShort` 300 CSS px on its short side: Stake's 400 x 225 popout) keeps the grid
    before the rule. The 800 x 450 popout is a phone held sideways and takes the rule.
  - A RESIZE NEVER REBUILDS A SHOW IN ONE FRAME (`LED_BOARD.warm.regrid`, `scoreboard.ts` `ensureFaces`, `regridHolds`): while
    a show is up the faces keep their dots, stretched to the new place, and the show is drawn ahead for the new grid in the
    cards' 3 ms a frame budget; the board changes grid when that is done (4 s at most). A card made ahead and still to come
    is made again for the new grid. Layout numbers kept per board (`setBoardPitch`, `setRowDots`, `setFaceClear`) are set
    with the faces and swapped round a draw for another grid (`withGrid`): a new one goes in `boardNumbers`.
  - The 5 x 7 font's look-alikes are held apart by a node check (D is no longer O with two more dots; D and B keep square
    spine corners at size 2, `ledScreens.ts` `SQUARE`). Proofs, node only: `tools/led_fit_check.mjs` (every card and strip
    message at 18 windows and each screen density: inside its face, no two lines over each other, nothing under the press
    screen's light string, no heavy face under 9 LEDs; the font pairs), `tools/led_warm_check.mjs` section 5 (the grid made
    ahead, dot for dot). In a browser: `led_board_probe.mjs` sections `rule` and `density`, `__reindeer.scoreboardLeds()`.
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
