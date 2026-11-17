// The reindeer path editor's own state (staging only; RoamEditor.svelte): shared by its controls, in the tune panel's
// Reindeer path group, and its overlay over the game, which stays up while the panel is collapsed (on an upright phone
// the panel covers most of the screen).
export const roamEdit = $state({ shown: false, picked: 0, tick: 0 });
