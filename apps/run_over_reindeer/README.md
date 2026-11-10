# Run Over Reindeer: frontend (first pass)

A 5 x 4, 20 line slot drawn as a sideways four lane road. Forked from `apps/manticore_mayhem` on 2026-11-09.
Svelte 5 runes + Pixi 8, shared packages from `web-sdk/packages`.

- Spec: `docs/run-over-reindeer-spec.md` (parent repo)
- Math and the event contract: `math-sdk/games/run_over_reindeer/` (`EVENT_SCHEMA.md` is the contract)
- House rules: `.claude/skills/angry-mantis-house-rules/SKILL.md` and the slot-game-recipe skill
- Every decision taken in this pass, one line each: `docs/FIRST_PASS_DECISIONS.md`
- Screenshots of this pass: `docs/first_pass/`

## Run it

```sh
pnpm install          # once: registers this app in the workspace (see "Workspace" below)
pnpm dev              # http://localhost:3014
```

Open `http://localhost:3014/?lang=en&sessionID=anything`. With no `rgs_url` in the address the dev server plays the
local fixture rounds (below). Ports 3007 / 3008 / 3013 and 8443 / 8444 belong to the other games.

## What the first pass is

- The house HUD, splash, landing screen, sound plumbing, layout system and dev hook, taken from Manticore Mayhem.
  Manticore's creature, courtyard scene, tiles, plaque, feature menu and win screens are gone, not switched off.
- The board: the locked background `road_tunnels_phone_v12.png`, four lanes, symbols that sit on their lane's lower
  edge with lower lanes drawn in front. The spin is traffic: the top two lanes drive left to right, the bottom two
  right to left, in from one tunnel and out the other (`src/game/road/roadBoard.ts`).
- Line wins shown on the board, the HUD win, the wallet.
- The feature menu (The Fast Lane): Free Spins buy, Super buy, one Ante card with a three stop slider. Its odds rows
  are DUMMY numbers (`src/game/featureMenuData.ts`).
- NOT in this pass: the reindeer strikes, the Wilds' multipliers, the column Wild reveals, the bonus rounds, the win
  plaque, the max win screen. Their book events already have handlers that play through without drawing anything.

## Fixture rounds (dev only)

`src/fixtures/fixtureRounds.ts` holds eight hand-written books in the shape of `EVENT_SCHEMA.md`. On the dev server,
`src/fixtures/fixtureRgs.ts` answers the game's own RGS requests from them inside the page, so a round runs through
the same path a real RGS drives: Authenticate, `/wallet/play`, the book events, `/wallet/end-round`.

```sh
node --experimental-strip-types tools/check_fixtures.mjs   # every fixture's picture agrees with its payout
```

To play against real books once the math has some, start the mock RGS for this game on a free port and name it:
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
| `runReindeer(row)` | run the PLACEHOLDER reindeer along a lane |
| `fixtures.list()`, `.next(name, sticky)`, `.queue(events, pays)`, `.latency(ms)`, `.log()`, `.clear()` | the fixture rounds |
| `notPresented()` | the feature events a book carried that this build does not draw yet |

## Art

`tools/build_assets.py` (math env Python) builds everything under `static/assets/road`, `static/assets/symbols` and
`static/assets/fonts/overpass` from the source images on the Desktop, and writes `src/game/roadArtSpec.ts` (the
measured lane lines, tunnel mouths and symbol sizes). It only reads the sources. Run it again when a source changes.

## Workspace

The monorepo's `pnpm-workspace.yaml` already takes `apps/*`, so nothing was added to it. This folder's
`node_modules` was linked by hand for the first pass, and `pnpm-lock.yaml` has no entry for this app yet: run
`pnpm install` in `web-sdk` once to add it (it will also want to rewrite one unrelated `@lingui/core` entry).
