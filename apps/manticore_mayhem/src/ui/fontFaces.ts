// Injects the HTML chrome's @font-face rules with ?v= cache-buster stamps (production serves
// /assets/* with Cache-Control: immutable — bare URLs in a CSS block would be poisoned forever).
// Side-effect import from ChromeStyles.svelte; runs once per page load.
import { stamp } from '../game/assets';

const fontCss = [
	['Outfit', '100 900', stamp('/assets/fonts/ui/Outfit-Variable.woff2')],
	['Sora', '100 800', stamp('/assets/fonts/ui/Sora-Variable.woff2')],
	// bonus-buy "meal ticket" display faces (OFL, bundled — no external hosts)
	['Black Ops One', '400', stamp('/assets/fonts/ui/BlackOpsOne-Regular.woff2')],
	// the intro cards' title face (ui/LandingScreen.svelte; OFL, licence beside it: OFL-Cinzel.txt). Static
	// 700, Latin. NOT kicked off below: the browser fetches it when the cards first draw, after the Pixi
	// preload, so pixi-svelte's document.fonts.ready wait never includes it; until it is in, the title
	// draws in the serif fallback (font-display: swap).
	['Cinzel', '700', stamp('/assets/fonts/ui/Cinzel-Bold.woff2')],
	// READING TEXT (Build B2, 2026-10-14; images/rules_menu_ref_r1/COMPARISON.md fix 1, Corey: the standard for every
	// game). 'Outfit-Variable.woff2' above is NOT variable: it is one static Black (900) face, so every weight drew
	// black. This is the real variable Outfit (wght 100 to 900, google/fonts, OFL, licence beside it: OFL-Outfit.txt),
	// named apart so the HUD, which is drawn in that black face, does not change. Used only by Game Info's body copy
	// (ui/GameInfoModal.svelte --gi-body). NOT kicked off below: the browser fetches it when Game Info first draws.
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
	// Black Ops One is NOT kicked off (2026-10-15, download analysis S2, Corey yes): only HTML uses it (ChromeStyles'
	// display class), and HTML text fetches its own face when it first draws, so its 56 KB left the boot path
}
