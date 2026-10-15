import type * as PIXI from 'pixi.js';

// SLOTS IN THE FRAME'S ART CONTAINER (BoardFrame's `under`, which carries the frame's kick):
//   boardPlateSlot   THE WHOLE-CELL MULTIPLIER TILES (MULT_PLATE.style 'cell', Corey 2026-10-13 12:06): between the black
//                    backing and the day plate, with the board container's own transform (kick excluded). BoardCells
//                    puts its tile layer into it and takes it out on unmount.
//   boardPlaqueSlot  THE SPIN AMOUNT PLAQUE (images/spin_amount_final/SPEC.md, components/BoardPlaque.svelte): after the
//                    fire gears, so above every frame layer, in master units like the frame itself.
// BoardFrame owns both and publishes them here; it also publishes the light it last applied (`frameLight`), so the
// plaque's day / night / fire layers follow the frame's exactly without computing it twice.
export const boardPlateSlot: { current: PIXI.Container | null } = { current: null };
export const boardPlaqueSlot: { current: PIXI.Container | null } = { current: null };
export const frameLight = { night: 0, fire: 0, nightTint: 0xffffff, fireTint: 0, shadowTint: 0xffffff, nightSet: false, seq: 0 };
