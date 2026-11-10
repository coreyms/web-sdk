# Run Over Reindeer: third pass decisions (2026-11-10)

The game brought in line with Corey's rulings of 2026-11-10 and the math's contract 2026-11-10a (variant F + C). One
line per decision, with where to change it. Nothing here is Corey's ruling unless it quotes him. Paths are inside
`web-sdk/apps/run_over_reindeer/`. Screenshots: `docs/third_pass/` (57). `desktop-*` were taken BEFORE the desktop
road was shrunk (section 1b) and still show every feature case; `shrunk-1280-*`, `shrunk-1920-*` and
`shrunk-1280x800-*` are the desktop layout as it is now; `portrait-*` and `landscape-*` are the phones (`-10` and `-04`
after the shrink, unchanged). Earlier passes: `FIRST_PASS_DECISIONS.md`,
`SECOND_PASS_DECISIONS.md` (its sections 4 and 7's crossing line, and section 2's tunnel and crossing rules, are
replaced by sections 1 to 4 here).

## 0. Departures from the brief

- **Desktop had almost no snow above the road** (68 master units under the top bar, half of it behind the title over
  reels 2 to 4; `desktop-10-red-box-hold-behind-title.jpg`). Corey chose the shrink (section 1b).
- **One extra hook entry and one extra mark**: `__reindeer.perfMarks()` (the staging readout's label ring, for the
  probes) and the `upload:` marks (section 5). No new global.
- **The rules copy changed** (`src/game/gameInfoText.ts`, `src/game/config.ts`): it described the doubling, which is
  gone. It now gives the variant F + C column starts and the rare 30x / 50x starts.
- `FIXTURES_2026-11-10a.md` sits in `math-sdk/games/run_over_reindeer/`, not inside the fixtures folder.

## 1. The strike's path (`STRIKE` in `src/game/constants.ts`, `strike()` and `updateRunner()` in `src/game/road/roadFeatures.ts`)

Corey 2026-11-10: "the reindeer would enter from above the board running parallel in the snow then turn downward when
it's going to strike something. This gives us some player anticipation."

- The book now says only `{target, cell, reel}`. The game runs: in at one end of the snow bank, along it, a braking
  stop above the target's reel, a hold, the turn, straight down the screen into the target cell, the impact.
- **Placeholder look:** the same tagged side-view still. In the hold it crouches to 90% of its height
  (`crouch`); the turn leans it head down to 90 degrees about its middle (`downAngle`); on the way down it grows from
  its snow size to its road size (`roadScale` 0.85), since it is coming toward us. No run cycle, no front view: those
  come with the rig's clips.
- **Entry side** `entry: 'far'`: it comes in at the end farther from the target's reel (reels 1 and 2 from the right,
  3 to 5 from the left), so it always crosses at least half the board and the player watches for where it turns.
  `'near'`, `'left'` and `'right'` are the other settings.
- **Run height per layout** `snow.<layout>` = feet line (road px from the picture's top; the top lane line is 167)
  and size in the snow:
  - landscape (desktop) `feetY 150, scale 0.72` since the shrink (section 1b); it was `feetY 165, scale 0.5`.
  - phone (sideways) `feetY 100, scale 0.8`: feet on the foot of the snow bank; the screen shows 229 road px of snow
    above the top lane and nothing covers it.
  - portrait `feetY 70, scale 0.85`: in the snow field, over 500 road px of it under the title.
- **Timings** (road clock, normal speed; turbo and a slam stop shorten them as before):
  - `leadInMs` 90 after the lanes settle (unchanged).
  - along the snow: 2800 road px per second, held to 260 to 480 ms (`runSpeed`, `runMinMs`, `runMaxMs`); the last
    30% brakes to a stop (`brakeShare`). With the far entry every run is 314 to 480 ms.
  - the anticipation hold above the reel: `holdMs` 140. Long enough to read which reel, short enough that three
    strikes in a spin do not drag.
  - the turn: `turnMs` 90.
  - down the screen: 2600 road px per second, quickening, held to 130 to 280 ms (`downSpeed`, `downMinMs`,
    `downMaxMs`); the impact is when its middle reaches the middle of the target cell (`impactAt` 0.5).
  - fades into the cloud over `fadeMs` 120 (unchanged).
- **What changed in a spin's length:** a strike now takes 0.76 to 1.08 s from the lanes settling to its impact, against
  0.39 to 0.71 s before: about 0.37 s more per strike at normal speed (a spin with three Santa strikes is about 1.1 s
  longer). The new path forces it: the hold and the turn are the anticipation Corey asked for. The traffic spin (press
  to settle) and the stoplight timing are unchanged.
## 1b. The desktop road shrunk 11% for the run (`ROAD_LAYOUT.landscape` in `src/game/layoutSpec.ts`)

Corey 2026-11-10, on "shrink the road about 11 percent to show snow": "Yes... don't worry about the title sign yet,
since that's just a placeholder, but it looks pretty good".

- The road picture is 982 master units wide (was 1104), centred across as before (`centreX` 640). The board is 799 of
  the 1280 (was 898).
- **All the freed height went above the road** (`centreY` 379.3, was 352): the bottom lane line stays on y 596, exactly
  where it was over the HUD's bottom row (top 610), and the top lane line comes down from 104 to 159. Why: the snow
  band is only wanted above the road, and splitting would have left a strip under the bottom lane that nothing uses
  and moved the board's foot against the HUD. The picture's own bottom edge (y 707) is under the HUD's bottom bed.
- The snow above the road is now 123 master units under the top bar (was 68), 89 of them under the title sign.
- **The reindeer's run there:** `STRIKE.snow.landscape` `feetY 150, scale 0.72`: 137 road px, 88 master units tall,
  feet on the shoulder above the top lane. It no longer needs the half size rule; over reels 2 to 4 only its antler
  tips pass behind the title sign (`shrunk-1280-03-hold-above-reel-3-under-the-title.jpg`). The title sign is not
  touched. At the road's own 0.85 it would run into the sign, so the snow size stays a little smaller and it grows to
  0.85 on the way down as before.
- **The HUD did not move.** The readout row (BALANCE / WIN / SPIN) was keyed to the board's edges held inside
  `TRIO_CLEAR` (234 to 1026); the old board was wider than that on both sides, so it always came out 234 to 1026. The
  shrunk board (240 to 1039) would have moved its left end by 6, so `landscapeTrioSpan()` now returns `TRIO_CLEAR`
  itself: the same row as before.
- Everything drawn in the road's own container follows with no change: the tunnels and the rock, the stoplights (by
  the tunnel mouths, per layout), the column Wilds, the cloud cells, the win lines and the runner. The round cards are
  HTML centred on the screen, not on the road, and did not move. The HUD's dark beds are master units and did not move.
- Taller desktop screens (16:10 to 3:2) show the same layout with more snow above it (`shrunk-1280x800-*`); wider than
  16:9 shows more rock at the sides.
- The phones are untouched: `ROAD_LAYOUT.phone` and `portrait` are their own entries, and the only shared constant is
  `STRIKE.snow`, which is per layout. Their frames after the shrink match the earlier ones except the clock
  (`portrait-10`, `landscape-04`).

## 1c. Notes on the strike

- The tunnel shadow tint on the runner is gone (it never passes a tunnel now).
- The swipe sound still plays at the strike's start (sounds were not in this pass).

## 2. Strike order

- Played in the book's written order, never sorted. Every book checked (`tools/check_fixtures.mjs`, new check) is
  Grandma first, then Santa, each left to right. Nothing in the app depended on the old order: the columns draw reel 1
  on top whatever order they arrive in. `multi_reel_strikes` plays Grandma reel 2, Grandma reel 4, then Santa reel 1
  (`desktop-16` to `19`).

## 3. Same reel, Grandma and Santa: the red box

Corey 2026-11-10: "It doesn't need to strike the grandma, we could draw a red box around the grandma when it happens
though, that gets covered by the santa strike column wild".

- The strike handler reads the Santa strike's own `columnWild.grandma` (the next event); when she is a car
  (`wasWild` false) her cell gets the red box the moment the reindeer starts down.
- It is the same `RedBox` as the column's frame (`RED_BOX` red `#d6162c`, its dark edge, 4 px inset): plain quads.
- It sits under the column's own layers, so the column's growing cloud covers it as the box passes her row, and it is
  removed when the column's entrance starts (and at the next spin, if anything is left).
- `wasWild` true (never under variant F): her Grandma Wild cell leaves as the column covers the reel, and the column's
  number first shows its own value, then the sum `COLUMN.joinMs` 420 ms after it popped in, with a second pop. Not
  seen on screen: no book has it.

## 4. No crossing

Corey 2026-11-10: "I don't think the column wilds should ever multiply from their original set value."

- A held column keeps the number it landed with. `syncHeld` never changes it; a book that disagrees is a DEV console
  warning and the number on screen stays. The probes sampled every standing column's multiplier every 25 ms through
  whole rounds: no change in any round played.

## 5. The column pictures' upload queue (Corey's iPhone `?perf=1` runs of 2026-11-10)

FACT from his runs: steady 58 Hz, with a cluster of 50 to 87 ms frames the first time a column lands, marked
`load:reindeer:reveal load:reindeer:win load:reindeer:idle` in the same or neighboring frames.

- **Fetch:** unchanged, and already as early as the book allows: the moment the book arrives (`preloadForEvents`), all
  of its tiers' clips start fetching. Nothing is fetched before a book calls for a tier.
- **Upload:** every sheet now waits its turn in one queue (`src/game/road/columnClips.ts`, `COLUMN.upload`): one sheet
  at a time, at least `gapMs` 120 ms and a whole frame after the one before; the entrance first, then the cloud still,
  then idle, then win, each in the order asked; never during an impact's frames (the run down and the fade, a Grandma
  Wild's pop, a column's box landing and growing) for up to `quietMaxMs` 1200, unless a column is waiting on that very
  picture, which goes at once. A clip is handed out only when all its sheets are up, so nothing uploads on first draw.
- **Fallback kept:** a column still stands as its box and its number if its pictures are more than
  `COLUMN.loadWaitMs` late.
- **Marks:** `load:<tier>:<clip>` as before, plus `upload:<tier>:<clip>:<sheet>/<sheets>` (and `upload:backdrop`)
  when a queued upload starts.
- **Lead time** (measured, `base_three_columns`, first column on reel 2, normal speed): the book is in about 0.25 s
  after the press and the first column needs its entrance at 2.80 s, so about 2.55 s to fetch and upload, the same in
  all three layouts (they differ only in the run down, under 60 ms). The new path gives this strike about 0.48 s more
  than the old one did. On the headless page all six sheets were up 1.15 s after the press, 150 ms apart, entrance
  first, during the traffic's drive in and before the reindeer appeared.
- **Measured (headless Chromium on the Mac, software GL; only indicative, the real check is his phone), worst frame
  from the press to 2.5 s after the first column stands, same round, cold page:** phone upright 390 x 844 (phone
  sheets) 18 ms before and 18 ms after; desktop 1280 x 720 (full sheets, a 33 ms median on this renderer) 100 ms
  before, 83 ms after. The headless page does not reproduce the iPhone's hitch, so it cannot show the fix.
- Decision recorded: phones keep the 0.7 sheets by default (Corey: "we could probably do the 2.4 on the columns for
  phone, I can't see that much of a difference"); the default pick is unchanged, and the 1.5 and 2.15 sheets stay for
  his desktop look (`?rescap=`).

## 6. Open for Corey

- The entry side: always the far end (`entry`), or the near end for shorter strikes.
- The hold above the reel: 140 ms (`holdMs`), and whether the strike's extra 0.37 s is right at normal speed.
- The placeholder's turn: leaning head down (`downAngle` 90) until the rig's turn and down-the-screen clips exist.
- Phone sideways and portrait run sizes (`snow.phone`, `snow.portrait`).

## 7. Deletions (code only; no asset files deleted)

- `src/game/typesBookEvent.ts`: the `crossing` event type; `strike.side`, `runRow`, `dart`, `passes`;
  `columnWild.grandmaCell`, `grandmaWalksOut`, `grandmaAdd` (replaced by `grandma {cell, wasWild, add}`).
- `src/game/bookEventHandlerMap.ts`: the `crossing` handler and the `following` helper that collected a strike's
  crossings.
- `src/components/Board.svelte`: the `boardCrossing` event and its handler, and the crossing's sound cue
  (`sfx_tile_double` stays in the borrowed sound sheet, unused).
- `src/game/road/roadFeatures.ts`: `crossing()`, `startBeat()`, the column's `beatAt` / `beatTo`, the runner's
  crossing beats, the number's swell and white flash, the old tunnel-lane-dart path and its tunnel shadow tint.
- `src/game/constants.ts`: `STRIKE.dartMs`, `stopShort`, the old `runSpeed` / `runMinMs` / `runMaxMs` values,
  `scale` (now `roadScale`); `COLUMN.crossingScale`, `crossingMs`, `crossingTint`.
- `src/game/gameInfoText.ts`: the two sentences on doubling.
- The fixture rounds `one_crossing`, `two_crossings`, `crossing_to_cap50` (gone from the math's set).

## 8. Fixtures

- `tools/import_fixtures.mjs` reads `math-sdk/games/run_over_reindeer/fixtures_2026-11-10a/`: 27 rounds over 25 real
  books. New: `column_30x`, `column_50x`, `grandma_red_box`, `multi_reel_strikes`, `wild_line_three_columns_scatter`,
  `wild_line_then_scatter`. The bonus and Super walks in `src/fixtures/fixtureRgs.ts` use them.
- `tools/check_fixtures.mjs` now also checks: no event outside the contract, no old strike or column field, `reel` =
  `cell // 4`, strike order, the `grandma` object's cell is in its reel, a held column's number never changes. All 25
  books pass; 567 line wins agree with the 12 lines and the paytable.

## 9. Verified (one headless Chromium page at a time, console clean in every run)

- Desktop 1280 x 720: a strike on a top lane (`tier_santa`) and a bottom lane (`base_grandma_strike`), stepped frame by
  frame through every phase; a Santa column; a Grandma column with the red box (`tier_grandma`); strikes in several
  reels (`multi_reel_strikes`, a whole Super round, Grandma first then Santa); a 30x column (`column_30x`, a whole Free
  Spins round); whole rounds with held columns (`grandma_red_box`, `three_columns_free_spins`, `super_typical`), no
  multiplier changed after it landed; the line of Wilds with three columns then a scatter on reel 4
  (`wild_line_three_columns_scatter`, "x90" over the amount, 50 + 30 + 10).
- Phone upright 390 x 844: the strike path (top and bottom lane) and the red box. Phone sideways 844 x 390: the strike
  path and the red box.
- The upload queue's order and spacing from the marks (section 5).
- After the shrink: desktop 1280 x 720 and 1920 x 1080 (the strike in the snow, the hold above a reel, the turn, the run
  down, a Santa column, a whole Free Spins round with three held columns and both round cards), 1280 x 800, and the
  phones once each. Console clean.
- A `PUBLIC_STAGING=1` build with `check-production-bundle.mjs --expect-staging`: pass (all 4 staging markers). A
  production build with the plain check: pass (no staging code). The fixture RGS still runs on the dev server. Both builds and
  both checks were run again after the shrink: pass.
- The app type check is clean apart from the monorepo's known `.svelte` module noise.

## 10. Not verified

- Any real device, Safari or iOS; the upload queue's effect on the iPhone hitch (headless cannot show it).
- `wild_line_then_scatter`, `column_50x`, `natural_super`, `max_win` and the resume path were not played in this pass.
- A Grandma Wild joining a column's number (`wasWild` true): no book has it.
- Turbo and slam stop through the new strike path (they run on the road's clock, so they should shorten it).
- Tablets and desktop screens narrower than 16:9 (16:10 shows more snow; not looked at).
