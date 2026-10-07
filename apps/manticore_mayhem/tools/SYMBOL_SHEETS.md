# Manticore Mayhem symbol sheets

Built by `tools/pack_symbol_sheets.py` (2026-10-06). Re-run:

```
cd web-sdk/apps/manticore_mayhem
/Users/corey/Projects/stake-engine/math-sdk/env/bin/python tools/pack_symbol_sheets.py --verify   # about 12 min
node scripts/stamp-assets.mjs                                                                 # pngHash + assetStamp
```

Flags: `--only H1,L4` (one or more symbols), `--no-sheets`, `--no-atlas`, `--no-tiles`, `--verify` (numbers into
`tools/render_symbols/out/_sheets_verify.json`, contact sheet `tools/render_symbols/out/_sheets_contact.png`).

`tools/make_placeholders.py` no longer calls its `build_atlas()` / `build_tiles()` (they would write the placeholder
plates over the real atlas and paytable tiles). The packer imports its `mult_overlay()` and `cell_well()` only.

## Sources (read only)

- `~/Desktop/Manticore Mayhem/handoff/assets/tiles/<code>.webp`: the ten approved static tiles, 256 px, lossless.
- `~/Desktop/Manticore Mayhem/images/symbols/<CODE_name>/animation/drop/` and `idle/`: 512 px RGBA frames, 30 fps.
  File names differ per folder (`0000.png`, `H1_drop_000.png`, ...); they are sorted, and Finder duplicates such as
  `0001 2.png` are skipped. The `256/` copies are not used: every tier is one LANCZOS resample from 512.
- L4 uses `drop/` (the baked stamp squash), not `drop_nosquash/`. M1 `drop/` is `drop_lively`.
- `tools/render_symbols/out/render/<CODE>.png` (1024 harness renders) + `fit.json`: the fit is derived from these and
  cached in `tools/render_symbols/sheet_fit.json`, so a re-run still works when `out/` (gitignored) is gone.

## The fit

`make_tiles.py` crops each 1024 render to its silhouette, rotates by `rot`, scales so the larger side is `size` %
of the 110 px cell (the 256 tile is 0.94 of a cell, so 272.3 tile px per cell), offsets by `dx`/`dy` % of a cell and
centres it. The packer replays exactly that on the render to get the crop origin, the scale and the paste offset,
then maps every 512 frame through the SAME geometry (halved), as one box resample of a transparent-padded frame.
Motion outside the rest silhouette is kept up to the cell edge. L1 also gets its -1 degree rotation about the same
pivot. `meta.fit.box512` in every sheet JSON is the region of the 512 frame that becomes the cell.

Replay check: the 1024 render through the packer vs the handoff tile: mean 0.001 to 0.020, so the geometry is the
tile's. Alpha centroids of drop frame 0 and the render at 512 agree within 0.05 px on every symbol.

## Layout

- `static/assets/sprites/mmSymbols/<code>-drop.json|webp`, `<code>-idle.json|webp`: 256 px cells, 8 columns,
  frames `<code>-drop-000` ..., Pixi spritesheet JSON (same shape as `mmSymbols.json`) plus
  `animations: { drop: [...] }` / `{ idle: [...] }` in play order and `meta.fps: 30`.
- `<code>-drop-half` / `<code>-idle-half`: the 128 px twins (phone tier, `game/deviceTier.ts`), same frame names.
- Pixel-identical frames share one cell (several frame names point at one rect), so holds cost nothing.
  Biggest sheet 2048 x 2048: no multipack needed.
- Encoding: every full-tier sheet is lossless WebP (Corey 2026-10-06). The `-half` sheets are lossless unless that
  is over 1.6x the q95 file, then q95 (alpha lossless). The JSON `meta.encoding` says which. `--full-only` rebuilds
  the 256 px sheets and leaves the `-half` twins as they are.
- `mmSymbols.json|webp` and `-half`: same frame names and rects as before. The ten symbol cells are the handoff tiles
  (half: LANCZOS to 128). x2..x128 and `cell` are redrawn by make_placeholders' own functions, same art and rects; they
  now come out lossless instead of the old q92 (mean diff 0.46 vs the old atlas is that compression going away).
  The base atlas is ALWAYS lossless so the static tile on the board is the approved pixels exactly.
- `static/assets/tiles/<code>.webp`: 128 px lossless, LANCZOS from the handoff tile. Read by `ui/GameInfoModal.svelte`
  (drawn at 40 to 64 CSS px, so 128 covers 2x DPR). The handoff README lists 256 px for this path; the repo keeps 128.

## Frame counts and per-symbol notes

| sym | drop frames (unique) | idle frames (unique) | notes |
|-----|---------------------|----------------------|-------|
| L1 | 48 (48) | 60 (60) | drop frame 6 loses 2.2 % of its alpha past the cell edge (the bounce) |
| L2 | 48 (48) | 60 (1) | idle has no motion: one cell |
| L3 | 36 (21) | none | no idle delivered; NOTES: play from frame 1, rest from frame 20 |
| L4 | 48 (21) | 60 (10) | squash BAKED from frame 6; see below |
| M1 | 48 (48) | 60 (60) | drop_lively |
| M2 | 48 (29) | 60 (12) | |
| M3 | 48 (48) | 60 (60) | splash clips 1 % at frame 14; static from the rig blend render, see below |
| H1 | 36 (21) | 60 (7) | |
| W  | 48 (24) | 60 (44) | |
| S  | 48 (46) | 60 (60) | frames 0..5 are the fall INSIDE the frame (frame 0 is entirely above the cell); lands at 6 |

L4: the stamp squash is baked into `drop/`. The renderer must skip the GRAVITY_DROP sprite squash for L4, or the two
multiply (0.75 x the frame's own press). Per-symbol override: `squash` default 0.25 (GRAVITY_DROP.squash), L4 0.

M3: the static tile came from the rig .blend render (`M3_royal-chalice/animation/M3_static_wine.png`, the open cup
with wine), not from the glb, because the wine material does not survive glTF export. `models.json` still points at
`royal_chalice.glb`, so a plain `make_tiles.py` re-render would bring back the closed cap: copy the wine render into
`out/render/M3.png` and run `make_tiles.py --only M3 --no-render`.

S: when the game moves the tile sprite through the fall itself, start S at frame 6 (the S NOTES say the same). L3
frame 0 is the identity frame; its NOTES say play from 1.

## In the game (components/BoardCells.svelte)

- Loaded in the DEFERRED phase (`game/assets.ts`, keys `mmDrop_<code>` / `mmIdle_<code>`, `preload: false`), phone
  tier takes the `-half` sheets. `mmIdle_l2` and `mmIdle_l3` are not in the manifest (no moving idle).
- Per-symbol rules: `SYMBOL_ANIM` in `game/constants.ts`, next to GRAVITY_DROP: `squash` (default
  GRAVITY_DROP.squash 0.25, L4 0), `dropFrom` (S 6, L3 1), `idle` (false for L2 and L3: they rest on the last drop
  frame). Frame counts come from the parsed sheet, never from code.
- The engine stamps `Cell.landAt` (performance.now() of the contact) once per landing in `runDrops`; the renderer
  starts the drop sheet there and runs it at 30 fps STYLE time (real ms x timeScale()), then loops idle (continuing
  from the drop's last frame). A cell that leaves its place (fall, rattle, swipe exit, removal) shows the static
  atlas frame until it lands again. A scale-only beat in place (win pulse, sting pop) freezes on the current frame and
  the clip resumes after. A cell entering idle without a landing (first board, a sting's new symbol, back from the
  rattle) starts at a per-position phase, `((reel * 29 + row * 47) % 60)` frames: 57 distinct phases over 64 cells.
- Before the sheets load, every cell shows the static atlas frame. After, a resting cell always shows a sheet frame.
- Once all ten symbols are parsed, the 18 sheet sources are uploaded to the GPU one per tick (no first-draw hitch).
- DEV: `window.__manticore.sheets` (loaded, per-symbol counts, per-cell mode / frame / clock). Probe:
  `tools/manticore/sheet_probe.js` in the parent repo.

## Verify (2026-10-06)

Diff = premultiplied RGBA, mean abs (0..255) and pixels with any channel over 8, at 256 px (65,536 px).

| sym | drop 0 vs tile | idle 0 vs drop last | idle seam (59 -> 0) |
|-----|----------------|---------------------|---------------------|
| L1 | 0.93 / 3118 | 0.68 / 1595 | 0.16 / 599 |
| L2 | 0.63 / 2189 | 0.12 / 506 (idle not used) | 0 / 0 |
| L3 | 0.58 / 3578 | (no idle) | |
| L4 | 1.34 / 5564 | 0 / 0 | 0 / 0 |
| M1 | 1.85 / 9079 | 2.29 / 2387 | 0.48 / 762 |
| M2 | 0.83 / 3747 | 0.001 / 0 | 0 / 0 |
| M3 | 2.51 / 11984 | 0.19 / 415 | 0.10 / 337 |
| H1 | 1.90 / 10071 | 0.004 / 1 | 0 / 0 |
| W  | 3.09 / 18762 | 0.003 / 0 | 0.01 / 0 |
| S  | 51.8 (frame 0 empty); best frame 38: 4.18 / 15621 | 1.65 / 5870 | 0.53 / 622 |

The drop 0 residual is shading, not placement: the frames are native EEVEE renders at 512 and the tile is the 1024
render downsampled (the per-symbol NOTES measured mean 2 to 2.5 at 512 for the same reason). The 1024 render pushed
through this pipeline at 512 gives 0.06 to 0.43, so about 0.1 to 0.4 of each number is the resample and the rest is
EEVEE sampling (the full tier is lossless, so no compression adds to it). In the game a resting cell shows idle
frames, never the static tile, once the sheets are in, so this difference only shows at the moment a cell starts
falling or is removed.

Every JSON parses, every frame rect is inside its sheet, `animations` lists every frame in order, and the atlas
symbol cells equal the handoff tiles exactly (0.0 / 0, both tiers).

## Bytes (json + webp)

| sheet | full | half |
|-------|-----:|-----:|
| l1-drop | 976,183 | 313,237 |
| l1-idle | 492,523 | 172,778 |
| l2-drop | 354,794 | 150,200 |
| l2-idle | 52,434 | 27,452 |
| l3-drop | 459,253 | 131,812 |
| l4-drop | 840,939 | 247,856 |
| l4-idle | 274,487 | 111,000 |
| m1-drop | 615,474 | 236,266 |
| m1-idle | 719,472 | 271,977 |
| m2-drop | 804,192 | 160,741 |
| m2-idle | 234,593 | 94,044 |
| m3-drop | 1,145,611 | 464,987 |
| m3-idle | 949,159 | 439,138 |
| h1-drop | 1,030,511 | 174,236 |
| h1-idle | 115,177 | 53,398 |
| w-drop | 1,351,247 | 244,171 |
| w-idle | 955,811 | 378,846 |
| s-drop | 1,971,806 | 325,277 |
| s-idle | 2,515,002 | 429,504 |
| **sheets total** | **15,858,668 (15.9 MB, all lossless)** | **4,426,920 (4.4 MB)** |
| decoded RGBA (GPU) | 178 MB | 44 MB |
| mmSymbols atlas | 602,654 (was 104,400) | 202,645 (was 67,043) |
| paytable tiles (10) | 146 KB at 128 px | |

Budget note: the sheets are deferred (`preload: false`), so the landing screen is not gated by them, but they still
download behind the game: 4.4 MB on the phone tier, 15.9 MB on desktop. The landing-gated preload grows only by the
real atlas (bootSizes.preload 776,046 -> 1,274,300 bytes, full tier figure). Decoded memory matters more than bytes on
phones: the Angry Mantis crash was about 178 MB decoded; the half tier here is 44 MB for all ten symbols, the full
tier 178 MB (desktop only, accepted). The biggest single costs are M3, W and S idle (60 unique frames each).
