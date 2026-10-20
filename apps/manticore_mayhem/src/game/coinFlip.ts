// THE TURNING MEDALLION'S SHEET (constants COIN_FLIP; Corey 2026-10-20): the Wild's 3D medallion turning, 16 frames over
// half a turn, for the Max Win rain (game/medallionRain.ts) and the plaque's escalation coins (game/stinger/escalation.ts).
// Asked for once the deferred phase and the Armoury core are in (components/Game.svelte), never before PRESS ANYWHERE;
// both read `coinFlipFrames()` every tick and keep the flat W.png until it answers. A plain stamped URL (never a blob:).
// The 16 frame textures are cut once when it lands; nothing is made per frame.
import * as PIXI from 'pixi.js';

import { stamp } from './assets';
import { COIN_FLIP } from './constants';

const SHEET_URL = stamp(new URL('../../assets/sprites/mmSymbols/w-flip.webp', import.meta.url).href);

let frames: PIXI.Texture[] | null = null;
let load: Promise<PIXI.Texture[] | null> | null = null;

/** the 16 frames (null until the sheet is in) */
export const coinFlipFrames = (): PIXI.Texture[] | null => frames;

/** the frame for a turn of `turns` (1 = a full turn): the two faced coin repeats every half turn */
export const coinFlipFrame = (list: PIXI.Texture[], turns: number): PIXI.Texture => {
	const t = turns * 360;
	const u = ((t % 180) + 180) % 180;
	return list[Math.round(u / COIN_FLIP.stepDeg) % COIN_FLIP.frames];
};

/** fetch the sheet and cut it, once (a no-op while it is in or on its way); up to the GPU at once when `renderer` is
 *  given, so the first Super or Max Win uploads nothing. Never rejects: a failure leaves the flat medallion */
export const loadCoinFlip = (renderer?: PIXI.Renderer): Promise<PIXI.Texture[] | null> => {
	if (typeof window === 'undefined') return Promise.resolve(null);
	load ??= (PIXI.Assets.load(SHEET_URL) as Promise<PIXI.Texture>)
		.then((sheet) => {
			const { frame, gutter, columns } = COIN_FLIP;
			const cut: PIXI.Texture[] = [];
			for (let i = 0; i < COIN_FLIP.frames; i += 1) {
				const x = gutter + (i % columns) * (frame + gutter);
				const y = gutter + Math.floor(i / columns) * (frame + gutter);
				cut.push(new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(x, y, frame, frame) }));
			}
			void renderer?.prepare?.upload(sheet.source);
			frames = cut;
			return cut;
		})
		.catch((error) => {
			console.error('[manticore] the turning medallion sheet failed to load', error);
			return null;
		});
	return load;
};

/** DEV probe surface on the shared __manticore object: is the sheet in, and the frame a turn picks */
if (import.meta.env.DEV && typeof window !== 'undefined') {
	const m = ((window as unknown as { __manticore?: Record<string, unknown> }).__manticore ??= {});
	m.coinFlip = () => ({ loaded: !!frames, frames: frames?.length ?? 0, url: SHEET_URL, frameFor: (deg: number) => (frames ? frames.indexOf(coinFlipFrame(frames, deg / 360)) : -1) });
}
