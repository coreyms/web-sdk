// WHICH BAR THIS PAGE DRAWS: ui/gear/gearLayout.ts GAME_BAR (the one rollback constant), or, on the dev server only,
// what the page's own query says: ?bar=dock draws today's glass dock on every screen and ?bar=gear the gear bar
// wherever a table is filled. The probes use it to prove both bars from one build (the main repo's
// tools/manticore/hud_probe.js runs the dock's own desktop checks with bar=dock). Never in a production build.
import { GAME_BAR } from './gearLayout';

export const BAR_MODE: 'gear' | 'dock' = (() => {
	if (import.meta.env.DEV && typeof location !== 'undefined') {
		const q = new URLSearchParams(location.search).get('bar');
		if (q === 'dock' || q === 'gear') return q;
	}
	return GAME_BAR;
})();

/** THE PAGE IS ON A TOUCH DEVICE (a coarse pointer), read once: a phone held sideways then keeps the home indicator
 *  strip clear (ui/gear/gearLayout.ts SIDEWAYS.homeStrip) and THE ARMOURY takes its own sideways layout
 *  (ui/Chrome.svelte); a desktop popout with a mouse does neither. Playwright's touch contexts read as coarse too. */
export const TOUCH: boolean = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
