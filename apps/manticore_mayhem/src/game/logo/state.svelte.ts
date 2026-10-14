// Who is drawing the logo right now. The canvas (components/Logo.svelte) sets `canvas` while it draws the logo,
// animated or still; every chrome hides its <img> for exactly that time (ui/Chrome*.svelte), so there is always
// one logo and never two.
export const logoState = $state({ canvas: false });
