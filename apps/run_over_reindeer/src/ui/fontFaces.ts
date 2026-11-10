// Injects the HTML chrome's @font-face rules with ?v= cache-buster stamps (production serves
// /assets/* with Cache-Control: immutable — bare URLs in a CSS block would be poisoned forever).
// Side-effect import from ChromeStyles.svelte; runs once per page load.
import { stamp } from '../game/assets';

const fontCss = [
	['Outfit', '100 900', stamp('/assets/fonts/ui/Outfit-Variable.woff2')],
	['Sora', '100 800', stamp('/assets/fonts/ui/Sora-Variable.woff2')],
	// THE GAME'S ONE FACE OUTSIDE THE HUD (Corey 2026-11-04): Overpass (SIL OFL, modeled on Highway Gothic; licence
	// beside the files: OFL-Overpass.txt). Every title, the modal headings (ChromeStyles --ui-font-display), PRESS
	// ANYWHERE, the feature menu and the canvas amounts. Four static weights (tools/build_assets.py).
	['Overpass', '400', stamp('/assets/fonts/overpass/Overpass-regular.woff2')],
	['Overpass', '700', stamp('/assets/fonts/overpass/Overpass-bold.woff2')],
	['Overpass', '800', stamp('/assets/fonts/overpass/Overpass-extrabold.woff2')],
	['Overpass', '900', stamp('/assets/fonts/overpass/Overpass-heavy.woff2')],
	// READING TEXT (the house standard for Game Info's body copy): 'Outfit-Variable.woff2' above is one static Black
	// (900) face, so every weight drew black. This is the real variable Outfit (wght 100 to 900, OFL-Outfit.txt),
	// named apart so the HUD, which is drawn in that black face, does not change. NOT kicked off below: the browser
	// fetches it when Game Info first draws.
	['Outfit Text', '100 900', stamp('/assets/fonts/ui/OutfitText-Variable.woff2')],
]
	.map(
		([family, weight, url]) =>
			`@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('${url}') format('woff2')}`
	)
	.join('');

if (typeof document !== 'undefined' && !document.getElementById('am-fonts')) {
	const el = document.createElement('style');
	el.id = 'am-fonts';
	el.textContent = fontCss;
	document.head.appendChild(el);
	// kick off the fetches now: canvas text does NOT trigger @font-face loading on its own, and
	// pixi-svelte's preloadFont awaits document.fonts.ready before Pixi init — these make that wait
	// actually cover the bundled fonts, so Pixi text never rasterizes with a fallback font.
	document.fonts?.load('700 16px Outfit');
	document.fonts?.load('700 16px Sora');
	// the canvas draws the win amount in Overpass Heavy
	document.fonts?.load("900 16px 'Overpass'");
}
