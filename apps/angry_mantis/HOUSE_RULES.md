# Angry Mantis house rules

Angry Mantis is LIVE and FROZEN (math and frontend; 1.0.13 uploaded 2026-10-17). Read this before touching
rendering, layout, win presentation, reels or the HTML chrome in `web-sdk/apps/angry_mantis`. The cross-game traps
(R1 to R10, S1 to S5, L1 to L6, G1 to G3, measuring) are in the `slot-house-rules` skill; this file holds only what is
specific to this game. Moved from the old `angry-mantis-house-rules` skill (last edited 2026-09-10) on 2026-11-21;
lines marked CORRECTED were checked against the code that day.

The game is event playback (pre-computed RGS books), not simulation: all session state is driven by book events via
`bookEventHandlerMap.ts`.

## Rendering numbers specific to this game

- Count-ups: `components/CountUpText.svelte` (about 15 Hz display updates, un-blurred shadow while counting, trailing
  update lands the exact final value). `GameText` uses gradient fill + stroke + blurred drop shadow.
- Big text: `GameText` renders sizes 56 and up at resolution 1, and `components/TextWarmup.svelte` keeps every FIXED
  presentation string resident in Pixi's ref-counted text cache. A new fixed title (intro, outro, banner) goes into
  TextWarmup with the identical preset + size + extra, or it hitches.
- **Device pixel ratio is capped at 1.5** for the Pixi renderer (`components/Game.svelte` lines 109 to 127; the
  ResizePlugin's `renderer.resize(w, h)` passes no resolution, so 1.5 sticks). This is Angry Mantis only and frozen;
  the 1.5 never applies to another game. Every later game prefers 3 physical px per CSS px whenever possible
  (skill rule R3, Corey 2026-11-21).
- Renderable GC disable: `components/Game.svelte` lines 150 to 157.
- No stock Mining Mayhem Spine or bitmap-font assets (removed for lag). CORRECTED: presentations are no longer
  "text-based until real art lands"; the stinger plates, the painted door and the branded glyph titles below are the
  real art.

## Svelte cases in this game

- The `untrack` incident: `components/PressToContinue.svelte` line 28 (`pressGates`).
- Conditional-mount z-order: see the comments in `components/ModePlaque.svelte` (always mounted at line 95, `{#key}`
  at line 107). The three 2026-08-30 cases: DoorSteel over the summary, the Mantis spotlight dim over the rigs,
  StagedWinTitle's outgoing tier over the new slam. ComboWin keeps one always-mounted MainContainer with the
  `{#each}` inside it.
- Superseded tweens: time with `waitForTimeout` + a runId guard (the SymbolSprite pattern).

## Measuring

A browser run: never by a builder on the Mac (root `CLAUDE.md`). Dev server `pnpm dev` on port 3007, mock RGS `math-sdk/env/bin/python tools/mock_rgs.py` on 8443. Force a feature:
`curl -sk "https://localhost:8443/debug/force?criteria=freegame&session=<sid>"`. Accept the mock RGS cert once in the
MCP's Chrome (`https://localhost:8443/fair/state`, Advanced, Proceed).

## Layout

- Masters in `game/layoutSpec.ts`: `landscape` 1280 x 720, `phone` 1480 x 740, `portrait` 412 x 760.
- Every consumer resolves placement through `layoutKind()` + the `MASTER/FRAME/MARTY/HUD` tables. New HUD elements get
  a slot in ALL THREE table entries.
- The HTML chrome (`ui/Chrome.svelte` FitFrame) and the Pixi `MainContainer` scale the same master.
- Touch targets at least 44 CSS px on phones (spin is 61 px, 52 px on an SE).
- Z-order: Marty and Marky above game tiles, below UI buttons.

## HTML chrome surfaces (2026-09-09, "Black Glass Panels")

- **One surface for every panel**: menu popover, Autoplay, Game Info and the Chow Line all sit on `.am-glass`
  (ChromeStyles: `--ui-glass` rgba(12,12,16,.88), hairline `--ui-glass-edge`, 1px top highlight, wells
  `--ui-glass-well`), white ink `--ui-ink`, gray body `--ui-ink-2`, faint `--ui-ink-3`, hairlines
  `--ui-rule`/`--ui-rule-2`. Gold `--ui-gold` is the ONLY accent on a panel (chosen chip, LOAD, the GAME INFO icon
  box); the Chow Line cards use their mode color instead (ante gold, bonus #9cd92f, super #ff8a70, mystery #7fb6ff).
  Red `--ui-red` = OFF / UNLOAD / EXTREME. Numbers are Sora (`.slot-num`). No backdrop-filter: the ModalShell `dim`
  does the frosting (.55 popover / autoplay / chow line, .72 full-screen Game Info). The paper tickets survive only in
  DenomModal, NoticeModal and ReplayModal.
- **Every `<button>` on glass sets its own background**: `.slot-btn` clears border/padding, NOT background (the fold
  row and the toggles shipped white before the fix).
- **Autoplay must not scroll**: portrait (412 x 760) hides hints, toggle blurbs and the footer line, runs the limits six
  to a row and shortens the mode chip; landscape hides the footer line while the STOP OPTIONS fold is open. The gate is
  `scrollHeight === clientHeight` with the fold open in every layout (577/577 portrait, 595/595 landscape when last
  measured). CORRECTED: the exception is Stake's Popout S band (`tiny`: `vh < 300 || vw < 360`,
  `ui/AutoplayModal.svelte` lines 33 to 37), where the sheet scrolls.
- **Game Info is full screen**: `.panel` at `inset: 0`, no margin or radius, sticky head + underlined tab strip,
  reading column capped at 880 and centered. Phone touch targets: 40px close buttons and limit chips in portrait (the
  412 master lands at about 0.95 CSS px per unit).
- **Chow Line**: no headline, no header art (the mantis heads and scatter tile came off on Corey's call); a card whose
  mode is armed shows ON with SWITCH OFF / UNLOAD (`controls.cancelArmed`). The HUD feature button DISARMS when
  something is armed instead of opening the modal (`ui/controls.svelte.ts` line 173), so that state is only reachable
  if that gesture changes.

## Reels and game state

- Reels pre-spin (fall out) on bet press BEFORE book events arrive: any hold or lock is derived live in
  `getLockedRows` (see the ante scatter hold), never set by an event handler.
- Spin speeds and timings live only in `game/constants.ts` (`SPIN_OPTIONS_*`, `TIMINGS`); turbo has 3 levels (0/1/2)
  driven by `stateGame.turboLevel`. Reel options are picked by turbo LEVEL, not by the reel's spinType (an anticipated
  reel is never 'fast', and used to lose turbo entirely).
- **Gravity drop (2026-09-08)**: tiles tip while falling out (`symbolRot` Tween on the reel symbol, `tipRadians`),
  fall in with `quadIn`, land with NO y-bounce (`symbolFallInBounceSizeMulti: 0`) and squash + dust on contact
  (`GRAVITY_DROP`, ReelSymbol.svelte's landing beat). Rotation and squash live on the wrapper Container or a sibling,
  never on `symbolY`: that keeps the drift gate green. Dust is Corey's `dust_poof` sheet
  (`static/assets/ui/dust-poof.webp`, six 512 x 192 frames stacked vertically), sliced ONCE into frame textures by
  `game/dustTexture.ts` and played one frame per sixth of `GRAVITY_DROP.dustMs` bottom-center on the tile edge
  (320 ms, 1.35 tiles wide, alpha 0.55, Corey's artifact picks). Never re-slice per landing.
  Spin length about 1.8 s press-to-rest at normal speed on real Chrome (artifact: 1.6 s): the fall-out is the short
  phase (60 ms reel stagger, about 255 ms drop) and after a pre-spin each reel's fall-in starts as soon as THAT reel is
  empty, with the 110 ms stagger anchored to reel 1's start (`reelState.staggerFrom`, createEnhanceBoardSpin). Never
  make the fall-in wait for all five.
- **Scatter anticipation (2026-09-08)**: base and ante compute the array on the frontend from the revealed board
  (`anticipationAfterTwoScatters`: from the reel after the running scatter count reaches 2, every remaining reel; never
  stops once started). Mystery uses the BOOK's array verbatim (math rule: reels 3+4 always, reel 5 only if both carried
  a scatter). Free games: none. Hold = `reelFallInDelay x (anticipated - normal padding)/6` = 800 ms normal / 364 turbo /
  200 instant, scaled per reel by `reelState.holdScale` (`anticipationHoldScales`: 0.8x per further teased reel, a
  scatter on the reel before resets it to full, floor 300 ms). The scale shrinks the reel's PADDING contribution too, so
  later reels' waits stay aligned; set it before prepareToSpin. An anticipated reel arms its own `anticipating` flag and
  stamps `holdStart/holdMs` when its hold begins (fallIn in createReelForCascading). Visual = `Anticipation.svelte`:
  searchlight (baked wedge, `game/beamTexture.ts`, additive, masked to its column with `Rectangle isMask`) over a faint
  rain of loose sprites, plus a light spill from the column edges that grows over the hold; strength 0.75/0.5/0.3 by
  turbo level (`ANTICIPATION.strength`). Mounted INSIDE Board's masked container; loose symbols never enter
  `reelState.symbols`.
- `window.__angryMantis` (Board.svelte) exposes `boardDrift/driftEvents/atRest/boardLayout/gameType` for test
  harnesses; extend it rather than adding new globals.
- **High-symbol landing beat** (H1/M1/M2/M3, `ReelSymbol.svelte`, tuned via `HIGH_LAND` in constants): tray-only
  glint + squash once the landing bounce settles. It depends on skill rule S5 (texture-space Graphics fill, a fresh
  context per draw, two contexts alternated). Do not "simplify" either away.

## Test gates: run after touching reels, layout, presentation or network handling

These are browser runs: never by a builder on the Mac. From the parent repo root, with the mock RGS
(`math-sdk/env/bin/python tools/mock_rgs.py`) and `pnpm dev` (port 3007) running, and `PW=<dir containing playwright's node_modules>`:

- `NODE_PATH=$PW node tools/drift_test.js`: symbol grid drift over 200 spins
- `NODE_PATH=$PW node tools/orientation_test.js`: rotation flips, WebGL context loss, heap, touch targets
- `NODE_PATH=$PW node tools/chaos_test.js`: input hammer, tab freeze, network faults, refresh-resume, DPR, soak

All three must PASS. They read `window.__angryMantis` only.

## Painted door (DoorPaint.svelte, game/doorPaint.ts), 2026-09-10

- The bonus intro and the wrap-up are PAINTED INTO the steel door, not laid over it: one raw Pixi mesh the size of the
  door (mounted inside DoorSteel's masked container, so it rolls, clips and hides with the door) with a fragment shader
  that multiplies every painted pixel by the door's groove map (`static/assets/ui/paint/door-groove.webp`,
  `tools/build_groove_map.py`; rebuild it if the door art changes). Layers: mode header + two turning stars (logo
  yellow), free-spin count + six pushing brush strokes (cream), the BIG WIN plate in its own colors, the wrap-up amount
  from the numerals atlas (ink only, glyph boxes as uniforms, never a raster). No filter pass, no render texture; the
  ticker rewrites uniforms only. This is the one deliberate shader in the house games.
- Every position is a FRACTION OF THE DOOR IMAGE (x of width, y of height, sizes of width): the "Painted Door Screens"
  artifact's readout units. Re-tune = numbers in `DOOR_PAINT`, nothing else. `layoutSpec.doorRect()` is the one source
  of the door's rect (DoorSteel, DoorPaint, the outro's trays).
- What is painted comes from `game/doorPaint.svelte.ts`: bonusStart/bonusEnd set it BEFORE the door rolls (so the paint
  is on the door from the first frame), the wrap-up's count-up feeds the amount (PaintedAmountFeed), doorOpen clears it.
  A currency the atlas cannot draw (or more than 16 glyphs) falls back to the sprite count-up laid over the door
  (`paintedAmountSupported`).
- Paint textures are WHITE + alpha (`static/assets/ui/paint/*.webp`): the shader reads alpha and tints; only the plate
  keeps its RGB (`uCountRGB`). GLSL must index uniform arrays by loop symbols only (WebGL1 rule): the glyph loops are
  unrolled in place for that reason.

## Branded title text (BrandedTitle.svelte)

- ON THE MENU and THEY ATE EVERYTHING are set letter by letter from the branded glyph atlas
  (`tools/build_branded_glyphs.py` to `static/assets/ui/branded-glyphs/`, metrics in `game/brandedGlyphs.ts`). Spacing
  comes from the tool's OVERLAP/GAP constants (Corey's foundry picks); never hand-kern in a component. Re-run the tool
  when Corey re-exports the sheet.
- Motion lives in `BrandedTitle` only: `tier` 0-4 scales the family (slam entrance, split-flap exit, idle
  wave/pulse/shake, glint cadence); `glow` drives the ON THE MENU pulse via the `menuGlow` event. Add new titled
  moments by mounting a BrandedTitle, not by baking new text webps.
- **Big-win presentation = STINGER plates (2026-09-09)**: `components/WinStinger.svelte` draws Corey's riveted tier
  sign (`game/stinger.ts`: plate keys, per-plate amount box as % of the alpha-cropped plate, cream tint + rust shadow,
  motion timings; `layoutSpec.STINGER` for width and center per kind) with the count-up (`CountUpText` to `ArtAmount`
  `tint` + `shadow` run) in its blank panel. BIG drops in from above and kicks; every tier upgrade is the CHOW-LINE
  SHOVE (next plate in from the right, old one out the left, lighter kick); the number stays put unless the incoming
  plate's box differs (MAX), then it rides in with the plate; the last plate drops off the bottom before the fade.
  Plates are deferred assets. `components/StingerPlate.svelte` is the STATIC plate + cream amount: the free-spin
  wrap-up shows the FINAL tier's plate (no hand-offs, rides the door) or the plain `normal` plate when the total is not
  a big win, and every regular win pop is the plain plate at `layoutSpec.STINGER_SMALL` size. The plain plate is
  PRELOADED (first-spin wins); the tier plates are deferred. `StagedWinTitle` is gone; `BrandedTitle` serves ON THE
  MENU (PoolHud) and THEY ATE EVERYTHING (MaxWinCinematic) only.
- The HTML chrome's logo + tagline glints are `ui/Shine.svelte` (CSS mask sweep, restarted on the `bet` event so every
  Shine on screen stays in sync). Keep it CSS: no canvas, no backdrop-filter.

## Assets

The cross-game pipeline rules (cache-busting, no external hosts, sheet builders, phone tier, audio formats) are in the
recipe's `baked-in-preferences.md` sections 4 to 6. Angry Mantis specifics:

- **Audio (2026-09-02)**: `tools/build_audiosprite.py` builds a MONO sfx-only sprite and the five music loops as
  separate stereo per-track files (`audio/music/<name>.*`; the manifest is `audio/music.json`, one level ABOVE the
  music/ dir), all at **96 kbps** (Angry Mantis keeps 96; never ask Corey about bitrates). CORRECTED: the shipped files
  are `.ogg` and `.m4a` only (`static/assets/audio/`), no `.mp3`. Needs `brew install vorbis-tools` (oggenc). Music
  STREAMS through Howler `html5:true` (`utils-sound/createMusic`) with `element.loop` set by hand and
  `Howler.autoSuspend = false`. The landing screen gates on the sprite + the base track buffering; the other loops
  preload in the background. The builder's state file (`tools/audiosprite.state.json`) skips re-encoding unchanged
  sources.
- The white stencil glyph atlas (HUD amounts, symbol scores, count-ups, big-win counter, intro copy) is GENERATED, not
  sliced: `tools/build_stencil_atlas.py` renders Black Ops One (Markazi Text 700 only for the dong, Arabic and Egyptian
  marks) with the prison-stencil treatment into `static/assets/ui/numerals/` + `src/game/numeralGlyphs.ts`.
  `game/numeralTokens.ts` is the single source of what it can draw (A-Z a-z 0-9, punctuation, every Stake currency
  mark). New glyph = add it to the builder's NAMED map and to CHAR_TO_GLYPH, rerun, restamp.
- Frames via `tools/build_reel_frames.py` (cell wells radius 4 master px); placeholder symbols via
  `apps/angry_mantis/tools/make_placeholders.py` (real tiles auto-imported from `<repo>/assets/images/tile/`; parent
  image folders documented in assets/README.md mirror the static names). Update `assets.csv` when assets change.
- **Paying-symbol art (2026-08-26)**: TWO files per insect: `<p>-plate.webp` (empty plate) + `<p>-insect.webp` (cutout
  at its on-plate position, transparent 256 square canvas). The sheet builder composites tile = plate + contact shadow
  + insect, so the eat-flight pickup is registration-perfect and the shadow lifts away with the bug. A combined
  `<p>-*.webp` tile (legacy three-file scheme) still wins wherever no `-plate` exists. W/S/H1-as-full-art stay single
  files; GL is the Service Bell: `service-bell-1..5.webp`, frame 1 = the tile, 2-5 = press depths appended to the sheet
  as `GL_ring_2..5` (game/bell.ts).
- Fonts: `ui/fontFaces.ts` injects the @font-face rules and pre-kicks `document.fonts.load`.
- **Sky behind the windows (2026-09-08)**: the three cafeteria rooms have their window panes cut to ALPHA (Corey's
  Procreate edit). `components/AmbientSky.svelte` sits UNDER the room sprites in Background.svelte (zIndex -2.5) with
  one sky sprite per scene at the offset in `ambientSpec.SKY` and, for super/feast only, `CLOUDS.count` cloud sprites
  from the per-scene atlas drifting right to left (`CLOUDS.direction`; depth roll sets size, speed and alpha together;
  wrap re-rolls), plus, in the base scene only, bird flocks (`BIRDS`: 3-6 per flock, per-row frames from birds.json,
  texture swap per flap). No masks: the art's alpha clips it. `tools/build_clouds.py` (repo root, math-sdk python)
  crops the skies and packs the cloud sheets from assets/images/backgrounds/{backdrop,clouds}-*.webp; rerun it when
  Corey re-exports either. The sky and the cloud atlas are separate deferred assets: build each when IT arrives, never
  gate one on the other (the first cut skipped the clouds forever when the sky landed first).
- **Ambient layer pattern (fan, sky, roaches, fly, lamps)**: each is a raw PIXI container added via
  `getContextParent().addToParent(root)`, ticked on the app ticker, authored in BACKDROP px (1920 x 1080) and placed by
  Background.svelte with `x = canvasW/2 - 960 * backdropScale`, `y = canvasH/2 - 540 * backdropScale`,
  `scale = backdropScale`. Every tunable lives in `game/ambientSpec.ts` (Corey's picks from the tuner artifacts), never
  in the component. zIndex ladder in Background: rect -3, AmbientSky -2.5, AmbientFly-behind -2.2 (while it is in the
  window pane), rooms -2, AmbientLights -1.9, fan -1.5, AmbientRoaches -1.4, AmbientFly -1.3, wash -1. Roaches run in
  EVERY scene (Corey 2026-09-08). DEV hooks: `__angryMantis.ambient.{fly,lights}`. ChatGPT sprite sheets are never on
  an even grid: `tools/build_clouds.py` re-lays them by silhouette (birds per row, roach by geodesic growth from eroded
  bodies, fly by body centroid); fix the sheet in the tool, not with hand offsets.
- **Lamp flicker (2026-09-08)**: the lights-off room is a different global render, so `AmbientLights` never shows it
  whole: `tools/build_clouds.py` lifts one feathered, edge-aligned, tone-matched ellipse per lamp
  (`light-off-{hanging,sconce,counter}.webp`, offsets in lights-spec.json to `LIGHTS.lamps`) and the component fades
  them in over the lit room (alpha 0 = lit). Blink and outage timing is `LIGHTS`; a new lamp = a new ellipse in the tool
  + a `lamps` entry + an asset key.
- **Mantis floor shadows (2026-09-08)**: `BoneRig.svelte` draws four per-foot soft ovals (toe = bone + rig offset -
  pivot, scaled, + nudge x H: `MANTIS_SHADOW.feet.offsets` in `game/mantisShadow.ts`), a front body shadow and a
  fainter back one: the rig view is rendered each tick into two low-resolution RenderTextures (logical size = view
  bounds; `resolution` only thins the backing store, so sprite scale = rig scale, NOT divided by resolution) and
  projected onto the floor with `setFromMatrix` (a = width x k, c = -cos(phi) x L x k, d = -sin(phi) x L x k; phi 90 =
  toward camera, 270 = toward the wall). The fade gradient is an `erase` blendMode sprite rendered with `clear:false`,
  wrapped in a holder container, because `renderer.render({container, transform})` replaces the root's own transform.
  Marky mirrors for free (wrapper.scale.x = -1). `FrameShadow.svelte` (Game.svelte, after BoardFrame) paints the same
  silhouette onto the frame post through a rect mask from the `mantisShadow.ts` source registry.
  `rigScale = size / maxDim`; never read `r.view.scale`, it is set later by an $effect (the first cut built shadows at
  scale 1).
- **Landing screen**: logo + tagline + loading bar / PRESS ANYWHERE over the live Background, which must stay in view.
  CORRECTED: the old note said the feature-tour cards were gone; the code has Corey's three primer cards
  (`game/introCards.ts`, `ui/LandingScreen.svelte` lines 2 to 6), placed clear of the windows band and the fan so the
  ambient layers stay in view (a row on desktop and phone, a fan in portrait).
- Real Marty and Marky are Spine bone rigs from Corey's animation app: ONE skeleton, `marty`/`marky` skins (rig
  contract in project memory). Placeholder art swaps live in `constants.ts` `SYMBOL_INFO_MAP`.
