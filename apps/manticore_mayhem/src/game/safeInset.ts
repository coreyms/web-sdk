// env(safe-area-inset-left), in CSS px, read off one hidden probe element's padding (the way ui/armoury/Armoury.svelte
// reads the insets). 0 where the host exposes none (every portrait phone checked: the notch is at the top) and in node.
let probe: HTMLDivElement | null = null;
export const safeInsetLeftCss = (): number => {
	if (typeof document === 'undefined' || !document.body) return 0;
	if (!probe) {
		probe = document.createElement('div');
		probe.setAttribute('aria-hidden', 'true');
		probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left, 0px)';
		document.body.appendChild(probe);
	}
	return parseFloat(getComputedStyle(probe).paddingLeft) || 0;
};
