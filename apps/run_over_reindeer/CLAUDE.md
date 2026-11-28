# Run Over Reindeer (`web-sdk/apps/run_over_reindeer`)

The root `CLAUDE.md` and `tools/BRIEF_RULES.md` apply. This file holds this game's working facts; its rendering,
layout and HUD rules are in `HOUSE_RULES.md` beside this file and in the `slot-house-rules` skill.
A 5 x 4, 12 line slot drawn as a sideways four lane road, forked from Manticore Mayhem on 2026-11-09.

## Where the work happens
- Merge tree: `/Users/corey/Projects/stake-engine/web-sdk-wt-symtap` on branch `wip/stage` (pushed to
  `coreyms/wip/stage`; no local upstream is set). The main session merges builders' branches here.
- The copy of this app in the main `web-sdk` tree (branch `angry-mantis`) is out of date. Never build, probe or
  edit Reindeer there.
- Builders: a worktree `/Users/corey/Projects/stake-engine/web-sdk-wt-<name>` on `wip/<name>`, branched from
  `wip/stage`. Two agents may share this app only in separate worktrees, for unrelated jobs.
- Spec: `docs/run-over-reindeer-spec.md` (parent repo). Decisions: `docs/FIRST_PASS_DECISIONS.md`,
  `docs/SECOND_PASS_DECISIONS.md`, `docs/THIRD_PASS_DECISIONS.md` (this app).
- Math and the event contract: `math-sdk/games/run_over_reindeer/` (`EVENT_SCHEMA.md` is the contract).

## Submission
- Reindeer goes back to Stake as the same game, with a change-log write-up (Corey: "Change-log write up").
- Once the improvements are done, one blind harsh review runs first (job type review in `tools/BRIEF_RULES.md`).
- Only Corey uploads to Stake.

## Ports and running it
- `pnpm dev` = `node scripts/stamp-assets.mjs && vite dev --host --port 3014`. Storybook uses 6014.
- Builders start no dev server and run no browser on the Mac. Review agents and the main session may: servers on
  this Mac have been started as `npx vite dev --port <port> --strictPort` from the app folder (this skips
  stamp-assets: run it first).
- Open `http://localhost:<port>/?lang=en&sessionID=anything`. With no `rgs_url` the dev server plays the local
  fixture rounds (`src/fixtures/`), through the same request path a real RGS drives.
- Against the mock RGS: start it for this game on a free port and add `rgs_url=localhost:<port>`. Never use 8443 or
  8444 for Reindeer (other games).
- Fixtures: `node tools/import_fixtures.mjs` copies the math's showcase books in again;
  `node --experimental-strip-types tools/check_fixtures.mjs` checks every line win agrees with the frontend.
- Social mode: `?social=true`.

## Dev hook: `window.__reindeer` (DEV only)
- `tune` (live `TUNE` numbers from `src/game/constants.ts`), `tuneJson()`, `clock(rate)`, `step(ms, n)`, `road()`,
  `atRest()`, `board()`, `gameType()`, `boardLayout()`, `setBoard(board)`, `signal(color)`, `clipMemory()`.
- `fixtures.list()`, `.next(name, sticky)`, `.queue(events, pays)`, `.latency(ms)`, `.log()`, `.clear()`,
  `fixtures.resume(name, eventIndex)` for a resume test. More hooks are listed in each probe's WATCHES header.

## Probes and tests
- Folder: `apps/run_over_reindeer/tools/` in the worktree you test. Browser probes are `*_probe.mjs` (each has a
  `// WATCHES:` header); pure node tests are `*_test.mjs`, `*_check.mjs` and `check_fixtures.mjs`.
- Pure node tests run anywhere, no browser, from the app folder:
  `node --experimental-strip-types --no-warnings tools/<x>.mjs`
  (for example `win_odometer_test.mjs`, `ring_home_test.mjs`, `wheel_peg_check.mjs`, `led_currency_check.mjs`).
- Browser probes use a dev server that is already running; they never start one. Decimus runs them. Builders
  never run them on the Mac. The Mac form, for a run the main session makes, from the app folder:
  `/Users/corey/Projects/stake-engine/tools/browser_lock.sh run game -- nice -n 19 env NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:<port> node tools/<name>_probe.mjs`
  Common switches: `ONLY=a,b`, `SKIPFS=1`, `SHOTS=<dir>`.
- Every probe launches Chromium with `--mute-audio` (`crosshair_probe.mjs` and `strike_probe.mjs` since 2026-11-21).
- Probe impact: `node tools/probe_impact.mjs --repo <worktree> --game reindeer` from the parent root.

## Build check
From the app folder: `node scripts/stamp-assets.mjs`, `nice -n 19 pnpm build`,
`node scripts/check-production-bundle.mjs` (fails if staging code is in `./build`; `--expect-staging` checks a
`PUBLIC_STAGING=1` build the other way). Type check baseline: 7 errors in infrastructure files.

## Art and sound
- `tools/build_*.py` rebuild art from the source images in `art-src/` (this app; roots in `tools/_paths.py`,
  `ROR_ART_SRC` points them at another copy) and write spec files (`src/game/roadArtSpec.ts`,
  `src/game/columnClipSpec.ts`). Run them only when the brief says, as
  `nice -n 19 /Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/<script>.py`.
- `art-src/` keeps the Desktop folder's layout, is outside git for now (about 7.5 GB; a second copy is being
  arranged) and holds the fonts in `art-src/_fonts`. The LED face and Wild chains write their intermediate files
  there too. The Desktop folder `Run Over Reindeer` is Corey's drop and decision space only: no build reads it.
- Audio: parent `tools/build_audiosprite.py --game run_over_reindeer --out-root <worktree>`; state file
  `tools/audiosprite.run_over_reindeer.state.json` (parent repo). Without `--out-root` it writes into the main tree.

## Do not touch
- `pnpm-lock.yaml`: it carries a hand-added importer entry for this app; never regenerate it (a plain
  `pnpm install` also rewrites an unrelated `@lingui/core` entry).
- Locked art (for example the board background `road_tunnels_phone_v12.png`) and any approved art: no AI edits.
- `static/assets/audio/sounds.mp3` (never committed) and `tools/__pycache__/` (untracked, keep it out of commits).
- Math, books and `math-sdk/games/run_over_reindeer/` unless the brief is a math job Corey approved.
- Manticore's app, `apps/angry_mantis/` and `packages/`, unless the brief names them.
