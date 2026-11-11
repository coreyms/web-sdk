# The intro card clips, re-recorded on the current build (2026-11-10)

Corey: "yes" to re-recording the scatters, features and clusters cards (the old sun War Standard and the old WILD coin).

## How they were made (the originals' own pipeline)

The originals came from `~/Desktop/Manticore Mayhem/images/intro_cards_r8` (scatters, features) and `intro_cards_r9b`
plus a turn at frame 379 (clusters, commit 8699b33, "round 10"). Their pipeline was copied unchanged (read only) and is
now kept with the probes in `tools/manticore/intro_cards/`:

- `r5/run.js`: the ten board takes (line, ell, wild, tiles, four, five, six, sting, swipe, roar), hand authored book
  events (`scenes.js`, fixed seeds, so the same rounds record again), played through `__manticore.playEvents` with the
  page clock frozen and stepped at 30 fps, one clipped page screenshot of the board per frame at 1920 x 1080 at 2x,
  the cluster readouts and both creature nodes hidden (`HIDE_LABELS=1 HIDE_CREATURE=1`). No HUD is inside the clip.
- `r9/run_maxwin.js`: the clusters card's MAX WIN take, `PLACE=958.5,491.75,0.4286 PLAQUE_AT=4.0` (round 9b's placement;
  the current Stinger fills the window as before, its corner manticores' tops behind the card frame).
- `r7/edit.js`: the cut (same EDL, crops, 0.3 s dissolves, loop seam, 640 x 260 at 30 fps, x264 main, the crf ladder
  under 590,000 bytes, posters). Clusters then turned at frame 379 as round 10 did and encoded at crf 33 (the ladder
  picks crf 35, 627,219 bytes, for the unturned clip), poster at 2.5 s on the MAX WIN plaque as round 10's.
Every take was kept on the first attempt: board invariant ok, no hot update, no page error, hidden layers off.
The scatters takes land on the same frames as before (reveal landed 9.367 / 11.933 / 11.983 s); the tiles take is
12 frames shorter overall, inside the segments used.

## The files (old -> new bytes; 640 x 260, 30 fps, x264 main yuv420p tv, faststart)

| file | frames old / new | bytes old / new | crf |
|---|---|---|---|
| card-clusters.mp4 | 469 / 469 (15.633 s) | 808,017 / 824,373 | 33 / 33 |
| card-scatters.mp4 | 404 / 404 (13.467 s) | 531,279 / 531,717 | 33 / 33 |
| card-features.mp4 | 319 / 319 (10.633 s) | 578,609 / 576,747 | 32 / 32 |
| card-clusters-poster.jpg | | 62,459 / 54,358 | |
| card-scatters-poster.jpg | | 68,065 / 68,859 | |
| card-features-poster.jpg | | 46,049 / 45,859 | |

Same names, same lengths, so `game/introCardText.ts` (clipSeconds, scene lines) needs no change. The asset stamps
moved (assetStamp.ts: clusters e159a2a6 -> 9370d1e5, scatters 94b99af5 -> 1ee4c8fe, features 60690a73 -> bbdf875e, the
posters too), so no device keeps the old clip. Payload before PRESS ANYWHERE (bootSizes landing + preload + audio):
5,084,199 -> 5,091,634 bytes (+7,435). card-frame.webp is unchanged (it has no game art in it).

## Review

`compare-card-<key>.jpg` (old left, new right, at three matching moments), `compare-posters.jpg`, the new clips as
`new-card-<key>.mp4` / `-poster.jpg`, and the landing screen with them at 1440 x 900 and 390 x 844
(`landing_*.png`). landing_probe ONLY=splash,layout: 565 checks, 0 failures.

## Archived first (nothing lost)

`/Users/corey/Desktop/_archive/manticore_intro_cards_2026-11-10/`: the six original intro files
(`static_assets_ui_intro/`) and, MOVED out of the app, the old renderer's sun standard images:
tools/render_symbols/out/render/S.png, out/tiles/s.png, out-pre-rebake-20261006/render/S.png,
out-pre-rebake-20261006/tiles/s.png (`tools_render_symbols/`). SHA256SUMS in the folder.

## Notes

- The features card's SWIPE scene is the hand authored round of before: whatever it removes is as written in
  `scenes.js` (its wilds were not re-authored for the 2026.11.02 "wilds stay" rule); look at it on the sheet.
- Not watched in Safari or on a phone; stills and the landing probe only.
