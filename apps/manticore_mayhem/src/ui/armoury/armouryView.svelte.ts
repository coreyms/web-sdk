// THE ARMOURY'S SHARED VIEW STATE (spec feedback/armoury_build_r1 2.3). Reusable: no game names, colours or copy.
//
// The menu (Armoury.svelte, in the modals layer) and its tint (ArmouryTint.svelte, inside the HUD layer's scaled
// frame, so the real balance and bet row can be raised above it) are two components in two layers; this is what they
// share, with Chrome.svelte (the lit HUD classes) and components/Logo.svelte (the canvas logo stays under the tint).

export const armouryView = $state({
	/** the Armoury is the menu for the chrome on screen (the DEV switch, and a layout it draws): the old menu stands
	 *  down and the HUD stays visible under the open menu */
	takes: false,
	/** mounted: open, or fading out after a close */
	shown: false,
	/** open and not closing */
	open: false,
	/** the confirm card is up: the lit HUD steps back */
	confirm: false,
	/** fading out */
	closing: false,
	/** the tint's colour: the chosen mode's */
	tint: '#000000',
});

/**
 * THE HUD'S RULE UNDER A MODAL, in ONE place (Chrome.svelte's layer and Logo.svelte's canvas logo read it, so the two
 * cannot drift): every modal hides the HUD, except the Armoury, which keeps the game and the HUD visible under its tint.
 */
export const hudHiddenByModal = (modal: { name: string } | null | undefined): boolean => modal != null && !(modal.name === 'buyBonus' && armouryView.takes);
