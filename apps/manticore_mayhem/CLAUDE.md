# Manticore Mayhem (`web-sdk/apps/manticore_mayhem`)

The root `CLAUDE.md` and `tools/BRIEF_RULES.md` apply. This file holds this game's working facts; its rendering,
layout and HUD rules are in `HOUSE_RULES.md` beside this file and in the `slot-house-rules` skill.
An 8 x 8 cluster drop slot with doubling multiplier tiles, forked from Angry Mantis on 2026-09-22. It goes to Stake
as a NEW game, Manticore Unleashed; the folder keeps its old name.

## Where the work happens
- Merge tree: the main web-sdk tree `/Users/corey/Projects/stake-engine/web-sdk` on branch `angry-mantis`
  (upstream `coreyms/angry-mantis`). Corey's dev server runs from this tree on port 3013: never stop it.
- Builders: a worktree `/Users/corey/Projects/stake-engine/web-sdk-wt-<name>` on `wip/<name>` (recent Manticore
  branches end in `m`, for example `wip/ringbackm`, `wip/keym`). The main session merges into `angry-mantis`.
- Probes live in the parent repo (`tools/manticore/`), so a probe change is a paired parent commit by full path.
- Math and the event contract: `math-sdk/games/manticore_mayhem/` (`EVENT_SCHEMA.md` is the contract).
- Changes for the submission are logged in `docs/reviews/manticore-changes-1.0.05.md` (parent repo).
- No spec file is in the repo. The README's old spec path (`~/Projects/manticore/docs/manticore-spec.md`) no longer
  exists and its milestone 1 description is out of date; trust the code, this file and `HOUSE_RULES.md`.

## Ports and running it
- `pnpm dev` = `node scripts/stamp-assets.mjs && vite dev --host --port 3008`. Storybook uses 6008.
- 3013: Corey's main tree server (`vite dev --port 3013 --strictPort`). Leave it running.
- Mock RGS for this game, already running and shared: 8444
  (`math-sdk/env/bin/python -u tools/mock_rgs.py --game manticore_mayhem --port 8444`). 8443 is the mock RGS for
  Angry Mantis. Never stop, restart or reconfigure either.
- Builders start no dev server and run no browser on the Mac. Review agents and the main session may open
  `http://localhost:<port>/?rgs_url=localhost:8444&sessionID=<anything>&lang=en`. Chrome needs a one time
  click-through at `https://localhost:8444/fair/state` (self-signed cert).
- Force an outcome for a session: `curl -sk "https://localhost:8444/debug/force?criteria=<criteria>&session=<sid>"`
  (or `criteria=book:<id>`). `zsh tools/manticore/warm.sh` warms every mode's book cache.

## Dev hook: `window.__manticore` (DEV only)
Set from several components (for example `ui/LandingScreen.svelte`, `ui/Chrome.svelte`, `ui/hud/HudSpin.svelte`).
The hooks each probe reads are in its `// WATCHES:` header.

## Probes and tests
- Folder: `/Users/corey/Projects/stake-engine/tools/manticore/` (index in `tools/manticore/README.md`; it is long,
  read only the section you need). Browser probes are `*.js` and start Chromium through `lib.js`, which adds
  `--mute-audio` on the Mac. Node checks: `*_check.mjs`. Frozen reference files: `tools/manticore/ref/`.
- `lib.js` defaults: `APP=http://localhost:3008`, `RGS=localhost:8444`; other switches `GPU_ARGS`, `SHOTS`, `QUERY`.
- Decimus runs the browser probes. Builders never run them on the Mac. The Mac form, for a run the main session
  makes, from the parent root:
  `tools/browser_lock.sh run game -- nice -n 19 env NODE_TLS_REJECT_UNAUTHORIZED=0 APP=http://localhost:<port> NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules node tools/manticore/<probe>.js`
- Pure node test in the app: from the app folder,
  `node --experimental-strip-types --no-warnings tools/ring_home_test.mjs`.
- Probe impact: `node tools/probe_impact.mjs --repo <worktree> --game manticore` from the parent root.
- Known: `music_loop_probe`'s two failures on Decimus's Linux WebKit are WebKit artifacts, not game faults.

## Build check
From the app folder: `node scripts/stamp-assets.mjs`, `nice -n 19 pnpm build`,
`node scripts/check-production-bundle.mjs` (fails if staging code is in `./build`; `--expect-staging` checks a
`PUBLIC_STAGING=1` build). Type check baseline: 7 errors in infrastructure files.

## Game specific rules
- Masks in code today: the fall-layer mask (`src/components/BoardCells.svelte` line 116) and the searchlight's
  column mask (`src/components/Anticipation.svelte` line 107). Add no others.
- Reviews of Manticore Unleashed are blind: no review history, change logs or past ratings in a review brief.
- Scenario is never used for this game.
- The stinger's tail bulb and barb stay rigid: never smoothed, reoriented or flipped; one pitch-only elbow hinge.
- Full-screen backdrop paintings are exempt from the 3x density rule; everything drawn over them is not.
- Audio: parent `tools/build_audiosprite.py --game manticore_mayhem --out-root <worktree>`; state file
  `tools/audiosprite.manticore_mayhem.state.json`. This game's config reads placeholder music from
  `apps/angry_mantis/static/assets/audio/music`; read only, never edit that folder for Manticore.

## Do not touch
- The four untracked closeup PNGs in `tools/manticore/` (`desktop_1440x900_*`, `iphone_390x844_*`): never committed.
- `static/assets/audio/sounds.mp3` (never committed).
- Math, books and `math-sdk/games/manticore_mayhem/` unless the brief is a math job Corey approved.
- `apps/angry_mantis/`, `packages/` and Reindeer's app, unless the brief names them.
