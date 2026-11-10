# Drop 8: the creature's final render, wired (2026-11-10)

Integration only: Corey approved every clip of drop 8. Nothing here was committed or pushed.

## 1. Where it came from

a. Phase A, `/Volumes/manticore/rig-review/2026-11-09/`: `drop-8` (day), `drop-8-night`, `drop-8-super`, `drop-8-epic`
   (13 body clips with shadows: idle, idle_look, swipe, roar, snarl, growl, charge_in, charge_loop, sting_hit,
   sting_recrouch, win_big, win_mega, and the charge_glow overlay), `drop-8-glow-addon` (sting_hit_glow 14 f,
   sting_recrouch_glow 3 f), `drop-8-sting-fx` (sting_fx_tail_drop8A_FINAL.ts / .json).
b. Phase B, `/Volumes/manticore/rig-review/2026-11-10/`: `drop-8-wins`, `-night`, `-super`, `-epic` (win_super 42 f,
   win_epic_in 40 f, win_epic_loop 16 f, win_epic_out 30 f, with shadows) and `drop-8-glow-addon-wins`
   (win_epic_in_glow 21 f over in f20..40, win_epic_loop_glow 16 f, win_epic_out_glow 6 f over out f1..6).
   Note: the epic look folder is named `drop-8-wins-epic` (the brief said `-epic`); it is the same pattern as the others.
c. Every pack was checked by the build tool against its own meta.json (frame counts, contiguous frames, canvas 1024,
   feetRow 884, contactX [295, 729], fps 30, shadow canvas 256 at scale 4), the two packs against each other (the same
   five fields), and each add-on's merged `meta/<look>/meta.json` against pack + `meta_addon.json`. No mismatch.
   The shadow and overlay files are byte-identical across the looks (checked), so they are shared.
d. Nothing was written to the share. The night look is not shipped (no mode shows it), as before.

## 2. The pipeline (the drop 7 one, extended, not replaced)

a. `tools/build_creature_assets.py` builds both packs as ONE set with one spec. New options, all off by default so the
   drop 7 command still builds what it built: `--extra-drops / --extra-drop` (the second pack's clips merged after the
   first's; a clip in both packs is an error), `--extra-addon` (its overlays packed into their OWN atlas,
   `shared/creature-glow-wins[-phone]`), `--pages-standalone` (a clip too big for one 4096 sheet is written as pages
   that are sheets of their own, so each takes the worker decode and the strip upload: only win_mega at 640 needs it,
   2 pages). `overlayStart` is now a clip fact the tool carries. The spec gains `parts.wins`.
b. The exact command is in the tool's docstring (DROP 8 section). Tiers as before: full 640 px canvas, phone 432 px
   (the phone keeps the 640 idle, `CREATURE.phoneFullIdle`); webp q85 / alpha 70 for the looks, q90 / 100 for the
   glow atlases, lossless shadow and shade. 3 physical px per CSS px: the same tier canvases as drop 7, which already
   met it at the largest draw size; the placement is unchanged, so nothing changes there.
c. Every frame is trimmed on alpha 0 (the pipeline always did): the Epic glow atlas is 5.27 MB on the GPU at 640 and
   2.40 MB at 432 (the rig quoted 15.5 MB packed / 12.2 MB trimmed at 1024).
d. `tools/build_creature_still.py` re-run after the copy (the still is idle f1 of the new idle: 487 x 567 / 330 x 384).
e. `scripts/stamp-assets.mjs` re-run (assetStamp.ts) so the new files are stamped.

## 3. Numbers taken from the rig

| what | value | source |
|---|---|---|
| clip frames | idle 54, idle_look 36, swipe 36 (hold 16), roar 53, snarl 30, growl 36, charge_in 6, charge_loop 12, sting_hit 36 (hold 11), sting_recrouch 12 (follows f11, returns to charge_loop f1), win_big 30, win_mega 60, win_super 42, win_epic_in 40, win_epic_loop 16, win_epic_out 30 | meta.json, both packs |
| overlays | charge_glow 12 (over charge_loop); sting_hit_glow 14, frames [1, 14], hold 11, gain 1 x 11 then 0.75 / 0.5 / 0.25; sting_recrouch_glow 3, gain 0.75 / 0.5 / 0.25; win_epic_in_glow 21 (overlayStart 20, frames [20, 40]); win_epic_loop_glow 16; win_epic_out_glow 6 (frames [1, 6]); every epic gain 1, not baked | meta_addon.json, both add-ons |
| STING_FX.tail | tips charge_in 6, charge_loop 12, sting_hit 36, sting_recrouch 12 (pasted from the FINAL .ts, replacing drop 7's table); hold [222, 383] (sting_hit f11); entryFrames.scatter 5 | sting_fx_tail_drop8A_FINAL.ts / .json |
| canvas, feet | 1024, feetRow 884, feetCol 512, contactX [295, 729], fps 30, shadow scale 4 | meta.json (unchanged from drop 7) |

Numbers measured here on the rig's day frames (256 px, outline change of the alpha masks; the colour change in brackets):

| join | value | used for |
|---|---|---|
| sting_recrouch fN to sting_hit f1 | f9 8.0 %, f10 3.3 %, f11 2.1 %, f12 2.2 % | `CREATURE.recrouch.strikeFromFrame` 5 -> **10** (drop 7's f5 was 3.9 %) |
| charge_loop (best frame) to sting_hit fN | f24 8.7 %, f25 7.8 %, f26 7.7 %, f27 8.3 % | `CREATURE.crouchUpFrame` 13 -> **25** (he gets up from f26) |
| charge_loop f12 to sting_hit f5 (scatter entry) | 10.2 % (19.4), the clip's own largest step 13.9 % | info, as the rig asked |
| sting_hit f11 to sting_recrouch f1 | 12.8 % | info |
| sting_recrouch f12 to charge_loop f1 | 2.3 % | info |
| idle f1 to every win clip's f1, and win_big / win_super / win_epic_out last to idle f1 | 0.0 % (win_mega f60 to idle f1: 0.8 %) | every win clip starts and ends on idle f1 |
| win_epic_in f40 to win_epic_loop f1 | 2.6 % (6.6); the loop's own largest step 4.6 % (8.8) | the verifier's "soft" in f40 to loop f1: smaller than any step inside the loop, so no pop |
| win_epic_loop f16 to f1 (seam) | 4.6 % (9.0) | info |
| win_epic_loop f1 vs win_epic_out f1 | 0.0 % (identical) | out starts where the loop would wrap (startsFrom loop f1) |

## 4. What changed in the game

a. **Assets**: `static/assets/sprites/creature/{day,super,epic,shared,still}`: every drop 7 file overwritten by its drop 8
   twin (same names), 94 new files (idle_look and the six win clips per look and tier, win_mega's two 640 pages,
   `shared/creature-glow-wins[-phone]`). `src/game/creatureSpec.ts` regenerated. `src/game/creatureAssets.ts`: 16 body
   clips, `CREATURE_WIN_CLIPS`, every clip a list of pages, `CREATURE_SHARED.glowWins`.
b. **The sting** (constants `STING_FX.tail`, `CREATURE.recrouch`, `crouchUpFrame`; `game/creature.ts`): hold f11 and the
   36 / 12 frame clips come from the spec; the glow is lit from sting_hit f1 through the hold and fades over f12..f14
   (or sting_recrouch f1..f3); a scatter strike enters sting_hit at f5 (200 ms to the hold). NEW: a normal sting's
   wind-up (333 ms to the hold + the 100 ms trail flight) is longer than its beat's 310 ms lead to the flip, so its
   strike is now planned from the cue that reads the sting ahead (`cueBeat`); the beat confirms it. Without this the
   cockback (f1..f4) was cut on every normal sting. The board's timing is untouched.
c. **Charge loop**: the V3 render as delivered, nothing tuned.
d. **The cheers** (constants `PLAQUE_CHEER`, `components/StingerPlaque.svelte`, `game/creature.ts`): the tier names map
   straight to the clips: BIG `win_big` (with the snarl take it had), SUPER `win_super` (a growl take; the flex is
   retired and its code removed), MEGA `win_mega` (the MEGA roar), EPIC `win_epic_in`, then `win_epic_loop` while the
   plaque is up, then `win_epic_out` when it leaves (new event `plaqueCheerEnd`), back to idle, with the tail glow over
   in f20..40, the loop and out f1..6. The Epic step and an EPIC TOTAL WIN now ask for these instead of the roar move;
   `sfx_roar_win` stays the plaque's. A TOTAL WIN cheers by its tier as before. Voices play on the clip's first frame,
   as the moves they replace did. A safety: the Epic loop never runs past `CREATURE.wins.epicLoopMaxMs` (15 s).
e. **idle_look**: a third idle alternate, 1 in 50 per idle loop, real time, no voice (the rig's final render plan);
   it loads with the alternates.
f. **The win clips' loading** (`CREATURE.wins`, `game/creatureLoad.ts`, `game/stripUpload.ts`):
   - their own group, `creatureWins`, and the Epic glow its own atlas;
   - **one switch**, `CREATURE.wins.onDemand` (default `true`). On demand: each round's book is read ahead
     (`winsOfBook`: the final tier of every win plaque, in the look that will be on show, the same way the handlers
     pick the tier) and only those clips load, as the book arrives; when the round has played out and he no longer
     draws them they are let go. `false`: the group loads up front after his alternates and stays;
   - one sheet at a time through the existing upload turn, decoded in the worker, uploaded in 16 bands (one per
     animation frame; the other sheets use 8), and **no upload or band while a win plaque drops in, for 300 ms after
     its impact, or 250 ms after a tier lands** (`creatureUploadQuiet`);
   - **the fallback**: a cheer whose clip is not in keeps him idling (never hidden), asks the loader for it, and
     starts if it lands while the plaque is up; the plaque plays as ever. The Epic also waits for its glow;
   - **measurable**: every sheet's upload is a `performance.measure('creature upload <file>')` and every win clip's
     whole load `creature wins <look> <clip>`, visible in Safari's and Chrome's timelines on staging; the app had no
     perf marks before. The DEV load log (`__manticore.creature.loadLog`) records them too.
g. **DEV hook** (`__manticore.creature`, extended, no new global): `loadWins(clips?)`, `releaseWins()`, `winsOfBook(events)`, `cheer(move)`,
   `cheerEnd()`, `forceRoll('idle_look')`; `state().load.wins`; `memory()` lists every page; `pin` draws a clip's glow
   on the frames its overlay covers.
h. **Placement, scale, floor rows**: unchanged. Nothing rotates, mirrors or scales the tail or the bulb: every frame
   is the rig's picture, swapped whole.

## 5. Deletions

None. Every drop 7 creature file has a drop 8 file of the same name and was overwritten. **The sting's separate tail
layer**: drop 7 had none in the game (no code, no asset), and the rig dropped it before rendering (FINAL_RENDER_PLAN
section 3), so there was nothing to remove.

## 6. Memory (GPU, RGBA8, no mipmaps, per look; MB = 1,000,000 bytes; from the build's report.json)

| device tier | drop 7 | drop 8, win clips not in (on demand, between big wins) | + one win clip in (BIG / SUPER / MEGA / EPIC) | drop 8, every win clip in (up front) |
|---|---|---|---|---|
| desktop and tablet (640) | 270.9 | **355.3** | +32.3 / +45.9 / +65.3 / +96.4 | **595.2** |
| phone (432, its idle at 640) | 156.9 | **195.4** | +14.9 / +21.2 / +30.2 / +44.3 | **306.0** |

a. During a look crossfade two looks are resident for its length (as before): up to about 710 / 390 MB on demand.
b. Download per look (webp + json): desktop day 13.9 MB without the wins (drop 7: 11.0), the wins 9.9 MB more; phone
   day 8.1 MB (drop 7: 6.4), the wins 5.7 MB more. Shared sheets 1.6 / 1.0 MB.
c. Measured in the page (section 8): 355.4 / 595.4 MB on the full tier, 195.5 / 305.9 MB on the phone tier, matching the table.

## 7. Wing tips and claws against the cells, buttons and screen edges (drop 7 vs drop 8)

Measured with `tools/manticore/creature_reach.js` (new; every frame of every clip pinned, his body's drawn pixels at
alpha > 96, CSS px) on drop 7 before the wiring and on drop 8 after it, same layouts, no placement number changed.
"Past" = how far his pixels reach past that screen edge (+ is off screen). The raw files are in the session's scratch
(reach_drop7.json, reach_drop8.json); the drop 8 pinned stills are in `docs/drop8/`.

a. **Every clip is a little wider on both sides**: idle 0.5 to 1.3 px left and right (the new wings), at every layout.
b. **The swipe** is unchanged: at 1920 x 1080 it still reaches 1.0 px past the right edge (as drop 7; accepted).
c. **The roar, snarl and growl grow the most** (the new roar v4, snarl v2, growl v2):

| layout | roar: left / top / right growth | roar right edge (drop 7 -> drop 8) |
|---|---|---|
| desktop 1920 x 1080 | +12.1 / +16.2 / +20.2 px | 26.0 inside -> 5.8 inside |
| desktop 1440 x 900 | +8.0 / +10.6 / +13.3 px | 38.3 inside -> 25.0 inside |
| phone sideways 844 x 390 | +6.1 / +7.4 / +9.6 px | 14.6 past -> 24.2 past (his wing was already off screen there) |
| portrait phone 390 x 844 | +4.9 / +5.9 / +7.7 px | 3.0 past -> 10.7 past |
| portrait tablet 768 x 1024 | +5.7 / +7.5 / +9.4 px | 8.6 inside -> 0.8 past |

   The snarl and growl move by about the same (growl: the same right edge as the roar).
d. **The sting** reaches 2 to 4 px further left and 3 to 7 px higher. Over the Autoplay button at 1920 x 1080: sting_hit
   847 -> 1,166 CSS px squared, sting_recrouch 232 -> 482; at 1440 x 900: 689 -> 831 and 482 -> 585.
e. **The new clips** (idle_look and the six win clips) reach about as far as the roar: inside the screen on both
   desktops (5.8 to 8.5 px from the right edge at 1920), 0.2 to 0.8 px past the right edge on the tablet, 9.7 to
   10.7 px past on the portrait phone, 22.9 to 24.2 px past on the phone held sideways. win_epic_in touches the
   Autoplay button at 1920 (100 px squared); at 1440 x 900 every clip covers about 430 px squared of Autoplay's
   left edge, as his idle there already did (the allowance creature_probe gives at 16:10).
f. **The cells**: none of him on the cell area on either desktop or the phone held sideways, in any clip (as drop 7).
   On the portrait phone and the tablet he stands behind the board's top rail (by design), and the area of him inside
   the cells' rectangle (hidden by the board) is unchanged within 1 to 3 % (sting_hit 1,529 -> 1,573 on the phone).
g. The Play button: every clip's paw is over it as before (5,520 px squared at 1920, the long accepted paw).
h. (The drop 7 run's idle rows also list feature menu labels, 250x, MYSTERY, EPIC: those were on screen in that boot,
   not in the drop 8 one; not a difference of his.)

## 8. Verification

a. `creature_probe.js ONLY=place` (desktop 1440 x 900 plus the eleven desktop sizes, phone sideways, portrait phone,
   portrait tablet and its five sizes): **86 pass, 0 fail**. The probe's drop 7 constants were updated (16 clips, 10 of
   them in without the win clips, the shadow atlas 529 frames, sting_hit_glow 14, the memory budget per tier).
b. `creature_probe.js ONLY=cheer`, rewritten for the win clips: **14 pass, 0 fail** (BIG, SUPER, MEGA at turbo 0 and 2,
   EPIC in / loop / out with the glow frames, a pressed count, TOTAL WIN under BIG / BIG / MEGA / EPIC, the first
   on-demand MEGA with nothing in, the release). It failed 8 on the first run: the idle loop's check of a cued cheer
   did not pass its move, so every cheer was refused; fixed (creature.ts). The release then left the hidden glow sprite
   holding a destroyed Epic glow frame (`dead` 1, not drawn, nothing thrown); fixed (setShared glowWins null).
c. `tools/manticore/drop8_verify.js` (new), one headless page each, Chromium on Metal (`docs/drop8/drop8-verify.json`
   and the stills):

| | desktop 1920 x 1080 (full tier) | portrait phone 390 x 844 (phone tier) |
|---|---|---|
| GPU, win clips not in | 355.4 MB, 13 sheets | 195.5 MB, 13 sheets |
| first on-demand load: win_mega | 1.0 s (two 640 pages, about 250 ms of bands each), worst frame **18.7 ms**, never hidden | 0.47 s, worst frame **17.7 ms**, never hidden |
| the other five win clips + the Epic glow | 3.0 s, worst frame 18.7 ms, never hidden | 3.0 s, worst frame 17.7 ms |
| GPU, every win clip in | 595.4 MB, 21 sheets | 305.9 MB, 20 sheets |
| after releaseWins | 355.4 MB | 195.5 MB |
| roar / swipe | 53 / 36 frames, every frame drawn | the same |
| sting run (3 normal stings + 1) | charge_in f1..6, the first sting_hit **f1..f11 whole** (the cockback), the **hold on f11** (47 display frames on f11 over four strikes, about 150 ms each), sting_recrouch f1..9, each later strike from f6, the last one played out to f36; **no glow** (a normal sting) | the same |
| big sting | charge_in f1..6, charge_loop f1..12, sting_hit f1..36; the glow over loop f1..12 and **sting_hit f1..f14**, none after | the same |
| BIG / SUPER / MEGA | win_big f1..30, win_super f1..42, win_mega f1..60, real time | the same |
| EPIC | win_epic_in f1..40, win_epic_loop (looping while up), win_epic_out f1..30, idle; the glow on in f20..40, the loop, out f1..6 | the same |
| page errors | none | none |

   The Epic's hand-offs drawn: idle f54 -> in f1, in f40 -> loop f1, loop f16 -> out f1, out f30 -> idle f1, no other
   cut. The rig flagged in f40 -> loop f1 on the day look as soft: on the rig's frames it is a 2.6 % outline change,
   smaller than every step inside the loop (up to 4.6 %), and in f40 is within 2.2 % of loop f16, so the cut reads as
   one more loop step; no pop to see in the stills (in-f40, loop-f1, loop-f16, out-f1).
   (A first run of this script without the GPU flags drew 2 to 6 fps at 1920 on software GL; those numbers were
   thrown away.)
d. `winsOfBook` on real mock RGS books (BONUS 180.5x, SUPER 121.3x, EPIC 319.7x): each named the clips its plaques
   ask for, in the feature's look and the base look for the TOTAL WIN (for example SUPER: super [win_super], day
   [win_super]). No base game book of 20x or more came up in 120 tries, so the base branch was exercised only through
   the synthetic wins.
e. Production build (`pnpm build`, nice 19): done, bundle 1,681 KB; `node scripts/check-production-bundle.mjs`: PASS.
f. svelte-check: no errors in src (the 7 it reports are in node_modules and vite.config.js, as before).

## 9. Open questions

1. The voices start on each win clip's first frame, as the moves they replace did; the render plan names accent frames
   (win_big 7, win_super about 17, win_mega 12, win_epic_in 22) that are not in the pack. Should the voices, and Epic's
   sfx_roar_win, which now lands about 0.6 s before win_epic_in's accent, move onto those frames?
2. On demand lets each win clip go once its round has played out (desktop 355 MB, phone 195 MB between big wins); should
   a clip stay once loaded instead (it grows to 595 / 306 MB over a session)?
3. A feature's TOTAL WIN cheer often comes while the base look is still reloading after the feature, so he may idle
   there instead of cheering: acceptable, or should the base look's win clips load with the feature ending?
4. idle_look plays 1 in 50 idle loops, the render plan's number, not a ruling of Corey's: is that the rate he wants?
5. In a run of normal stings only the first strike shows the whole cockback; the board's rhythm starts each later one
   at about f6 (the beat leaves too little lead for the 10 frame wind-up): acceptable as is?

## 10. Not verified

a. Real devices: iPhone Safari and a desktop browser on staging (frame times through a real first load, memory). The
   `creature upload <file>` and `creature wins <look> <clip>` measures are there for it.
b. WebKit at all (only headless Chromium on Metal here).
c. The rest of creature_probe (timing against the baseline, handover, boot, lookload, memory per look, poke, idle,
   sound) and every other probe: for the Decimus regression. The timing section matters most: the normal sting's
   strike is now planned ahead of its beat.
d. The super and epic looks of the new clips in the browser (built and checked by the build tool, not looked at here);
   a change of look while win clips are in or loading; up front mode (`CREATURE.wins.onDemand` false) beyond the type
   check; a real base game book driving the on-demand load end to end.
e. The prefetch of the super / epic looks (unchanged groups, now with idle_look in the alternates, which it leaves out).

## 11. Files

a. Changed: `src/game/{creature,creatureLoad,creatureAssets,creatureSpec,stripUpload,constants,assetStamp}.ts`,
   `src/components/{StingerPlaque,Background}.svelte`, `tools/build_creature_assets.py`, `static/assets/sprites/creature/**`.
b. New: `docs/DROP8_WIRING.md`, `docs/drop8/` (46 stills, two screens, drop8-verify.json),
   `/Users/corey/Projects/stake-engine/tools/manticore/creature_reach.js` and `drop8_verify.js`.
c. Changed outside the app: `tools/manticore/creature_probe.js` (drop 8 constants, the CHEER section),
   `docs/reviews/manticore-changes-1.0.05.md` (row 29).
