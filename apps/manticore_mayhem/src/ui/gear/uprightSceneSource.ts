// THE UPRIGHT PHONE'S SCENE, HANDED TO THE CANVAS (2026-11-23). game/layoutSpec.ts places the portrait board frame, and
// through it the plaque, the cells, the win plaque and the Manticore's dock; it cannot import the gear bar's files (they
// import it), so the bar registers its scene here, once, when the chrome's module loads (ui/Chrome.svelte imports this
// file for that alone). Where the page draws the dock (a narrow or very short phone, ?bar=dock on the dev server, the
// rollback constant) the source answers null and the canvas draws the shipped scene.
import { setPortraitSceneSource } from '../../game/layoutSpec';
import { readSafeInsets } from '../hud/hudLayout';
import { uprightBarScene } from './gearLayout';
import { BAR_MODE } from './barMode';

// the window in whole hundredths of a CSS px, so the canvas (its size over the fit's scale, times the scale) and the
// chrome (the window's own size) ask the rule about the same window; the safe area is read once per window size
const r2 = (v: number) => Math.round(v * 100) / 100;
let last: { key: string; safeBottom: number } | null = null;
setPortraitSceneSource((viewportMasterWidth, view) => {
	const vw = r2(viewportMasterWidth * view.cssPerMaster);
	const vh = r2(view.masterHeight * view.cssPerMaster);
	const key = `${vw}|${vh}`;
	if (!last || last.key !== key) last = { key, safeBottom: readSafeInsets().b };
	return uprightBarScene({ kind: 'portrait', vw, vh, phone: view.phone, safeBottom: last.safeBottom }, BAR_MODE);
});
