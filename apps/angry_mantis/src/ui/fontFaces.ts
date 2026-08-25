// Injects the HTML chrome's @font-face rules with ?v= cache-buster stamps (production serves
// /assets/* with Cache-Control: immutable — bare URLs in a CSS block would be poisoned forever).
// Side-effect import from ChromeStyles.svelte; runs once per page load.
import { stamp } from '../game/assets';

const fontCss = [
	['Outfit', '100 900', stamp('/assets/fonts/ui/Outfit-Variable.woff2')],
	['Sora', '100 800', stamp('/assets/fonts/ui/Sora-Variable.woff2')],
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
}
