// THE PLAQUE'S TITLE TREATMENTS (bigwin-title r1, 2026-10-16; design review 2026-10-15 item 3). One interface, the
// look picked by BIG_TITLE.look (the ?bwtitle switch went 2026-10-18 with the forge bake, Corey: "Let's do that archive"):
//   0 shipped  the plaque's own polished gold title (game/stinger/plaqueText.ts PlaqueTitle), as submitted
//   1 rim      the same baked image, no new texture: a dark outline from RIM_STEPS dark copies set in a ring around
//              it, and an additive copy over it that lifts the gold toward white
//   2 forge    the bright bake (tools/build_bigwin_titles.py): white to gold to deep amber, one thick dark outline.
//              ARCHIVED 2026-10-18 (~/Desktop/_archive/manticore-bigwin-titles-forge-2026-10-18): no longer loadable
//   3 molten   the bright bake, hotter: white to gold to fire orange, a dark red rim inside a black outline. The
//              default since r2 (Corey 2026-10-17 11:56)
// The feature intro's three titles are in their mode's colour on 3 (baked) and tinted on 1. Every look is plain
// sprites off a resident atlas: no filter, no mask, nothing rastered at runtime.
import * as PIXI from 'pixi.js';

import { BIG_TITLE } from '../constants';
import { BIG_TITLE_SPEC, type BigTitleLook } from './bigTitleSpec';
import { PlaqueTitle } from './plaqueText';
import type { StingerJson } from './types';

type Textures = Record<string, PIXI.Texture>;

export type TitleVariant = 0 | 1 | 3;

/** the look on this page: BIG_TITLE.look */
export const titleVariant = (): TitleVariant => BIG_TITLE.look;
/** the baked atlas the page loads: molten, the only bake shipped (looks 0 and 1 draw from the plaque's own titles; the
 *  bake still loads, so the plaque's asset group is the same whichever look is set) */
export const bakedLook = (): BigTitleLook => 'molten';

/** what view.ts asks of a title, whichever look draws it */
export interface StingerTitle {
	readonly view: PIXI.Container;
	name: string;
	/** the title `name` (win_big .. win_max, total_win, intro_<mode>) at cap height `capPx`, centred on the view's
	 *  position (x centre, cap centre), shrunk to `maxWidth` */
	set(name: string, capPx: number, maxWidth?: number): void;
	/** the Epic / Max halo at k of its strength (0..1) */
	glowGain(k: number): void;
}

/** look 1: the shipped image with a dark ring of copies under it and an additive lift over it */
class RimTitle implements StingerTitle {
	readonly view = new PIXI.Container();
	private inner: PlaqueTitle;
	private rims: PlaqueTitle[];
	private lift: PlaqueTitle;
	name = '';

	constructor(titles: StingerJson['text']['titles'], atlas: Textures) {
		const R = BIG_TITLE.rim;
		this.rims = Array.from({ length: R.steps }, () => new PlaqueTitle(titles, atlas));
		this.inner = new PlaqueTitle(titles, atlas);
		this.lift = new PlaqueTitle(titles, atlas);
		this.lift.view.blendMode = 'add';
		this.lift.view.alpha = R.liftAlpha;
		this.rims.forEach((r, i) => {
			r.view.tint = R.color;
			const a = (i / R.steps) * Math.PI * 2;
			r.view.position.set(Math.cos(a), Math.sin(a) + R.dropShare);
		});
		this.view.addChild(...this.rims.map((r) => r.view), this.inner.view, this.lift.view);
	}

	set(name: string, capPx: number, maxWidth?: number): void {
		const R = BIG_TITLE.rim;
		this.inner.set(name, capPx, maxWidth);
		this.lift.set(name, capPx, maxWidth);
		this.name = this.inner.name;
		const px = R.px * (capPx / 50);
		this.rims.forEach((r, i) => {
			r.set(name, capPx, maxWidth);
			r.glowGain(0); // the halo once, under the face (the inner title's)
			const a = (i / R.steps) * Math.PI * 2;
			r.view.position.set(Math.cos(a) * px, Math.sin(a) * px + R.dropShare * px);
		});
		// the feature titles take their mode's colour (a multiply on the gold) instead of the lift
		const mode = name.startsWith('intro_') ? name.slice(6) : '';
		const tint = mode ? (BIG_TITLE.modeTint as Record<string, number>)[mode] ?? 0xffffff : 0xffffff;
		this.inner.view.tint = tint;
		this.lift.view.visible = !mode;
	}

	glowGain(k: number): void {
		this.inner.glowGain(k);
	}
}

/** look 3: one baked sprite (the outline and shadow are in the image) */
class BakedTitle implements StingerTitle {
	readonly view = new PIXI.Container();
	private face = new PIXI.Sprite(PIXI.Texture.EMPTY);
	name = '';

	constructor(
		private look: BigTitleLook,
		private atlas: Textures,
	) {
		this.view.addChild(this.face);
	}

	set(name: string, capPx: number, maxWidth?: number): void {
		const box = BIG_TITLE_SPEC[this.look][name];
		const tex = this.atlas[`bwt_${this.look}_${name}`];
		this.name = box && tex ? name : '';
		this.view.visible = !!this.name;
		if (!this.name) return;
		const [w, h, baseline, cap] = box;
		let sc = capPx / cap;
		if (maxWidth && w * sc > maxWidth) sc = maxWidth / w;
		this.face.texture = tex;
		this.face.position.set((-w / 2) * sc, -(baseline - cap / 2) * sc);
		this.face.setSize(w * sc, h * sc);
	}

	glowGain(): void {}
}

/** the title object for this page's look (view.ts makes two: the one on show and the one a tier up sends out) */
export const makeTitle = (variant: TitleVariant, titles: StingerJson['text']['titles'], atlas: Textures): StingerTitle => {
	if (variant === 0) return new PlaqueTitle(titles, atlas);
	if (variant === 1) return new RimTitle(titles, atlas);
	const look = bakedLook();
	// the bake not in (it rides the plaque's own asset group, so this is a failed file): the shipped title, never nothing
	if (!atlas[`bwt_${look}_win_big`]) return new PlaqueTitle(titles, atlas);
	return new BakedTitle(look, atlas);
};

/** the feature intro's mode emblem (r4: the board's own symbol over its soft mode glow, baked with its lean into the same atlas; r5: and its
 *  turn): the frame's ship box w x h (drawn 1:1) and the art's height before the lean it was baked at, or null */
export const emblemTexture = (mode: string, atlas: Textures): { texture: PIXI.Texture; w: number; h: number; upright: number } | null => {
	const look = bakedLook();
	const box = BIG_TITLE_SPEC[look][`emblem_${mode}`];
	const texture = atlas[`bwt_${look}_emblem_${mode}`];
	return box && texture ? { texture, w: box[0], h: box[1], upright: box[3] } : null;
};
