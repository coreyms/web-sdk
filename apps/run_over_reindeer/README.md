# Run Over Reindeer: frontend (second pass)

A 5 x 4, 12 line slot drawn as a sideways four lane road. Forked from `apps/manticore_mayhem` on 2026-11-09.
Svelte 5 runes + Pixi 8, shared packages from `web-sdk/packages`.

- Spec: `docs/run-over-reindeer-spec.md` (parent repo)
- Math and the event contract: `math-sdk/games/run_over_reindeer/` (`EVENT_SCHEMA.md` is the contract)
- House rules: `.claude/skills/angry-mantis-house-rules/SKILL.md` and the slot-game-recipe skill
- Every decision taken, one line each: `docs/FIRST_PASS_DECISIONS.md` (board, spin, HUD, stoplights) and
  `docs/SECOND_PASS_DECISIONS.md` (strikes, Wilds, bonus rounds, memory, what was and was not verified)
- Screenshots: `docs/first_pass/`, `docs/second_pass/`

## Run it

```sh
pnpm install          # once: registers this app in the workspace (see "Workspace" below)
pnpm dev              # http://localhost:3014
```

Open `http://localhost:3014/?lang=en&sessionID=anything`. With no `rgs_url` in the address the dev server plays the
local fixture rounds (below). Ports 3007 / 3008 / 3013 and 8443 / 8444 belong to the other games.

## What is built

- The house HUD, splash, landing screen, sound plumbing, layout system and dev hook, taken from Manticore Mayhem.
  Manticore's creature, courtyard scene, tiles, plaque, feature menu and win screens are gone, not switched off.
- The board: the locked background `road_tunnels_phone_v12.png`, four lanes, symbols that sit on their lane's lower
  edge with lower lanes drawn in front. The spin is traffic: the top two lanes drive left to right, the bottom two
  right to left, in from one tunnel and out the other (`src/game/road/roadBoard.ts`). Two stoplights follow the spin.
- Line wins on the 12 lines, with the summed Wild multiplier over the amount, the HUD win, the wallet.
- The reindeer strike, the Grandma Wild cell, the three column Wilds with their red box, entrance, idle and win
  clips, and crossings that double a column (`src/game/road/roadFeatures.ts`, clips loaded on demand by
  `src/game/road/columnClips.ts`).
- Free Spins and Super Free Spins: intro and wrap-up cards (`src/ui/RoundCard.svelte`), the spin counter on the
  title sign, held columns, retrigger, the floor top-up, the max win card, resume in the middle of a round.
- The feature menu (The Fast Lane): Free Spins buy, Super buy, one Ante card with a three stop slider, with the
  simulation's odds (`src/game/featureMenuData.ts`, marked provisional).
- NOT built: win tiers and the big win count-up, the max win scene, the reindeer's run cycle (a still slides), final
  sounds (all borrowed from Manticore), the Ante modes' books.
- Outcomes only ever come from book events (`src/game/bookEventHandlerMap.ts`). Nothing here works a win out.

## Fixture rounds (dev only)

`src/fixtures/showcaseBooks.ts` holds 24 named rounds over 21 real books, copied from
`math-sdk/games/run_over_reindeer/fixtures/` by `tools/import_fixtures.mjs` (run it again when the math writes new
books). On the dev server, `src/fixtures/fixtureRgs.ts` answers the game's own RGS requests from them inside the
page, so a round runs through the same path a real RGS drives: Authenticate, `/wallet/play`, the book events,
`/wallet/end-round`. With nothing forced, spins walk through the books in `FIXTURE_ORDER`.

```sh
node tools/import_fixtures.mjs                              # copy the math's showcase books in again
node --experimental-strip-types tools/check_fixtures.mjs   # every line win agrees with the frontend's lines and pays
```

To play against the mock RGS instead, start it for this game on a free port and name it:
`?rgs_url=localhost:<port>&sessionID=<anything>&lang=en`. A named `rgs_url` switches the fixtures off.

## Dev hook

`window.__reindeer` (dev server only):

| | |
|---|---|
| `tune` | every tunable number, live (`src/game/constants.ts` `TUNE`): change one and spin |
| `tuneJson()` | the whole set as JSON, to paste back into `constants.ts` |
| `clock(rate)` | slow or freeze the board's own time: `clock(0.1)`, `clock(0)`, `clock(1)` |
| `road()` | what is drawn: `board[reel][row]`, drift off the marks, sprites by phase |
| `atRest()`, `board()`, `gameType()`, `boardLayout()` | state for the probes |
| `setBoard(board)` | put any board up at rest |
| `signal(color)` | hold both stoplights on `'red'`, `'amber'`, `'green'` or dark (`null`); no argument hands them back |
| `step(ms, n)` | with `clock(0)`: step the road by hand, `n` steps of `ms` |
| `clipMemory()` | the column clips loaded right now and their GPU MB |
| `fixtures.list()`, `.next(name, sticky)`, `.queue(events, pays)`, `.latency(ms)`, `.log()`, `.clear()` | the fixture rounds: `fixtures.next('max_win')` plays that book on the next spin |
| `fixtures.resume(name, eventIndex)` | reload with that round left open at that event, to test a resume |

## Art

`tools/build_assets.py` (math env Python) builds everything under `static/assets/road`, `static/assets/symbols` and
`static/assets/fonts/overpass` from the source images on the Desktop, and writes `src/game/roadArtSpec.ts` (the
measured lane lines, tunnel mouths and symbol sizes). It only reads the sources. Run it again when a source changes.

`tools/build_columns.py` builds the nine column character clips (entrance, idle, win for the reindeer, Santa and
Grandma) into sheets under `static/assets/columns` at two sizes, and writes `src/game/columnClipSpec.ts`. The frame
pick and the sizes are `PICK` and `TIER_SCALE` at its top; the memory each choice costs is printed when it runs and
listed in `docs/SECOND_PASS_DECISIONS.md` section 3. It also builds the still cloud that stays behind a standing
column (`cloud-backdrop.webp`; `--backdrop` builds that alone). Run both tools at low priority: `nice -n 19 <python> tools/...`.

## Workspace

The monorepo's `pnpm-workspace.yaml` already takes `apps/*`, so nothing was added to it. `pnpm-lock.yaml` carries a
hand-added importer entry for this app (web-sdk 9d1a192). Do not regenerate the lockfile for it: a plain
`pnpm install` also wants to rewrite one unrelated `@lingui/core` entry.
