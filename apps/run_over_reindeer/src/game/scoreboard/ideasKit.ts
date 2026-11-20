// THE ROUND 1 LED IDEAS' SHARED HELPERS (Corey's picks of 2026-11-19, led_anim_ideas_r1_2026-11-19: its core.ts, ported). They
// draw with the board's own picture pipeline (scoreboardDraw.ts sprite / art: the stepped downscale and the LED punch, baked
// once per size at the face's density) on the face's own canvases. One thing is the mock's own: a picture turned a quarter
// turn at a time (exact on the LED grid: whole LEDs move, nothing is resampled) or tinted over its lit LEDs.
import { mk, type Cv } from '../landing/ledScreens';
import { blitP, fillP, kOf } from './ledGrid';
import { art, artSize, scoreboardArtReady, sprite, type ArtName } from './scoreboardDraw';

export type Ctx = CanvasRenderingContext2D;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const ease = (t: number) => {
	t = clamp(t, 0, 1);
	return t * t * (3 - 2 * t);
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeIn = (t: number) => Math.pow(clamp(t, 0, 1), 2);
export const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const hash = (n: number) => {
	const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

/** the width in dots of a picture `h` dots tall (a src crop: the crop's aspect) */
export const picW = (name: ArtName, h: number, src: number[] | null = null) => {
	const [sw, sh] = artSize(name, src);
	return Math.max(1, Math.round((h * sw) / sh));
};
/** a picture `h` dots tall, its bottom at yB (flip mirrors it); its width in dots */
export const pic = (g: Ctx, name: ArtName, x: number, yB: number, h: number, flip = false, src: number[] | null = null): number => sprite(g, name, x, yB, h, flip, src);
/** the same centered on cx */
export function picC(g: Ctx, name: ArtName, cx: number, yB: number, h: number, flip = false, src: number[] | null = null): number {
	const w = picW(name, h, src);
	sprite(g, name, cx - w / 2, yB, h, flip, src);
	return w;
}

const turned = new Map<string, Cv>();
/** a picture turned a quarter turn `q` times and/or tinted (`tint` over its lit LEDs at `ta`), drawn with its box's bottom
 *  left at (x, yB) in dots, `h` the unturned height. Returns its box in dots and in LEDs (the probes). Baked once per size,
 *  turn and tint. */
export function picTurned(g: Ctx, name: ArtName, x: number, yB: number, h: number, q: number, flip = false, tint: string | null = null, ta = 0, src: number[] | null = null) {
	const k = kOf(g);
	const w = picW(name, h, src);
	q = ((q % 4) + 4) % 4;
	const key = `${name}|${src ? src.join(',') : ''}|${w}x${Math.round(h)}|${k}|${q}|${flip}|${tint}|${ta.toFixed(2)}`;
	let c = turned.get(key);
	if (!c) {
		const a = art(name, src, w, Math.round(h), k);
		const W0 = a.width;
		const H0 = a.height;
		c = mk(q % 2 ? H0 : W0, q % 2 ? W0 : H0);
		const t = c.ctx;
		t.save();
		if (q === 1) t.setTransform(0, 1, -1, 0, H0, 0);
		else if (q === 2) t.setTransform(-1, 0, 0, -1, W0, H0);
		else if (q === 3) t.setTransform(0, -1, 1, 0, 0, W0);
		if (flip) t.transform(-1, 0, 0, 1, W0, 0);
		t.drawImage(a, 0, 0);
		t.restore();
		if (tint && ta > 0) {
			t.globalCompositeOperation = 'source-atop';
			t.globalAlpha = ta;
			t.fillStyle = tint;
			t.fillRect(0, 0, c.width, c.height);
			t.globalAlpha = 1;
			t.globalCompositeOperation = 'source-over';
		}
		// (not kept until the sheet is in: art() hands back an empty canvas then)
		if (scoreboardArtReady()) {
			if (turned.size > 300) turned.clear();
			turned.set(key, c);
		}
	}
	const lx = Math.round(x * k);
	const ly = Math.round(yB * k) - c.height;
	blitP(g, c, lx, ly);
	return { w: c.width / k, h: c.height / k, led: [lx, ly, c.width, c.height] as [number, number, number, number] };
}

/** a rectangle in dots, its edges on whole LEDs (the face's fillRect snaps) */
export function box(g: Ctx, x: number, y: number, w: number, h: number, col: string, a = 1) {
	g.globalAlpha = a;
	g.fillStyle = col;
	g.fillRect(x, y, w, h);
	g.globalAlpha = 1;
}
/** a frame `t` dots thick round a box */
export function frame(g: Ctx, x: number, y: number, w: number, h: number, t: number, col: string, a = 1) {
	box(g, x, y, w, t, col, a);
	box(g, x, y + h - t, w, t, col, a);
	box(g, x, y, t, h, col, a);
	box(g, x + w - t, y, t, h, col, a);
}
/** one LED-sized square of `n` LEDs at (x, y) dots */
export function ledSq(g: Ctx, x: number, y: number, n: number, col: string) {
	const k = kOf(g);
	g.fillStyle = col;
	fillP(g, Math.round(x * k), Math.round(y * k), n, n);
}

/** THE LIT BOX of a bake, in its own LEDs (measured once per bake): the probes' boxes and the stack's contact */
const litBoxes = new WeakMap<object, [number, number, number, number]>();
export function litBox(a: Cv): [number, number, number, number] {
	const got = litBoxes.get(a);
	if (got) return got;
	const d = a.ctx.getImageData(0, 0, a.width, a.height).data;
	let l = a.width;
	let r = -1;
	let t = a.height;
	let b = -1;
	for (let y = 0; y < a.height; y++)
		for (let x = 0; x < a.width; x++)
			if (d[(y * a.width + x) * 4 + 3] > 0) {
				if (x < l) l = x;
				if (x > r) r = x;
				if (y < t) t = y;
				if (y > b) b = y;
			}
	const out: [number, number, number, number] = r < 0 ? [0, 0, 0, 0] : [l, t, r - l + 1, b - t + 1];
	if (r >= 0) litBoxes.set(a, out);
	return out;
}

/** WHAT THE IDEAS DREW on a face this step (the probes: the entries' presents, the tease's reel, the ladder's rungs, the
 *  stack's contact), cleared at the start of each step with the face's other records */
export type IdeasRec = Record<string, unknown>;
const ideasRec = new WeakMap<object, IdeasRec>();
export const ideasOf = (canvas: object): IdeasRec | null => ideasRec.get(canvas) ?? null;
export const clearIdeas = (canvas: object) => ideasRec.delete(canvas);
export function noteIdea(canvas: object, key: string, value: unknown) {
	let r = ideasRec.get(canvas);
	if (!r) ideasRec.set(canvas, (r = {}));
	r[key] = value;
}
