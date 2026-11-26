// @ts-nocheck: a node check script, not app code (svelte-check picks up .mjs files)
// THE LINE AMOUNTS MADE AHEAD, NODE ONLY (2026-11-22, wip/winlights; constants LINE_WIN.slam.ahead, game/road/winLabelText.ts
// AheadText, game/road/winLights.ts aheadStep / showNow). No browser: the real pixi.js 8.8.1 runs on a recording canvas made
// here (every property set and every call on a 2D context is written down, its text measured by a fixed rule), and the old
// picture (what a PIXI.Text draws: Pixi's own CanvasTextSystem.createTextureAndCanvas) is set beside the new one (an AheadText)
// for the slam label's two styles (the amount and its shadow) at label scale 1 and the upright phone's, at resolutions 1, 2
// and 3, for amounts in USD, EUR, JPY, BRL, INR, KWD, BTC, USDT, social GC and SC and a made-up XQZ, written by the game's own
// formatter (src/game/currency.ts, as tools/led_currency_check.mjs runs it). It checks:
//   1. THE SAME PICTURE: the calls that draw the picture (font, edge, fill, baseline, scale, strokeText and fillText with
//      their words and places) are the old Text's exactly, so a browser draws the same pixels
//   2. THE SAME QUAD AND SIZE: the texture frame (the quad the sprite draws, about the same anchor) is the Text's frame, and
//      the size it reports (textWidth, textHeight; getBounds) is the Text's .width and .height
//   3. THE SHARED CANVASES (2026-11-26): a label given new words, with others drawn between on the same scratch canvases,
//      draws the old Text's picture each time over a cleared canvas; its texture's size follows the rule (the next 64 px
//      step, grown past it, made again smaller at half its width or less); 48 labels hold at most three canvases; each
//      upload is a canvas of exactly the texture's size holding that label's words; a drawing drawn over is drawn again
//      before it is sent; a new style lets the texture go; a lost context draws a shown label again; the screen density's
//      numbers (on by default)
//   4. THE PIECES: a label needs its draw, then its upload, then nothing; new words need both again
//   5. WHEN EACH SHOWS: a line with no multiplier shows its win as its wire is complete, a multiplier line its plain amount
//      then and its win at the punch (labelDues; drawSlam's own thresholds)
// The pixels themselves, with the real fonts, are compared in a browser by led_board_probe.mjs section hitch
// (__reindeer.winTextCompare).
//   node --experimental-strip-types --no-warnings tools/win_text_check.mjs      (from apps/run_over_reindeer)
// Pass: every line PASS, "0 fail" and exit 0.
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const SDK = join(APP, '..', '..');
const LINGUI = pathToFileURL(join(APP, 'node_modules', '@lingui', 'core', 'dist', 'index.mjs')).href;
const STATE = `import { i18n } from ${JSON.stringify(LINGUI)};
export const stateBet = { currency: 'USD', wageredBetAmount: 1 };
export const stateI18n = { i18n };
export const setLocale = (l) => { i18n.load(l, {}); i18n.activate(l); };`;
const url = (src) => 'data:text/javascript,' + encodeURIComponent(src);
const STATE_URL = url(STATE);
const BET_URL = pathToFileURL(join(SDK, 'packages', 'constants-shared', 'bet.ts')).href;
const AMOUNT_URL = pathToFileURL(join(SDK, 'packages', 'utils-shared', 'amount.ts')).href;
const STAGING_STUB = url(`export const STAGING = false; export const STAGING_TOOLS = false; export const RESCAP_RANGE = { min: 1, max: 3 }; export const perfMarks = null; export const perfMark = () => {};`);
register(
	url(`export async function resolve(s, c, n) {
	if (s === 'state-shared') return { url: ${JSON.stringify(STATE_URL)}, shortCircuit: true };
	if (s === 'constants-shared/bet') return { url: ${JSON.stringify(BET_URL)}, shortCircuit: true };
	if (s === 'utils-shared/amount') return { url: ${JSON.stringify(AMOUNT_URL)}, shortCircuit: true };
	if (/(^|\\/)staging(\\.ts)?$/.test(s)) return { url: ${JSON.stringify(STAGING_STUB)}, shortCircuit: true };
	if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return n(s + '.ts', c);
	return n(s, c);
}`),
);

let pass = 0;
let fail = 0;
const check = (ok, msg, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail).slice(0, 900) : ''}`);
};

// ---- THE RECORDING CANVAS -------------------------------------------------------------------------------------------------
// Text is measured by a fixed rule from the font's px (a width per character, an ascent and a descent), the same for both
// ways, so the sizes and places Pixi works out are real numbers to compare.
const fontPx = (f) => parseFloat(/([\d.]+)px/.exec(f || '10px')?.[1] ?? '10');
const glyphW = (ch) => 0.45 + ((ch.codePointAt(0) * 37) % 20) / 100;
let canvasesMade = 0;
class RecCtx {
	constructor(canvas) {
		this.canvas = canvas;
		this.log = [];
		this.st = { font: '10px sans-serif' };
		return new Proxy(this, {
			get: (t, k) => {
				if (k in t) return t[k];
				if (k in t.st) return t.st[k];
				return (...a) => t.log.push([k, ...a.map((v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v))]);
			},
			set: (t, k, v) => {
				t.st[k] = v;
				t.log.push(['set', k, typeof v === 'object' ? JSON.stringify(v) : v]);
				return true;
			},
		});
	}
	measureText(str) {
		const px = fontPx(this.st.font);
		const w = [...String(str)].reduce((s, ch) => s + px * glyphW(ch), 0);
		return { width: w, actualBoundingBoxLeft: 0, actualBoundingBoxRight: w, actualBoundingBoxAscent: px * 0.78, actualBoundingBoxDescent: px * 0.22 };
	}
}
class RecCanvas {
	constructor(w = 300, h = 150) {
		canvasesMade += 1;
		this.width = w;
		this.height = h;
		this.ctx = null;
	}
	getContext() {
		return (this.ctx ??= new RecCtx(this));
	}
}
class Ctx2DClass {}
const PIXI = await import('pixi.js');
PIXI.DOMAdapter.set({
	createCanvas: (w, h) => new RecCanvas(w, h),
	getCanvasRenderingContext2D: () => Ctx2DClass,
	getWebGLRenderingContext: () => class {},
	getNavigator: () => ({ userAgent: 'node', gpu: null }),
	getBaseUrl: () => 'http://localhost/',
	getFontFaceSet: () => null,
	fetch: () => Promise.reject(new Error('no fetch')),
	parseXML: () => null,
});

const W = await import(pathToFileURL(join(APP, 'src', 'game', 'road', 'winLabelText.ts')).href);
const { LINE_WIN } = await import(pathToFileURL(join(APP, 'src', 'game', 'constants.ts')).href);
const state = await import(STATE_URL);
const hud = await import(pathToFileURL(join(APP, 'src', 'game', 'currency.ts')).href);
state.setLocale('en');

// the drawing calls of a canvas from Pixi's painter on (its resetTransform and scale), the clears left out
const drawing = (log) => {
	let i = -1;
	for (let k = 0; k < log.length - 1; k++) if (log[k][0] === 'resetTransform' && log[k + 1][0] === 'scale') i = k;
	return i < 0 ? null : log.slice(i).filter((e) => e[0] !== 'clearRect');
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// THE AMOUNTS: the game's own formatter, every currency below at a spread of amounts
const CURRENCIES = ['USD', 'EUR', 'JPY', 'BRL', 'INR', 'KWD', 'BTC', 'USDT', 'GC', 'SC', 'XQZ'];
const VALUES = [0.1, 0.4, 2.5, 12.4, 99.99, 1234.5, 77770];
const texts = [];
for (const c of CURRENCIES) {
	state.stateBet.currency = c;
	for (const v of VALUES) texts.push(hud.numberToCurrencyString(v));
}
state.stateBet.currency = 'USD';
const uniq = [...new Set(texts)];
check(uniq.length >= 60 && uniq.some((t) => t.includes('GC')) && uniq.some((t) => t.includes('€')) && uniq.some((t) => t.includes('¥')), `the amounts: ${uniq.length} texts in ${CURRENCIES.length} currencies (${uniq.slice(0, 6).join(' | ')} ...)`, uniq.slice(0, 20));

// the label scales: 1, and the upright phone's (Board.svelte's rule: capPx 18 at the 390 wide phone's road scale 412/1536)
const phoneScale = Math.max(1, LINE_WIN.slam.phone.capPx / (LINE_WIN.slam.capRatio * LINE_WIN.lights.amount.size * (412 / 1536)));
const cases = [];
for (const scale of [1, phoneScale]) {
	const S = W.slamLabelStyles(scale);
	for (const [name, o] of [
		['amount', S.face],
		['shadow', S.shadow],
	])
		for (const res of [1, 2, 3]) cases.push({ scale, name, o, res });
}

// 1, 2: every text in every case, the old Text's picture against an AheadText's
const bad1 = [];
const bad2 = [];
let compared = 0;
for (const c of cases) {
	for (const text of uniq) {
		const style = new PIXI.TextStyle(c.o);
		const sys = new PIXI.CanvasTextSystem({ resolution: c.res });
		const old = sys.createTextureAndCanvas({ text, style, resolution: c.res });
		const oldDraw = drawing(old.canvasAndContext.canvas.ctx.log);
		const a = new W.AheadText(c.o);
		a.text = text;
		a.step(c.res);
		const ck = a.canvasForCheck();
		const newDraw = drawing(ck.canvas.ctx.log);
		compared += 1;
		if (!oldDraw || !same(oldDraw, newDraw)) bad1.push({ case: `${c.name}@${c.res} x${c.scale.toFixed(3)}`, text, old: oldDraw?.slice(-3), new: newDraw?.slice(-3) });
		const t = new PIXI.Text({ text, style: c.o });
		const fo = old.texture.frame;
		const fn = a.texture.frame;
		const ok2 = Math.abs(fo.width - fn.width) < 1e-9 && Math.abs(fo.height - fn.height) < 1e-9 && a.texture.orig.width === fn.width && Math.abs(t.width - a.textWidth()) < 1e-9 && Math.abs(t.height - a.textHeight()) < 1e-9 && ck.w === Math.round(fo.width * c.res) && ck.h === Math.round(fo.height * c.res);
		const b = a.getLocalBounds();
		const tb = t.getLocalBounds();
		if (!ok2 || Math.abs(b.width - tb.width) > 1e-9 || Math.abs(b.height - tb.height) > 1e-9 || Math.abs(b.x - tb.x) > 1e-9) bad2.push({ text, case: `${c.name}@${c.res}`, frame: [fo.width, fo.height, fn.width, fn.height], size: [t.width, t.height, a.textWidth(), a.textHeight()], bounds: [tb.x, tb.width, b.x, b.width] });
		PIXI.CanvasPool.returnCanvasAndContext(old.canvasAndContext);
		t.destroy();
		a.destroy({ texture: true, textureSource: true });
	}
}
check(bad1.length === 0 && compared === cases.length * uniq.length, `1. the picture: the same drawing calls as the old Text's for all ${compared} (${uniq.length} amounts x 2 styles x 2 label scales x 3 resolutions)`, bad1.slice(0, 4));
check(bad2.length === 0, `2. the quad and the size: the texture frame, the reported width and height and the bounds are the Text's, all ${compared}`, bad2.slice(0, 4));

// 3: the shared scratch canvases (2026-11-26, winLabelText.ts THE MEMORY): no canvas per label, the texture's size by the rule
{
	const S = W.slamLabelStyles(phoneScale);
	const a = new W.AheadText(S.shadow);
	const order = ['$1,234.50', '$0.40', '12.40 GC', '¥77,770', '$12,345,678.90', '$2.50', '$0.10'];
	const bad = [];
	const sizes = [];
	const want = [];
	let model = null;
	// (what each scratch canvas held last, so every clear can be checked against it)
	const lastOn = new Map();
	const drawOn = (t, res) => {
		t.step(res);
		const ck = t.canvasForCheck();
		const log = ck.canvas.ctx.log;
		const lastReset = log.map((e, i) => (e[0] === 'scale' && log[i - 1]?.[0] === 'resetTransform' ? i - 1 : -1)).filter((i) => i >= 0).pop();
		const clear = log.slice(0, lastReset).filter((e) => e[0] === 'clearRect').pop();
		const prev = lastOn.get(ck.canvas);
		// (a canvas new or resized since is clear already; else the clear covers exactly what it held)
		const resized = prev && (prev.cw !== ck.canvas.width || prev.ch !== ck.canvas.height);
		if (prev && !resized && (!clear || clear[3] !== prev.w || clear[4] !== prev.h)) bad.push({ text: t.text, clear, prev });
		lastOn.set(ck.canvas, { w: ck.w, h: ck.h, cw: ck.canvas.width, ch: ck.canvas.height });
		const picture = drawing(log);
		log.length = 0;
		return { ck, picture };
	};
	for (const text of order) {
		a.text = text;
		const mine = drawOn(a, 3);
		// a fresh label drawn after it on the shared canvases: the same picture (a Text's)
		const fresh = new W.AheadText(S.shadow);
		fresh.text = text;
		const theirs = drawOn(fresh, 3);
		if (!mine.picture || !same(mine.picture, theirs.picture)) bad.push({ text, why: 'differs from a fresh label' });
		fresh.destroy({ texture: true, textureSource: true });
		// the rule, worked out apart: made when none, grown past the words, made again when they need half its width or less
		const { w, h } = W.textPixelSize(text, new PIXI.TextStyle(S.shadow), 3);
		const fitW = Math.ceil(w / 64) * 64;
		if (!model || model.w < w || model.h < h || fitW <= model.w * W.SHRINK_SHARE) model = { w: fitW, h };
		want.push(`${model.w}x${model.h}`);
		const held = a.held();
		sizes.push(held ? `${held.w}x${held.h}` : 'none');
	}
	check(bad.length === 0, `3. one label given new words ${order.length} times, a fresh label drawn between on the same shared canvases: each canvas cleared over exactly what it held (or new), the picture a fresh label's (a Text's) each time`, bad.slice(0, 3));
	check(same(sizes, want) && new Set(sizes).size >= 3, `3. its texture by the rule: made at the next 64 px step, grown only past it, made again smaller only at half its width or less (${sizes.join(', ')})`, { sizes, want });
	a.destroy({ texture: true, textureSource: true });
}
// 3: 48 labels (12 slots of four) hold no canvas of their own; each upload is of a scratch canvas exactly the texture's size,
// holding that label's drawing; between uploads every source points at the 1 x 1 blank
{
	const uploads = [];
	W.setAheadTextHost({ resolution: () => 3, upload: (src) => uploads.push({ rw: src.resource.width, rh: src.resource.height, w: src.pixelWidth, h: src.pixelHeight, last: src.resource.ctx?.log.filter((e) => e[0] === 'fillText').pop()?.[1] }) });
	const S = W.slamLabelStyles(phoneScale);
	const labs = [];
	for (let i = 0; i < 48; i++) {
		const t = new W.AheadText(i % 2 ? S.shadow : S.face);
		t.text = `$${(i * 37.25).toFixed(2)}`;
		labs.push(t);
	}
	const madeBefore = W.aheadCanvasesMade();
	for (const t of labs) t.ensure(3);
	const m = W.aheadMemory();
	const wrong = uploads.filter((u, i) => u.rw !== u.w || u.rh !== u.h || u.last !== labs[i].text);
	const blankAfter = labs.filter((t) => t.texture.source.resource.width !== 1).length;
	check(uploads.length === 48 && wrong.length === 0 && blankAfter === 0, `3. 48 labels sent: each upload a scratch canvas of exactly its texture's size holding its own words, every source on the 1 x 1 blank after (${uploads.length} uploads, ${wrong.length} wrong)`, wrong.slice(0, 2));
	check(m.canvasesHeld <= 3 && W.aheadCanvasesMade() - madeBefore <= 3 && m.textures >= 48, `3. the canvases held: ${m.canvasesHeld} (at most two scratch and the blank) for ${m.textures} textures (${m.gpuMB} MB), ${W.aheadCanvasesMade() - madeBefore} made for these 48`, m);
	// a drawing another label has drawn over is not sent: drawn again first, then sent with its own words (after an amount, a
	// shadow and another amount, the first one's scratch has been taken whatever the sizes: two canvases, two heights)
	const [p, x, y] = [labs[0], labs[1], labs[2]];
	p.text = '$9,999.99';
	x.text = '$8,888.88';
	y.text = '$7.77';
	const seq = [p.step(3), x.step(3), y.step(3), p.need(3), p.step(3), p.need(3)];
	uploads.length = 0;
	p.step(3);
	check(same(seq, ['draw', 'draw', 'draw', 'draw', 'draw', 'send']) && uploads.length === 1 && uploads[0].last === '$9,999.99', `3. drawn over on the shared canvas before its upload: it needs its draw again, and its upload holds its own words (${JSON.stringify(seq)}, sent ${uploads[0]?.last})`);
	// a new style lets the old texture go at once
	const r = labs[4];
	const had = !!r.held();
	r.setStyle(W.slamLabelStyles(1).face);
	check(had && r.held() === null && r.need(3) === 'draw', `3. a new style: its texture goes at once, drawn again at the new size when next shown`);
	// a lost context: a label shown is drawn and sent again at once, a hidden one waits for its draw
	const shown = labs[6];
	const hidden = labs[8];
	hidden.visible = false;
	uploads.length = 0;
	W.aheadContextChanged();
	check(shown.ready(3) && uploads.some((u) => u.last === shown.text) && hidden.need(3) === 'draw', `3. a WebGL context back: a label on screen drawn and sent again at once, one hidden flagged to draw (${uploads.length} sent)`);
	for (const t of labs) t.destroy({ texture: true, textureSource: true });
	W.setAheadTextHost(null);
	check(W.aheadMemory().labels === 0, `3. a destroyed label leaves the readout`);
}

// 3: the screen density's resolution (the default since Corey's "LR2", 2026-11-26): 3 per CSS px of the largest size on
// screen, never above the renderer's; on with no staging tools (only a staging `?labeldensity=full` turns it off)
{
	const up = W.screenLabelResolution(0.255, 1.35, 3);
	const side = W.screenLabelResolution(0.337, 1.35, 3);
	const desk = W.screenLabelResolution(0.7, 1.35, 2);
	check(Math.abs(up - 1.03) < 1e-9 && Math.abs(side - 1.36) < 1e-9 && desk === 2 && W.LABEL_SCREEN_DENSITY === true, `3. the screen density: ${up} upright, ${side} sideways (road scale 0.255, 0.337, peak 1.35), held to the renderer's ${desk}; on here by default (no staging tools)`);
}

// 4: the pieces of work
{
	const S = W.slamLabelStyles(1);
	const a = new W.AheadText(S.face);
	a.text = '$5.00';
	const seq = [a.need(2), a.step(2), a.need(2), a.step(2), a.need(2), a.step(2), a.ready(2)];
	a.text = '$6.00';
	const again = [a.need(2), a.ready(2)];
	a.ensure(2);
	const after = [a.ready(2), a.need(3)];
	check(same(seq, ['draw', 'draw', 'send', 'send', null, null, true]) && same(again, ['draw', false]) && same(after, [true, 'draw']), `4. the pieces: draw, then send, then ready; new words or a new resolution need the draw again (${JSON.stringify([seq, again, after])})`);
	a.destroy({ texture: true, textureSource: true });
}

// 5: when each shows
{
	const P = LINE_WIN.slam.beats;
	const at = P.plain + P.side + P.both + P.squash;
	const d1 = W.labelDues(500, false, 1.25, at);
	const d2 = W.labelDues(500, true, 1.25, at);
	check(d1.plain === null && d1.win === 500 && d2.plain === 500 && Math.abs(d2.win - (500 + at * 1.25)) < 1e-9, `5. when each shows: no multiplier, its win at the wire's end (${d1.win}); a multiplier, its plain amount then (${d2.plain}) and its win at the punch (${d2.win})`);
}

console.log(`\nwin_text_check: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
