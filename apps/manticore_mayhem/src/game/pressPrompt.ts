// THE IN-GAME PRESS ANYWHERE TO CONTINUE IN CINZEL (fonts r2, Corey 2026-10-17 14:01, option 1 of fonts r1's AUDIT.md).
// Up to r1 it was drawn from the baked Black Ops One numerals atlas (ArtAmount); now it is the game's display face,
// Cinzel 700, like every other title and like the landing screen's own PRESS ANYWHERE.
//
// HOW IT IS DRAWN (the pattern of the plaque's marquee, components/BoardPlaque.svelte): the line is drawn ONCE with the
// 2D canvas into a canvas this file owns, at the size it lands on screen (master units x the layout's scale x the
// renderer's resolution, so one texel is one device pixel), and that canvas is the texture of plain Sprites. Not a
// PIXI.Text: Pixi 8.8.1's CanvasTextPipe is the renderable GC crash path (components/Game.svelte). The texture is kept
// in a small cache shared by every prompt (feature intro, wrap up, max win: the same words at the same size in one
// layout), so it is drawn the first time a prompt shows and reused after; it is drawn again only when the layout or
// the renderer's resolution changes it (a new key). The blink is the sprites' alpha, so nothing is drawn per frame.
//
// THE FACE: the texture is never drawn before Cinzel itself is in (pressPromptFace waits on document.fonts.load and
// checks the face that came back is Cinzel's, loaded). If it can not load, the prompt falls back to the atlas
// (components/PressPromptText.svelte), never to a canvas fallback face.
//
// PRESENTATION ONLY: nothing here reads or changes an outcome.
import * as PIXI from 'pixi.js';

import { PRESS_PROMPT } from './constants';

// ---- the face ----------------------------------------------------------------------------------------------------
let facePromise: Promise<boolean> | null = null;
let faceReady = false;
/** true once pressPromptFace has said yes (so a prompt mounted later draws in its first frame) */
export const pressPromptFaceReady = () => faceReady;
/** true once Cinzel 700 is loaded (and only then); false when it can not be (the caller keeps the atlas) */
export const pressPromptFace = (): Promise<boolean> => {
	if (facePromise) return facePromise;
	if (typeof document === 'undefined' || !document.fonts) return (facePromise = Promise.resolve(false));
	facePromise = document.fonts
		.load(PRESS_PROMPT.fontCheck, PRESS_PROMPT.text)
		.then((faces) => (faceReady = faces.some((f) => f.family.replace(/["']/g, '') === PRESS_PROMPT.family && f.status === 'loaded')))
		.catch(() => false);
	return facePromise;
};

// ---- the layout --------------------------------------------------------------------------------------------------
/** the canvas the words are measured on (never a texture) */
let measureCtx: CanvasRenderingContext2D | null = null;
const measurer = () => (measureCtx ??= document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D);
const fontAt = (px: number) => `${PRESS_PROMPT.weight} ${px}px ${PRESS_PROMPT.family}, serif`;

/** each letter's x from the line's start at font size `px`, tracked by PRESS_PROMPT.trackEm (the landing's 0.05em):
 *  the prefix widths keep the face's own kerning, the tracking goes after every letter but the last. Returns the
 *  letters' x and the whole advance */
const lineAt = (g: CanvasRenderingContext2D, px: number) => {
	g.font = fontAt(px);
	const text = PRESS_PROMPT.text;
	const track = PRESS_PROMPT.trackEm * px;
	const xs: number[] = [];
	for (let i = 0; i < text.length; i += 1) xs.push(g.measureText(text.slice(0, i)).width + i * track);
	const width = g.measureText(text).width + (text.length - 1) * track;
	return { xs, width };
};

/** the font size (master units) whose capitals are `cap` tall, shrunk with the cap until the line fits `maxWidth`:
 *  ArtAmount's own fit (the same slot, the same height, the same maxWidth) */
const sizeFor = (cap: number, maxWidth: number | undefined) => {
	const g = measurer();
	const ref = PRESS_PROMPT.measurePx;
	g.font = fontAt(ref);
	const capK = g.measureText('H').actualBoundingBoxAscent / ref;
	const font = cap / capK;
	const width = (lineAt(g, ref).width / ref) * font;
	const fit = maxWidth && width > maxWidth ? maxWidth / width : 1;
	return { font: font * fit, cap: cap * fit, width: width * fit, capK };
};

// ---- the texture cache -------------------------------------------------------------------------------------------
export type PressPromptRaster = {
	key: string;
	texture: PIXI.Texture;
	/** device px per master unit it was drawn at (the sprite's scale is 1 / px) */
	px: number;
	/** the sprite's anchor: the line's centre across, its baseline down */
	anchor: { x: number; y: number };
	/** DEV: what was drawn */
	info: { fontPx: number; capPx: number; size: [number, number]; capUnits: number; widthUnits: number };
};
type Entry = { raster: PressPromptRaster; canvas: HTMLCanvasElement; refs: number };
const cache = new Map<string, Entry>();
/** the newest keys, newest first: kept even with no user (PRESS_PROMPT.keep of them; the desktop's over the board size
 *  and the max win's band size are two), so the next prompt at that size reuses its texture */
let recent: string[] = [];
const stats = { drawn: 0, freed: 0 };

const free = (key: string) => {
	const e = cache.get(key);
	if (!e) return;
	cache.delete(key);
	e.raster.texture.destroy(true);
	e.canvas.width = e.canvas.height = 0;
	stats.freed += 1;
};

/** draw the line once: white letters (the sprites tint them) over the landing's soft shadow, baked in */
const draw = (key: string, cap: number, maxWidth: number | undefined, px: number): Entry => {
	const size = sizeFor(cap, maxWidth);
	const fontPx = size.font * px;
	const g0 = measurer();
	const { xs, width } = lineAt(g0, fontPx);
	g0.font = fontAt(fontPx);
	const m = g0.measureText(PRESS_PROMPT.text);
	const soft = PRESS_PROMPT.soft;
	const blur = soft.blurEm * fontPx;
	const drop = soft.dyEm * fontPx;
	// room for the letters' overhang and the soft shadow on every side
	const pad = Math.ceil(blur * PRESS_PROMPT.padBlurs + PRESS_PROMPT.padEm * fontPx);
	const ascent = Math.ceil(m.actualBoundingBoxAscent);
	const descent = Math.ceil(m.actualBoundingBoxDescent + drop);
	const cw = Math.min(PRESS_PROMPT.texMax, Math.ceil(width) + 2 * pad);
	const ch = Math.min(PRESS_PROMPT.texMax, ascent + descent + 2 * pad);
	const canvas = document.createElement('canvas');
	canvas.width = cw;
	canvas.height = ch;
	const g = canvas.getContext('2d') as CanvasRenderingContext2D;
	g.font = fontAt(fontPx);
	g.textAlign = 'left';
	g.textBaseline = 'alphabetic';
	const x0 = pad;
	const base = pad + ascent;
	const text = PRESS_PROMPT.text;
	// pass 1, the soft shadow alone: every letter is drawn a canvas width off to the left and its shadow thrown back by
	// the same, so only the shadows land (a letter's shadow never darkens the letter before it)
	const far = cw + pad;
	g.shadowColor = soft.color;
	g.shadowBlur = blur;
	g.shadowOffsetX = far;
	g.shadowOffsetY = drop;
	g.fillStyle = '#ffffff';
	for (let i = 0; i < text.length; i += 1) g.fillText(text[i], x0 + xs[i] - far, base);
	// pass 2, the letters
	g.shadowColor = 'rgba(0, 0, 0, 0)';
	g.shadowBlur = 0;
	g.shadowOffsetX = 0;
	g.shadowOffsetY = 0;
	for (let i = 0; i < text.length; i += 1) g.fillText(text[i], x0 + xs[i], base);
	const source = new PIXI.CanvasSource({ resource: canvas as unknown as PIXI.ICanvas, resolution: 1, scaleMode: 'linear', label: 'press-prompt' });
	const texture = new PIXI.Texture({ source, label: 'press-prompt' });
	stats.drawn += 1;
	return {
		canvas,
		refs: 0,
		raster: {
			key,
			texture,
			px,
			anchor: { x: (x0 + width / 2) / cw, y: base / ch },
			info: { fontPx: Math.round(fontPx * 100) / 100, capPx: Math.round(size.capK * fontPx * 100) / 100, size: [cw, ch], capUnits: size.cap, widthUnits: size.width },
		},
	};
};

/** the line's texture for capitals `cap` master units tall, fitted to `maxWidth`, at `px` device px per master unit.
 *  Call pressPromptRelease with the same raster when done with it. Only call once pressPromptFace() said true */
export const pressPromptTake = (cap: number, maxWidth: number | undefined, px: number): PressPromptRaster => {
	const key = `${cap.toFixed(3)}|${maxWidth ?? 0}|${px.toFixed(4)}`;
	let e = cache.get(key);
	if (!e) {
		e = draw(key, cap, maxWidth, px);
		cache.set(key, e);
	}
	e.refs += 1;
	recent = [key, ...recent.filter((k) => k !== key)];
	// a key that fell off the recent list is let go once nobody shows it
	for (const old of recent.splice(PRESS_PROMPT.keep)) if (cache.get(old)?.refs === 0) free(old);
	return e.raster;
};

export const pressPromptRelease = (raster: PressPromptRaster) => {
	const e = cache.get(raster.key);
	if (!e) return;
	e.refs = Math.max(0, e.refs - 1);
	if (e.refs === 0 && !recent.includes(raster.key)) free(raster.key);
};

/** DEV (`__manticore.pressPromptTex()`): what is cached and how many times the line was drawn and freed */
export const pressPromptStats = () => ({
	drawn: stats.drawn,
	freed: stats.freed,
	recent: [...recent],
	cached: [...cache.values()].map((e) => ({ key: e.raster.key, refs: e.refs, ...e.raster.info })),
});
