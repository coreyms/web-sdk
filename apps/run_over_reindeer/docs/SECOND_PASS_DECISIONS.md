# Run Over Reindeer: second pass decisions (2026-11-09 and 10)

Every decision the build agent took for the second pass (the strikes, the Wilds, the bonus rounds), one line each,
with where to change it. Corey was asleep for this pass: nothing here is his ruling unless it says so. Paths are
inside `web-sdk/apps/run_over_reindeer/`. The first pass file is `FIRST_PASS_DECISIONS.md`.

Live on the dev server: `window.__reindeer.tune` now also holds `strike`, `cloudCell`, `redBox`, `column` and
`round` (change a number in the console, spin). `__reindeer.fixtures.next('<name>')` plays any fixture book by name;
`__reindeer.fixtures.list()` names them all. Screenshots of this pass: `docs/second_pass/` (36, at desktop 16:9,
phone upright and phone sideways). In `FIRST_PASS_DECISIONS.md`, section 6 (feature menu numbers) and section 10
(hand-written fixtures) are replaced by sections 10 and 12 here.

## 0. Corey's rulings on the column Wilds (2026-11-10, after he played this pass)

His words on the pass: "the full column wilds, they look very cool." Three changes, all in `src/game/road/roadFeatures.ts`:

- **No inner lines.** "When they are growing, there are red lines inside of them. We shouldn't have the inner lines." The red box is its outer frame only, growing and held. The lines between a column's rows are removed from the code and from `RED_BOX` (this replaces the spec's note that they were part of the look). The Grandma Wild's one cell box never had any.
- **A still of the smoke behind the character.** "we should take a still image of the smoke to put behind the characters, so it's not plain road behind them in their boxes." One still, wall to wall inside the frame, from the first frame of the entrance until the column leaves: idle and win, base game and held in a bonus round, and on a resumed round.
- **Left over right.** "I would think we want to have an overlap order of left to right, so a column on the far left in column 1 overlaps column 2, 2 over 3, etc." The characters and their spill over draw reel 1 on top, down to reel 5 at the back, in every state and whatever order they arrived in. Every column's multiplier draws above every character.

What the build agent decided to make those work (not his rulings, easy to change):

- **Which still:** the Grandma entrance's source frame 37. Of the three entrances' full-cloud frames it is the only one with no figure in it; the reindeer's and Santa's already carry the silhouette, which would leave a figure shaped hole. Cut to the column's 250 x 684 road px, made fully opaque, one file per asset tier: `static/assets/columns/cloud-backdrop.webp` 250 x 684 (0.65 MB on the GPU, 25 KB to download) and `cloud-backdrop-phone.webp` 175 x 479 (0.32 MB, 17 KB). Built by `tools/build_columns.py` (`BACKDROP`; `--backdrop` builds it alone in a few seconds). Fetched the first time a book calls for any column, then kept for the session.
- **Its tone is dusky, not white** (`COLUMN.backdropTint` `0xa3b6bd`, live in `__reindeer.tune.column`). The entrance clips' own cloud turns a blue gray as it thins (measured on its last cloud frames: reindeer 152,168,172, Santa 180,194,195, Grandma 130,160,175). A white still under it made the box go white, gray, then white again. With the still multiplied to that same tone, the moving cloud fades into a still of its own color: no pop and no second cloud showing through. It also keeps Santa's beard and Grandma's hair off a white ground. `0xffffff` shows the cloud as drawn; `docs/second_pass/columns-backdrop-white-option.jpg` is that look, for comparison.
- **The hand-over:** the still is under the entrance from its first frame, hidden by the clip's opaque cloud, and is first seen as that cloud thins. While the box grows, the cloud inside it is still the tier's own first entrance frame, so the cut from growing to entrance is the same picture.
- **Layers, bottom to top, each across all columns:** the still clouds and any entrance whose cloud is still in the picture; the red frames; the Grandma Wild cells; the characters (reel 1 on top); the multipliers. A neighbor's elbow can cover part of a frame or of another character, never a number.
- **A fault found on the way:** the cloud inside a growing box stayed one cell tall while the box grew (the cropped texture was not marked as changing, so the sprite kept its first size). Fixed; the cloud now fills the box as it grows.
- Verified at desktop 1280 x 720 and phone upright 390 x 844 with `tier_grandma` and `base_three_columns` (and one whole Free Spins round on desktop for held columns), console clean: `docs/second_pass/columns-*.jpg`.

## 1. Departures from the brief

- **Density of the column characters.** The brief asks for 3 physical px per CSS px "if memory allows". It does not: that is 3.2 sheet px per road px on a 1920 x 1080 screen, about 1.6 GB with three tiers up. The sheets are 1.0 px per road px on desktop and 0.7 on phones (section 3).
- **The cloud is cut to the column's width.** The clips were drawn 9:16 and their cloud fills the whole frame, a third wider than a column on each side. Fitted by height, it would cover part of both neighbor columns, so every entrance frame that still has cloud in it is blanked outside the column's own 250 road px, offline. The character itself is never cut.
- **The locked cloud still is used for one cell only.** A column's growing box shows the entrance clip's own first frame (the same cloud a moment later, already without debris), so the cut from the growing box to the entrance is seamless. The locked still `crash_cloud_box_v3.png` is the Grandma Wild's cell and the first beat of a column strike.
- **Fixtures are the math's real books**, not hand-written ones: 21 books from `math-sdk/games/run_over_reindeer/fixtures/showcase_books.json` and two plain spins from `books_base.json`, copied by `tools/import_fixtures.mjs` into `src/fixtures/showcaseBooks.ts`. The first pass's hand-written rounds are gone.
- **The cards are HTML**, on the house black glass panel with Overpass headings. The house style's animated plaque (Manticore's) was removed with the fork, so there is no plaque to put them on.
- **No win tiers, no big win count-up, no max win scene.** A capped round's wrap-up card says MAX WIN and 7,777x; the house max win screen is not built.
- **The dev reindeer demo (`__reindeer.runReindeer`) is gone**: the strike itself runs the placeholder now.

## 2. Rules taken from the contract (version 2026-11-09b), easy to change

- 12 paylines: the first set's lines 1 to 10, 19 and 20 (`src/game/config.ts` `paylines`). Nothing else states the count: the board, Game Info and the fixture check all read that list.
- The frontend's copy of the lines and the paytable agrees with the real books: `tools/check_fixtures.mjs` recomputes all 385 line wins in the 21 fixture books from `config.ts` and finds none different.
- **Not confirmed by Corey yet (the math agent's choices), each read from the book and never assumed by the game:** the reindeer comes out of the left tunnel for the top two lanes and the right tunnel for the bottom two (`strike.side`); Grandma strikes play before Santa strikes (book order); only Grandma strikes double a column (`crossing` events); scatters never land in a held column. If any changes in the math, the game follows with no code change, except the rules copy in `src/game/gameInfoText.ts`.
- Held columns are drawn from each free spin's `held` list alone, so a replay or a resumed round rebuilds them with no other state.
- The multiplier shown on a win is the book's own (`winInfo.wins[].multiplier`), never added up here.
- Ante mode keys are still this frontend's guess: `ANTE_2`, `ANTE_4`, `ANTE_10`. The antes have no books; an Ante spin plays the base books in the fixtures.

## 3. Column characters: the memory budget (`tools/build_columns.py`)

- Source: the nine approved keyed clips, 97 frames of 1920 x 3408 at 24 fps each. All 216 frames used were fetched (none failed).
- Fit: the frame's height is the column's four lanes (684 road px), so a frame is 385 road px wide. The reindeer is 299 road px wide over its antlers, Santa 336, Grandma 308 and 73% of the height. A column is 250: what is wider spills over the neighbors, which the spec asks for.
- Idle: every 3rd frame, 32 frames at 8 fps. The clip's own 4 s loop, held timing.
- Win: every 4th frame, 24 frames at 12 fps: 2 s, twice the clip's speed.
- Entrance: from source frame 37 (the cloud is full, the debris has gone) every 4th frame to the last, 16 frames at 12 fps: 1.33 s. The spec asks for 1.2 to 1.5 s.
- Sheet density: desktop 1.0 px per road px (frames 684 px tall), phone 0.7 (479 px tall). On a 1920 x 1080 screen that is 0.93 sheet px per CSS px; on a 390 wide phone upright 2.6, on a 932 x 430 phone sideways 1.9.
- Corey on these clips (2026-11-04): "It's a basic cartoon, so upscaling is fine and would probably actually improve the look."
- Sheets are WebP quality 85, at most 2048 px a side, handed to the GPU when they finish loading, not on the frame they are first drawn.
- GPU memory per clip, desktop / phone, MB: reindeer entrance 11.0 / 7.4, idle 28.4 / 14.0, win 24.0 / 13.7; Santa entrance 19.1 / 9.9, idle 31.9 / 13.9, win 22.2 / 10.9; Grandma entrance 12.9 / 7.1, idle 21.3 / 10.5, win 21.0 / 11.5.
- Download: 9.1 MB for all nine on desktop, 5.6 MB on phones. Nothing is fetched until a book calls for a tier.
- Worst case on screen (all three tiers standing with their win clips, one entrance playing): 168 MB desktop, 84 MB phone.
- Measured in play (clips loaded at once, `__reindeer.clipMemory()`): one reindeer column 52 MB; a Free Spins round with a reindeer and a Santa column 106 MB; a Super round with one reindeer column 63 MB (all desktop). On the phone sheets: a Santa column 25 MB, a Grandma column 22 MB, a Super round with one Santa column 35 MB, a Free Spins round with a reindeer and a Santa column 70 MB.
- Loading: a tier's entrance, idle and win start loading the moment a book that names the tier arrives (`src/game/road/columnClips.ts`), about 2 s before its first strike lands. The entrance is let go as soon as it has played. Idle and win are let go when the last column of that tier leaves.
- If a tier's pictures are late the box waits on the struck cell for them, at most 4 s (`COLUMN.loadWaitMs`), then the column stands as its box and its number.
- Two columns of one tier share one set of pictures and run their idles 5 frames out of step.
- To change the budget: `PICK` and `TIER_SCALE` at the top of `tools/build_columns.py`, then run it (about 1 minute at low priority).

## 4. The strike (`STRIKE` in `src/game/constants.ts`)

- The runner is still the tagged PLACEHOLDER still (one picture per direction so the tag reads), at 85% of its built size, moving on the book's real path: out of `side`'s tunnel, along `runRow`'s lower line, then the dart into the target's lane.
- It starts 90 ms after the lanes settle, runs at 2700 road px per second (never under 300 ms or over 620 ms), and the last 130 ms carry it into the target's lane. It stops 70 road px short of the target's centre: the impact.
- It hops 14 road px, 4.5 times a second, and darkens in the tunnel's shadow like the traffic.
- A whole Grandma strike is about 0.6 to 1.0 s at normal speed; a column strike adds the box and the entrance, about 2.3 s in all. Turbo and a slam stop shorten both (they run on the road's clock).
- Several strikes play one after another in the book's order.
- The stoplights are untouched: they are red through the strikes (the board has stopped).

## 5. The Grandma Wild (`CLOUD_CELL`)

- The struck car's cell becomes the locked cloud still (a band of it at the cell's own shape), in the red box, with WILD and the multiplier on it. The car under it is not drawn.
- It pops from 50% to 108% and back to size over 170 ms.
- WILD: red letters with a white rim and a dark edge, 44 road px tall, 30% down the cell. The multiplier: 64 road px tall, yellow `#ffd400`, 70% down, written "10x".
- It leaves at the next spin (the press in the base game, the next reveal in a bonus round), fading over 160 ms.

## 6. The red box (`RED_BOX`)

- Drawn by the game as plain colored quads: red `#d6162c`, 9 road px thick, a 3 px dark line around it, 4 px inside the cell's edges.
- Nothing inside the frame: no lines between a column's rows (Corey 2026-11-10, section 0).
- The box stands over the cloud (the cloud is inside it) and under every character once that character's entrance cloud has gone (the character spills over it).

## 7. The column Wild (`COLUMN`)

- The box holds on the struck cell with the cell cloud for 110 ms, then grows to the four rows over 210 ms; the cloud is shown inside it by moving the picture's crop (no mask).
- Then the tier's entrance plays (1.33 s) and the character holds its idle, with the still cloud behind it (section 0).
- Super's opening column has no struck cell: its box grows from the middle of the column.
- The multiplier: atlas digits 74 road px tall, yellow, centred 58 road px above the column's foot, written "5x". It pops in 55% of the way through the entrance.
- Each tier is drawn at the size it was drawn at (`COLUMN.tierScale` 1, 1, 1): Santa covers about 43 road px of each neighbor column, the reindeer about 25 with its antlers. Sizing was left open in the spec.
- A crossing: the number swells to 170% and back over 420 ms, turns white in the middle of the swell and changes to the doubled value at its top. It is timed to the moment the reindeer is level with that column.
- A column a winning line runs through plays its win clip once (2 s), then returns to idle. The line hold is shorter (1.3 s), so the clip finishes over the next spin's start.
- A held column's cells take no traffic; the other symbols keep their own places and stop times, so the spin's length and the stoplights' timing do not change.
- In the base game a column leaves at the next press. A bonus round's columns stay on screen after the wrap-up card until the next press.

## 8. Line wins with Wilds (`LINE_WIN`)

- When any winning line has a multiplier above 1, "x35" stands over the amount: the highest multiplier among the winning lines, atlas digits 58 road px tall, yellow, 78 road px above the amount.
- Only the highest is shown, not one per line.

## 9. The bonus rounds (`ROUND`, `src/ui/RoundCard.svelte`)

- Trigger: the scatters pulse for 900 ms with the borrowed trigger sound, then the intro card.
- Intro card: the round's name, "10 FREE SPINS", one line on what stays, PRESS ANYWHERE TO CONTINUE. Free Spins in turquoise `#19d3da`, Super in red `#ff5a6e`.
- Wrap-up card: the round's name, TOTAL WIN and the round's own total (the book's `freeSpinEnd.amount`).
- Floor top-up, shown plainly on the wrap-up card: "Includes $8.50 added to bring this round up to its 10x minimum." Both numbers are the book's.
- A capped round's card reads MAX WIN with "7,777x the bet, the most a round can pay."
- A card takes no press for its first 450 ms, continues by itself after 4 s (intro) or 6 s (wrap-up), and after 1.4 s when a running autoplay is set to play bonuses through.
- The HUD steps aside while a card is up; the WIN readout stays.
- Spin counter: the title sign turns into a blue sign reading "FREE SPINS 3 OF 10" (red, "SUPER SPINS", in Super). The HUD's own Spin button also shows the house "FREE SPIN 3/10".
- Retrigger: the scatters pulse, then "+3 FREE SPINS" over the board for 1.1 s, and the counter's total grows.
- A free spin starts 160 ms after the one before.
- Music: the borrowed `bgm_bonus` and `bgm_super` during a round, back to `bgm_base` after the wrap-up.
- The HUD's WIN shows the round's running total from the book's `setTotalWin`.

## 10. Feature menu (`src/game/featureMenuData.ts`)

- The dummy rows are gone. The rows are the simulation's figures for the settled rules: base game Free Spins 1 in 211 and Super 1 in 2,110; Ante 2x 1 in 74 and 1 in 1,000; Ante 4x 1 in 41 and 1 in 250; Ante 10x 1 in 45 and 1 in 40; the Super buy's 20x minimum; max win 7,777x at 1 in 2.77 million base spins.
- Marked provisional in code (`ODDS_ARE_PROVISIONAL`) and by a line under the cards: "Figures from the simulation. They are confirmed when the final math is published."
- Rows the simulation has no figure for yet (how often a bought round pays more than it cost) are not shown: the buy cards have three and four rows, the Ante card three.
- The max win odds are stated once under the cards.
- Fit, measured with nothing scrolling and nothing touching: 390 x 844, 375 x 667, 360 x 640, 320 x 568, 844 x 390, 667 x 375 and 1600 x 900. Upright screens under 700 px tall use the tighter type (`tiny` in `src/ui/FeatureMenu.svelte`), and under 740 px each card shows its first three rows.
- Social mode (`?social=true`): the feature menu, the rules text and the round cards were swept for bet, buy, pay, cost, price and the like. The rules text's social wording now follows the house copy rule ("wins", "play amount", "EACH ROUND").

## 11. Number styling

- One set of atlas digits (0 to 9 and x): Overpass Heavy, white with a dark edge 8.5% of the size, built 72 road px cap height, tinted by the game. Each digit on its own width, with the edges of neighbors overlapping a little.
- Never rasterized at run time; the line win's amount is still canvas text set once per win.
- The forged currency glyphs the spec lists are still not made.

## 12. Fixtures and the dev hook

- 24 named rounds over 21 real books: plain_line_win, base_one_column (tier_reindeer), base_two_columns, base_three_columns, tier_santa, tier_grandma, base_grandma_strike, natural_free_spins, natural_super, floor_top_up, floor_top_up_super, one_crossing (grandma_3x, grandma_25x), grandma_100x, two_crossings, retrigger, three_columns_free_spins, super_typical, crossing_to_cap50, max_win, no_win_1, no_win_2.
- With nothing forced, base spins walk through plain spins, each kind of strike and the natural rounds; a bought Free Spins or Super plays that buy's books in turn.
- `__reindeer.fixtures.resume(name, eventIndex)` reloads the page with that round left open at that event, to test a resume.
- `__reindeer.step(ms, n)` with `__reindeer.clock(0)` steps the road by hand; `__reindeer.clipMemory()` lists the loaded clips and their MB.
- The books are untuned showcase rounds and not for upload.

## 13. Sounds borrowed from Manticore (new uses)

- The reindeer's run `sfx_swipe`, its impact `sfx_sting_hit`, a column's box `sfx_sting_big_hit`, a crossing `sfx_tile_double`, the triggers `sfx_bonus_trigger_free` and `sfx_bonus_trigger_super`, the bonus music `bgm_bonus` and `bgm_super`.

## 14. Placeholder

- The running reindeer (a tagged still, no run cycle).
- The present scatter, the sleigh's WILD tag, the title sign, the flat snow, the HUD beds (all from the first pass).
- The round cards' look (plain glass cards).
- Every sound.

## 15. Verified in this pass (headless Chromium, fixture books, console clean in every run)

- Desktop 1280 x 720: base_one_column, base_two_columns, base_three_columns, base_grandma_strike, tier_santa, tier_grandma, one_crossing, retrigger, floor_top_up, super_typical, max_win, and a resume in the middle of a Free Spins round (the held column and its 16x came back, the round finished, the wallet was credited).
- Phone upright 390 x 844: base_grandma_strike, tier_santa, one_crossing (a whole Free Spins round).
- Phone sideways 844 x 390: tier_grandma, base_three_columns, natural_super (a whole Super round).
- The feature menu at the seven sizes in section 10.
- `tools/check_fixtures.mjs`: 21 books, 385 line wins agree with the frontend's 12 lines and paytable.
- The app type check is clean apart from the monorepo's known `.svelte` module noise.

## 16. Not verified

- Any real device, Safari or iOS. Frame times: no trace was taken, on any machine.
- A production build after this pass (`pnpm build`): the dev server was in use, so no build was run beside it.
- Sound by ear: every cue is borrowed and was only checked to fire without an error.
- The Ante modes against real books (there are none), and the real RGS path (`?rgs_url=`).
- The round cards and the counter in social mode on screen (their text was read in source only).
- Autoplay and turbo through a bonus round; a resume inside a Super round or on the wrap-up card.

## 17. Known rough edges

- A line win's amount sits on the middle of its line. When that is the bottom lane of a column Wild, it covers the column's own multiplier for as long as the line shows (`docs/second_pass/landscape-05-super-column-win.jpg`).
- Santa is 336 road px wide in a 250 column: his elbows cover part of the symbols on each side (`landscape-04-super-crossing.jpg`). Next to another column he now covers the one on his right and is covered by the one on his left (section 0).
- When several lines win at once they are all drawn together over the columns, which is busy on a phone (`portrait-06-free-spins-two-held.jpg`).
- At 320 x 568 the three slider stops in the feature menu are 22 px tall, under the 26 px the menu probe asks of a button.

