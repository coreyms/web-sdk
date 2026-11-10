# Run Over Reindeer: first pass decisions (2026-11-09)

Every decision the build agent took for the first pass, one line each, with where to change it. Corey said the
agent decides and he tweaks later, so nothing here is locked. Paths are inside `web-sdk/apps/run_over_reindeer/`.

Most motion, size and color numbers are live on the dev server: `window.__reindeer.tune` (change a number in the
console, spin), `__reindeer.tuneJson()` (copy the set back into `src/game/constants.ts`), `__reindeer.clock(0.1)`
(slow motion) and `__reindeer.clock(0)` (freeze).

## 1. Departures from the brief

- **Lane height.** The brief says lanes are 85% of a square cell. The locked background's own lanes are 164 to 178 road px (pixels of the 1536 wide picture), and the locked mock (`mock_lanes_85.jpg`, "about 300 x 212") is a column 300 wide for a lane 212 tall, not a square. Followed the mock: column pitch 250 road px for a 171 road px lane (0.68). A square based column (201) would leave 200 road px of empty road at each tunnel and cars too small to overlap the lane above. Change: `tools/build_assets.py` `COLUMN_PITCH`.
- **Dark ground under the HUD.** The house HUD is white and gold ink made for a dark scene and cannot be read on snow. Two additions the brief did not ask for: flat dark bars in the canvas under the HUD's rows (`src/components/HudBeds.svelte`, `HUD_BED` in constants), and the area left and right of the road picture is dark rock, not snow (`ROAD.rock`). The HUD itself is untouched.
- **Workspace registration: none made.** `pnpm-workspace.yaml` already takes `apps/*`. `node_modules` in the app was linked by copying Manticore's links. `pnpm install --lockfile-only` was tried and put back, because it also rewrote an unrelated `@lingui/core` entry. `pnpm-lock.yaml` therefore has no entry for this app: one `pnpm install` in `web-sdk` adds it.
- **Fixture rounds come from the page, not a server.** On the dev server the game's own RGS requests are answered in the page (`src/fixtures/fixtureRgs.ts`), so no mock RGS process or port is needed. The round still runs through Authenticate, the play request, the book event handlers and end-round.
- **Event contract.** `EVENT_SCHEMA.md` appeared while this was being built; the event types, handlers and fixtures were then shaped to it (`src/game/typesBookEvent.ts`).
- **The `?perf=1` staging readout was not carried over.** Manticore's reads its creature and label atlases. `?rescap=` and the staging build flag are kept.
- **Desktop screenshot size.** The 16:9 desktop shots are 1600 x 900.

## 2. Board and layout

- Road space: everything on the board is placed in road px and scaled as one piece per layout (`src/game/layoutSpec.ts` `ROAD_LAYOUT`, `roadPlacement`).
- Lane lines, measured off the background by the tool: 167, 331.5, 510 (the double yellow's middle), 687, 851 road px. Lanes are 164.5, 178.5, 177 and 164 tall, as painted.
- Tunnel mouths: 51 and 1483 road px at mid height (measured). Five columns of 250 are centred between them: x 142 to 1392.
- A symbol sits 10 road px above its lane's lower line (`ROAD.sitAboveLine`).
- Lane directions: top two left to right, bottom two right to left (`ROAD.laneDirection`).
- Lower lanes draw in front: one container per lane, top lane first.
- Traffic comes out of the tunnels because two portal strips cut from the background are drawn over it (`static/assets/road/tunnel-left.webp`, `tunnel-right.webp`). No mask.
- Tunnel shadow on traffic: a symbol is tinted from 8% brightness at 110 road px under the portal to full at 200 road px inside the mouth (`ROAD.tunnelShade`). A tint, not a filter.
- Desktop (1280 x 720 master): the picture is 1104 master units wide, centred at 640, 352. It covers the screen's height; the board is 898 x 492, 70% of the width. Dark rock left and right.
- Phone held sideways (1480 x 740): the picture is 983 wide, centred at 740, 368, so the five columns span exactly the gap between the HUD's two 340 wide side columns. The portals stand under the inner edges of those columns (the Menu and Autoplay buttons sit over the stone).
- Portrait (412 x 760): the picture spans the screen's width (to 560 on a tablet), its centre 47% of the way down the band between y 150 and the BALANCE row. Board 335 x 183 on a 390 wide phone: a column is 63 CSS px.
- Portrait leaves large empty snow above and below the road. Nothing fills it yet.
- Scene around the road: flat snow `#e9f0fd` (sampled from the picture). No trees, no desktop overpass, no ambient life.
- HUD beds: color `#15171d`, a 2 unit hairline `#3b3f4a`; top bar to y 36 (desktop) / 34 (portrait), bottom bar from y 604 (desktop) / 606 (portrait). None on a phone held sideways.
- The board is mounted as soon as the preload is in, so the landing screen stands over the real road.
- The board takes a tap during a live spin (hurries it), like the Spin press.

## 2b. Stoplights (added 2026-11-09, after Corey played the first pass)

- **Corey's ruling, not a guess, the signal (three rounds on 2026-11-09; the last wins where they differ):** "It should be red when the board is idle or stopped, green after pressing spin or while a spin is starting, and yellow as symbols start to decelerate." Then "make them turn Red as soon as the symbols stop." Then "the red should land right before the cars stop. So I think we can do green less time after the spin, transition to yellow faster, and to red faster."
- So the lights LEAD the traffic. RED while the board is idle or stopped (through the win too). GREEN from the press, for a short fixed time. AMBER from then until the red. RED again shortly BEFORE the light's own symbols reach their stop point, so the cars are seen braking to a red light.
- **Corey's ruling, the place:** one at the top right tunnel mouth beside the two lanes that drive right, lenses facing left; one at the bottom left mouth beside the two lanes that drive left, lenses facing right. Tucked under the arch so only part of the box sticks out, and not in shadow.
- **Corey's ruling, the size:** "33% smaller" than the first cut. The housing is now 1 lane tall (171 road px; it was 1.5 lanes, 256).
- Source: `references/mockups/stoplight/stoplight_unlit_v4.png` (his pick). The drawing is the bottom left light; the top right one is the same frames mirrored by the game, an exact matched pair.
- "Stop" means the instant a symbol reaches its stop point, the START of its brake bounce, not the end of it.
- **Corey's ruling, fourth round:** "I think the red light still needs to come in a little earlier on the spin timing, cars slow for yellow, they don't stop for it." Red now leads its lanes' stop by 300 ms on the road's clock (`STOPLIGHT.lead.red`; it was 150), so the traffic slows through the amber and finishes its stop under the red. 0 gives the second cut back: red at the instant the symbols stop.
- Green lasts 400 ms on the road's clock after the press (`greenMs`, with `amberFrom` 'afterGreen'). It was about 0.64 s.
- Amber is what is left between green and red: 0.63 s on the top light and 0.89 s on the bottom one at normal speed. `amberFrom` 'beforeRed' gives exactly `amberMs` (450) of amber instead, and green takes the rest. `amberFrom` 'brake' is the first cut (amber at the first braking symbol).
- Every signal time is on the road's own clock, which runs 1.7x at turbo 1 and 2.6x at turbo 2, so the leads shrink with the spin and the order always holds. Green is never more than half the way to the red, and amber shows at least 60 road ms (`minShowMs`).
- A slam stop turns both lights red at once (`slamRed`), whatever they showed.
- While the game waits on a slow book the lights stay green; amber never starts before the book's traffic has set off.
- Red is instant: on, and the other lenses off, in one frame. Green and amber fade over 80 ms (`fadeMs`).
- Each light times its red off ITS two lanes (`follow.red` 'pair'), so the top light is red about 0.26 s before the bottom one at normal speed and with it at turbo 2. 'board' times both off the last lane.
- The schedule at the 300 ms lead, real ms from the press, top light / bottom light. Worked out from the game's constants with the road's own arithmetic, no browser run (Corey's Mac was under load); the same arithmetic matched the earlier in-page hand-stepped run at the 150 ms lead to within 3 ms.
  - Normal: green 400 / 400, amber 627 / 887, red leads the stop by 300 / 300 (symbols stop at 1327 / 1587).
  - Turbo 1: green 235 / 235, amber 305 / 411, red leads by 176 / 176 (stop at 717 / 823).
  - Turbo 2: green 117 / 117, amber 117 / 117, red leads by 115 / 115 (stop at 350). Green is cut to half the way to the red here, so all three still show.
  - A slam stop still turns both lights red at the press.
- Stepped in the page at the earlier 150 ms lead (`__reindeer.step`, 2 ms steps): normal green 400, amber 778 / 1034, lead 150; turbo 1 green 236, amber 394 / 498, lead 88; turbo 2 green 148, amber 146, lead 56 to 58; slam at 250 ms green 252 then red at the press.
- Why red read late in the first cut: amber was held until the last lane's bounce had settled (300 ms after its last symbol stopped) for both lights, and then red faded in over 80 ms.
- The signal is scheduled from the stop times the traffic itself is driven by (the road knows them the moment the book's board sets off).
- Off switches: `STOPLIGHT.lit` false leaves every lens dark; `STOPLIGHT.show` false removes the lights.
- Layering: over the traffic (symbols pass under the lights), over the line win, under the rock and the two portal strips that were already cut from the background. The stone covers the arm and part of the housing. No mask.
- Never tinted: they stay at full brightness while the traffic under them darkens toward the tunnel.
- How far out: the housing's lens edge stands 31 road px past the mouth line, the same two thirds of the box as before (the box is 45 wide at this size), plus the domes (10). The arm ends inside the picture, under the portal strip.
- Per layout, live in `__reindeer.tune.stoplight.layout`: `height` (lanes), `protrude`, `along` (slide along the mouth, + toward the double yellow), `tilt` (degrees). The three layouts start on the same numbers: 1, 31, 0, 0.
- Each light stands at the middle of its two lanes, on the mouth line measured off the background (`roadArtSpec.ts` `mouthLine`). The mouth curves, so one end of each light shows a few road px more box than the other.
- Lit lenses: three overlays cut from the same drawing by the tool (only the dome's glass, its shadow tone and highlight kept), in red `#ff3028`, amber `#ffc416`, green `#34ee68` (`tools/build_assets.py` `STOPLIGHT_LIT`).
- Glow: ONE pre-rendered white blob with alpha, tinted to the lens color and added over the lit dome (additive blend, no filter), 55% (`STOPLIGHT.glow`; alpha 0 turns it off). It shrinks with the light: 87 road px across now. One tinted picture instead of one per color.
- The frames live in the symbol atlas, in both device tiers (built for the 1.5 lane size, so the smaller light is drawn down from them).
- Dev hook: `__reindeer.signal('red' | 'amber' | 'green' | null)` holds both lights on a color or dark; `__reindeer.signal()` hands them back to the board. `__reindeer.road().signals` reads what they show.
- Screenshots: `docs/first_pass/stoplights/` (re-shot at the smaller size, at the 150 ms lead; the frozen moments in them are 300 ms green and 900 ms amber, which still show those colors at the 300 ms lead).
- Checked on the running dev server at 390 x 844, 844 x 390 and 1600 x 900, with the board's clock frozen: red at rest, green while driving, amber while braking, a symbol passing under each light, close-ups around both lights (`closeups-*.jpg`).
- Not done: no sound on a change, no light on the bottom right or top left mouths, no swing or flicker, no shadow under the lights. Not seen on a real device or in Safari. The "two green boxes" sketch was not in the folder.

## 3. Symbols

- Frame names: H1 Grandma's car, H2 station wagon, H3 OH-KAY van, H4 police car, L1 A, L2 K, L3 Q, L4 J, L5 10, W Santa's sleigh, S the present. The order of the three lower cars is the spec's open question; this is a working order (`src/game/config.ts`).
- Sources: Grandma, wagon and police from `renders_v7/final`, the van from `renders_v4/final` (the newest van there is), the police car with its light bar off.
- Cars share one scale: the widest (police) is 230 road px wide. Grandma 212 x 131, wagon 229 x 129, van 216 x 178, police 230 x 156. The van overlaps the lane above by about 10.
- Cars and the sleigh have one picture per direction (`_R` top lanes, `_L` bottom lanes). Nothing is mirrored at run time, so lettering always reads.
- The van's left-facing render carries stray marks in its lettering ("Roadkill|Cleanup"). That is in the source render, not added here.
- Signs sized by painted area against the A (A 160 road px tall): K 95%, Q 90%, J 85%, 10 80% of the A's area. The K's box comes out larger than the A's because a triangle fills less of its box.
- Signs are the `_v2` / `_v3` drafts from `references/mockups`.
- Santa's sleigh Wild: the empty sleigh still `santa_sleigh_v6_2runners.png`, 205 wide, with a white WILD tag baked on. Santa is not in it: `santa_sleigh_seated_v13.png` is Santa's seated pose alone and compositing him needs the sleigh split into front and back layers.
- The feature Wilds GW and CW have no art: a book that carries them draws them as the sleigh.
- Per symbol size trim without rebuilding: `ROAD.symbolScale`.
- Atlas density: desktop 3.2 px per road px (3 physical px per CSS px on a 1920 x 1080 screen), phone tier 1.2 (covers 3x on a 932 x 430 phone held sideways and on upright phones). 1938 x 3434 and 944 x 926, lossless WebP, 3.3 MB and 0.6 MB.
- The desktop atlas gets a mip chain (drawn far under its size on a small window). The phone atlas does not.
- The background ships at its source size, 1536 x 1024 (WebP quality 92, 176 KB). That is under 3x density on desktop: it needs a larger source.

## 4. The spin (`ROAD_MOTION` in `src/game/constants.ts`)

- Shape: on the press each lane's symbols pull away toward the far tunnel, front car first. When the book's board is in, each lane's five symbols drive in from the near tunnel as a spread out convoy, brake one after another (front car first), stop a little past their mark with the nose down, and rock back.
- The math's reels are the columns. The lanes are only how the picture moves.
- Cruise speed 2500 road px per second.
- Lane order top to bottom (`laneOrder`).
- Drive out: 45 ms between lanes, 38 ms between cars, acceleration 13000 road px/s2, top speed 3400, the tail squats 1.6 degrees over 240 ms.
- Drive in: starts 220 ms after the press at the soonest, 130 ms between lanes, 72 ms between the stops of a lane's cars, 270 ms from cruise to stopped.
- Brake bounce: stops 13 road px past the mark, nose down 2.6 degrees, rocks back over 300 ms with 0.75 of a swing.
- Signs, the sleigh and the present take 55% of the overshoot and the dive (`stiffShare`).
- Press to rest at normal speed: about 1.9 s measured (with the fixture's 120 ms answer).
- Turbo 1: the same motion on a clock 1.7x faster, lanes 90 ms apart, cars 55 ms. About 1.1 s.
- Turbo 2: clock 2.6x, all four lanes at once, cars 26 ms apart, overshoot 6, dive 1.2 degrees, settle 160 ms. About 0.6 s.
- Slam stop (Spin press or board tap mid spin): the rest of the spin runs 3x faster (`hurryRate`). About 0.85 s.
- Through traffic: symbols that drive straight through a lane. Off in a normal spin (`through.perLane` 0); on while the game waits for a slow book, one every 340 ms per lane (`whileWaiting`). They are decoration picked at random and never land.
- A stop sound per lane when its front car stops.
- No scatter anticipation yet.

## 5. Line win (`LINE_WIN`)

- All winning lines show together for 1300 ms (60% at turbo 1, 35% at turbo 2), 120 ms after the board settles.
- Winning symbols pulse to 112% twice; the others dim to 38% brightness.
- One line drawn through the middle of each winning cell: 9 road px wide with a 4 px dark edge, 92% opaque, drawn over the symbols.
- Line colors cycle by payline number: yellow, turquoise, pink, lime, orange, white.
- The spin's amount: Overpass Heavy, 86 road px, white with a 12 px dark outline, on the middle cell of the first winning line, popping in from 60% over 180 ms. It covers that symbol.
- The amount is canvas text set once per win, not a glyph atlas. The forged currency glyphs the spec lists are not made.
- The HUD's WIN counts up with the house 550 ms count.
- No win tiers, no win plaque, no big win count-up, no max win screen.

## 6. Feature menu (`src/ui/FeatureMenu.svelte`, `src/game/featureMenuData.ts`)

- Name: THE FAST LANE.
- Three cards on the house black glass panel: FREE SPINS (turquoise `#19d3da`), SUPER FREE SPINS (red `#ff5a6e`), ANTE (the house ante gold `#ffdc4a`).
- Side by side on a wide screen, stacked on an upright one with each button beside its price.
- The house bet control sits in the menu, so prices can be changed there.
- Price = the RGS's cost multiplier times the bet, never a number from the data file.
- BUY arms the feature on the Spin button for one round (the house flow). Nothing is charged until Spin. The card then reads LOADED with UNLOAD.
- Ante: one card, a native range slider with three stops (2x, 4x, 10x), opening on 4x or on the level that is on. ACTIVATE switches it on; when on, the card offers CHANGE and SWITCH OFF.
- Four odds rows per card; three on an upright phone under 740 px tall. The Ante card's rows change with the slider.
- **Every odds row is a DUMMY number**, flagged in the data file (`ODDS_ARE_DUMMY`) and by a visible line in the menu ("Sample numbers. The real odds come from the math.").
- No blurbs on a short or upright screen.
- Checked not to scroll at 12 sizes from 320 x 568 to 1920 x 1080.
- No confirm step and no bonus-confirm sound yet.
- Ante mode keys are this frontend's guess: `ANTE_2`, `ANTE_4`, `ANTE_10` (the math has base, bonus and super so far).

## 7. HUD, title, type and color

- The HUD is Manticore's, unchanged in layout, sizes and text, including its bronze plate button skin.
- Brand accent: present turquoise `#19d3da` (splash, loading bar, the dot in the feature button's mark).
- Clock strip text: RUN OVER REINDEER.
- Title: a PLACEHOLDER highway guide sign drawn in CSS (`src/ui/TitleSign.svelte`): green `#0b7a43`, white border, Overpass Heavy. One line on desktop, two on phones.
- Display face (modal headings, PRESS ANYWHERE, the menu's titles, the canvas amount): Overpass Heavy. The HUD keeps Outfit and Sora.
- Overpass bundled as four WOFF2 weights (regular, bold, extrabold, heavy), converted from the installed OTF files. The license note beside them was written by the tool and needs checking against the release's own file.
- Splash: the house PolyMath splash with turquoise accent, white wind-blown specks, six loading lines ("PLOWING THE ROAD" to "WAKING THE REINDEER").
- Landing screen: the title sign, the splash's segmented bar, then PRESS ANYWHERE TO CONTINUE on a glass pill. No explainer cards.
- Game Info: Manticore's page shell with this game's sections (paytable with the real pictures, the 20 lines, how to play, modes, max win and RTP, legal). The rules copy is a first draft from the spec, not checked against published math.
- Three and four of a kind pays are the first simulation's proposal (`ror_rules.py`), mirrored in `src/game/config.ts`.

## 8. Placeholders

- The present scatter: drawn by the tool (turquoise and white box, FS), tagged PLACEHOLDER.
- The running reindeer: the locked reference still `reindeer_run_ref_v2.png`, tagged PLACEHOLDER. Only the dev hook shows it (`__reindeer.runReindeer(row)`); it canters along a lane line and is tied to no book event.
- The sleigh's WILD tag, the title sign, the dummy odds, the HUD beds and the flat snow and rock are all stand-ins.

## 9. Sounds borrowed from Manticore Mayhem

- The whole effects sprite and all five music tracks are Manticore's files, byte for byte (`static/assets/audio`, 7.8 MB).
- Played in this pass: `bgm_base` (music), `sfx_ui_spin`, `sfx_ui_button`, `sfx_ui_minor`, `sfx_ui_sub`, `sfx_ui_bonus` (the HUD's clicks), `sfx_reel_stop` (each lane's stop), `sfx_cluster_remove` (a line win).
- Everything else in the sprite is carried but never played.

## 10. Fixture rounds (`src/fixtures/fixtureRounds.ts`)

- Eight hand-written books: two plain no-win spins, three 10s (0.1x), four wagons (2.5x), two lines at once (0.8x), a sleigh Wild completing four vans (2x), five Qs on a zigzag (1.5x), five Grandma cars (25x).
- They come round in a fixed order; `__reindeer.fixtures.next(name)` picks one.
- `tools/check_fixtures.mjs` re-reads every fixture against the paylines and paytable.
- The demo wallet starts at $1,000 on the house 32 level bet ladder and answers after 120 ms.
- A bought round or an Ante spin is charged its real price but shows a base game fixture: those modes have no books yet.
- `__reindeer.fixtures.queue(events, pays)` plays any book once, for trying a real one from the math.

## 11. Verified in this pass

- Loaded headless (Chromium) at 390 x 844, 844 x 390 and 1600 x 900: landing, idle board, the spin, a line win, the feature menu. Screenshots in `docs/first_pass/` (the mid spin frames are exact: the board's clock was frozen at 230, 620 and 1150 ms after the press).
- Console clean in every probe run.
- 30 spins through the fixture order: the drawn board equals the book's board every time, no symbol off its mark, the sprite pool stays at 40, the wallet matches the plays to the cent.
- Turbo 1, turbo 2, the slam stop, a board tap, a rotation mid spin, a 10 spin autoplay run, arming and playing a buy, switching an Ante level on and off.
- A book in the contract's full shape (strikes, crossing, both Wilds, a bonus round, a retrigger) plays through to its finalWin with nothing drawn for the feature events, and the game spins on.
- A production build passes (`vite build`, the prune step, `scripts/check-production-bundle.mjs`): no fixture code, no dev hook and no staging code in it.

## 12. Not verified

- No real device, no Safari, no iOS. Chromium headless only.
- No frame time or memory measurement.
- The drift, orientation and chaos gates were not run (they belong on Decimus). One rotation mid spin and 30 spins were checked by probe.
- Type checking covered the `.ts` files only; the monorepo has no `svelte-check`.
- Audio was not listened to.
- Social mode: only the Game Info page and the feature menu were swept for banned words.
- Replay mode and resuming an open round were not exercised (the fixtures never leave a round open).
- Touch targets in the feature menu: BUY is 34 px tall on a phone held sideways and the slider's stop labels are 22 to 26 px.
- The 3x density of each asset was worked out, not measured on a screen.
