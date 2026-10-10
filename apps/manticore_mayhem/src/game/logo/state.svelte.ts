// Who is drawing the logo right now. The canvas logo (components/Logo.svelte) sets `canvas` while it is the
// one on screen; the landscape chrome hides its <img> for exactly that time (ui/ChromeLandscape.svelte), so
// there is always one logo and never two.
export const logoState = $state({ canvas: false });
