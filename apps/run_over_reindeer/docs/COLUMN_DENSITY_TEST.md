# Column characters: the sharpness test (`?rescap=`)

Built 2026-11-10 for Corey's device test of the full-column Wilds (reindeer, Santa, Grandma) at more than one sharpness.

## How it works

- `tools/build_columns.py` now builds every clip at four densities, in sheet px per road px: **0.7** (`phone`, the phone default), **1.0** (`full`, the desktop default), **1.5** (`d150`) and **2.15** (`d215`). The new files are `static/assets/columns/<tier>-<clip>-d150-<n>.webp`, `...-d215-<n>.webp` and `cloud-backdrop-d150.webp` / `-d215.webp`. They were added with `--tiers d150,d215`, which leaves the existing 33 files byte for byte as they were (md5 checked) and only adds entries to `src/game/columnClipSpec.ts`.
- Every page is at most 2048 px a side at every density (largest page: 2033 px), so no density is ruled out by a 4096 texture limit. 2.15 simply has more pages (94 in all, against 22 at 1.0).
- **The switch is Manticore's own `?rescap=<n>`** (held to 1 to 3; only on the dev server or a `PUBLIC_STAGING=1` build; a production build ignores it). It already existed in this game (`src/game/deviceTier.ts`, the same code as Manticore's), so the staging lobby's menu works as is. It sets the renderer's resolution cap, as in Manticore, and now also picks the column sheets:
  - the smallest density that gives at least **n sheet px per CSS px** at the road's on-screen scale, capped at 2.15;
  - one step down for each density whose pages are larger than the GPU's largest texture (never happens with 2048 px pages; the readout says so if it does);
  - the pick is made once, when the first column asks for its pictures, and kept for the session. **Reload after rotating a phone.**
- No `?rescap=`: exactly today's sheets (phone tier 0.7, desktop 1.0), today's memory (checked: a Grandma column at 42.9 MB on desktop, 22.3 MB on the phone tier, the same as before).
- The cloud still behind a standing column follows the same density.
- `?perf=1` (also Manticore's, now ported) shows the staging readout in the top left corner. Its new line: `columns: density 1.5 (d150), 2.09 sheet px per CSS px, rescap 2, 89 MB loaded`. The Copy results button includes the same numbers.
- On the dev server, `__reindeer.clipMemory()` gives the same: `size`, `rescap`, `density`, `sheetPxPerCss`, `maxTextureSize`, `note`, each loaded clip's MB and `totalMb`.

## The numbers (measured from the built files: width x height x 4 per page)

| Density (sheet px per road px) | 0.7 (phone) | 1.0 (desktop) | 1.5 | 2.15 |
|---|---|---|---|---|
| Reindeer entrance / idle / win, GPU MB | 7.4 / 14.0 / 13.7 | 11.0 / 28.4 / 24.0 | 24.7 / 56.5 / 53.8 | 50.7 / 116.2 / 110.3 |
| Santa entrance / idle / win, GPU MB | 9.9 / 13.9 / 10.9 | 19.1 / 31.9 / 22.2 | 34.3 / 63.6 / 49.6 | 70.5 / 130.4 / 101.9 |
| Grandma entrance / idle / win, GPU MB | 7.1 / 10.5 / 11.5 | 12.9 / 21.3 / 21.0 | 28.9 / 42.4 / 45.1 | 59.3 / 87.1 / 92.4 |
| Cloud still, GPU MB | 0.3 | 0.7 | 1.5 | 3.0 |
| **Worst case on screen** (all three tiers' idle and win, one entrance playing, the still) | **85 MB** | **168 MB** | **347 MB** | **712 MB** |
| Download, all nine clips | 5.6 MB | 9.1 MB | 15.4 MB | 23.8 MB |
| Pages (files) | 9 | 22 | 54 | 94 |

GPU MB is the decoded texture. The browser can also keep a decoded copy of each sheet in ordinary memory, so a phone's real cost can be up to about twice the figure.

## What each density gives on screen (sheet px per CSS px)

Measured from the board's on-screen scale (`__reindeer.boardLayout()`), not worked out by hand.

| Screen | CSS px per road px | 0.7 | 1.0 | 1.5 | 2.15 |
|---|---|---|---|---|---|
| Desktop 1920 x 1080 | 1.078 | 0.65 | 0.93 | 1.39 | 1.99 |
| Desktop 1280 x 720 | 0.719 | 0.97 | 1.39 | 2.09 | 2.99 |
| Phone upright, 390 x 844 | 0.254 | 2.76 | 3.94 | 5.91 | 8.47 |
| Phone sideways, 932 x 430 | 0.372 | 1.88 | 2.69 | 4.03 | 5.78 |

The brief's figures were right for the desktop and for the phone held sideways. **Phone upright was a little low:** 2.76 / 3.94 / 5.91 / 8.47, not 2.6 / 3.7 / 5.6 / 8 (the 2.6 in `SECOND_PASS_DECISIONS.md` section 3 is the same slip).

## Which sheets each `?rescap=` loads

| Screen | no switch | rescap=1.5 | rescap=2 | rescap=3 |
|---|---|---|---|---|
| Desktop 1920 x 1080 | 1.0 (0.93x) | 2.15 (1.99x) | 2.15 (1.99x, the largest) | 2.15 (1.99x, the largest) |
| Desktop 1280 x 720 | 1.0 (1.39x) | 1.5 (2.09x) | 1.5 (2.09x) | 2.15 (2.99x) |
| Phone upright 390 x 844 | 0.7 (2.76x) | 0.7 (2.76x) | 0.7 (2.76x) | 1.0 (3.94x) |
| Phone sideways 932 x 430 | 0.7 (1.88x) | 0.7 (1.88x) | 1.0 (2.69x) | 1.5 (4.03x) |

So on a phone the four densities are enough: 1.5 is the most a phone ever asks for (347 MB worst case), and 2.15 is never picked on a phone. On a full HD desktop all three switches land on 2.15. Telling rescap 2 from 3 there would need a density of about 3.25, with a worst case of about 1.6 GB, so it was not built. Use a 1280 x 720 window to see 1.5 against 2.15 on a desktop.

## Test plan for Corey (on staging, after the next deploy)

Use the staging lobby's menu (Normal, Readout, Readout cap 2, Readout cap 3), or add `&rescap=<n>` (and `&perf=1` for the readout) to the game's link by hand. For each load, play (or buy a feature) until a column lands. Any Grandma, Santa or reindeer column will do.

1. **Samsung A13, held upright:** Normal, then Readout cap 3 (1.0 sheets, 3.9x). Rescap 1.5 and 2 load the same 0.7 sheets as Normal, so only the renderer's sharpness changes there.
2. **Samsung A13, held sideways** (reload after you turn it): Normal (0.7), Readout cap 2 (1.0), Readout cap 3 (1.5).
3. **Your iPhone, upright and sideways:** the same as 1 and 2.
4. **Desktop:** Normal, then Readout cap 3. At full screen on a 1920 x 1080 monitor every cap gives 2.15; in a smaller window cap 2 gives 1.5.

What to look at:

- The characters' edges and faces (Grandma's glasses, Santa's beard, the antlers): sharper, or no change you can see?
- Whether the character arrives late. If its pictures are not in within 4 s the column stands as its red box and number only. 2.15 has 94 small files; in a software-rendered test browser on a 1920 x 1080 page the idle and win were still loading after 5.5 s.
- Grain or shimmer while a character moves on a small screen. The column sheets have no mip chain, so a sheet drawn well under its own size can look gritty instead of sharper.
- Smoothness in the readout (the dot and Hz) during a Free Spins round with two or three columns up.
- If the readout's columns line ends in a note (for example "over this GPU's 4096"), send a screenshot.

## Before a submission build

- The d150 and d215 sheets sit in `static/assets/columns/` and would be uploaded with a production build (about 39 MB more) even though a production build never asks for them. Remove them, or have the build prune `*-d150-*` and `*-d215-*`, before the submission build.
- `scripts/check-production-bundle.mjs` (this app's own copy) still lists only `ROR_STAGING_BUILD`, `__rorBuild` and `rescap`. A staging build still has all three. The readout's own markers (`ROR_STAGING_PERF_READOUT`, `ror-staging-perf`, `ror-perf`, `worstFramesLater`, `Copy results`, `getHighEntropyValues`) should go back in its list, as its own comment says. Not changed in this task.

## Verified (dev server, one headless Chromium at a time, `tier_grandma` forced, Spin, about 5.5 s)

- 1280 x 720: no switch, rescap 1.5, 2 and 3: `docs/second_pass/columns-rescap-<n>-desktop.jpg`.
- 390 x 844 at device scale 3 (phone tier): no switch, rescap 1.5, 2 and 3: `columns-rescap-<n>-phone.jpg`.
- 932 x 430 at scale 3, rescap 3, and 1920 x 1080 with rescap 2: the picks in the table above (no screenshots).
- `?perf=1` and `?perf=1&rescap=2` at 1280 x 720 show the readout with the columns line: `perf-readout-desktop.jpg`, `perf-readout-rescap-2-desktop.jpg`. No switch shows no readout.
- No console warnings or errors in any run.
- Not verified: a real phone or a real GPU (headless used SwiftShader, about 20 Hz), a `PUBLIC_STAGING=1` build or a production build and its bundle check, a Free Spins round with three tiers up at 2.15.
