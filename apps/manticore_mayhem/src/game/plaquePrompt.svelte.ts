// THE DESKTOP PRESS ANYWHERE ON THE BOARD PLAQUE (Corey 2026-10-17 15:31 to 15:32: "on desktop does it really hold a
// tinted background over the board?", then "2. Yes, that's a great idea!"). Where the prompt was over the board (the
// desktop's feature intro and wrap up, components/PressToContinue.svelte `overBoard`), it is now drawn on the board
// plaque's text field, in the plaque's own layer stack (components/BoardPlaque.svelte, between the crest and the
// figures), and the veiled bottom row is gone.
//
// The two components meet here:
//   plaquePrompt       plain numbers BoardPlaque's tick reads (no reactive reads per frame): how many over the board
//                      prompts are up (`count`, a counter like pressGates, so overlapping gates stay balanced) and the
//                      blink's opacity (`alpha`, PressToContinue's own blink).
//   plaquePromptReady  reactive: BoardPlaque can draw the line now (its art is in, it is on the board, Cinzel is in).
//                      Until it can, PressToContinue draws the line where it was (without the veil), so the prompt is
//                      never missing, and when Cinzel can not load at all it stays there as the atlas line.
//
// PRESENTATION ONLY: nothing here reads or changes an outcome.
export const plaquePrompt = { count: 0, alpha: 1 };
export const plaquePromptReady = $state({ ready: false });
