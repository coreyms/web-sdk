// The plaque's text as raw Pixi sprites (the ArtAmount pattern: one container, pooled glyph sprites off one
// resident atlas, so a changing amount costs a few transforms and no raster or upload).
//   PlaqueText   one row of forged glyphs, centred on its position (x centre, cap centre)
//   PlaqueTitle  one baked polished gold title image, with its additive ember halo where the title has one
import * as PIXI from 'pixi.js';

import { GlyphRun, type PlaqueFont } from './text';
import type { StingerJson } from './types';

type Textures = Record<string, PIXI.Texture>;

export class PlaqueText {
	readonly view = new PIXI.Container();
	/** characters of the last string the atlas lacks ('' = none) */
	missing = '';
	private run = new GlyphRun();
	private last = '';
	private lastPx = 0;
	private lastMax = 0;
	private lastTabular = false;
	private lastReserve: string | undefined;
	private lastFit: string | undefined;
	private textures: PIXI.Texture[];

	constructor(
		private font: PlaqueFont,
		atlas: Textures,
	) {
		this.textures = font.frames.map((f) => atlas[f] ?? PIXI.Texture.EMPTY);
	}

	/** set the row; a no-op when nothing changed (so it can be called every frame of a count) */
	set(text: string, px: number, opts: { maxWidth?: number; tabular?: boolean; reserve?: string; fit?: string } = {}): void {
		const max = opts.maxWidth ?? 0;
		const tabular = !!opts.tabular;
		if (text === this.last && px === this.lastPx && max === this.lastMax && tabular === this.lastTabular && opts.reserve === this.lastReserve && opts.fit === this.lastFit) return;
		this.last = text;
		this.lastPx = px;
		this.lastMax = max;
		this.lastTabular = tabular;
		this.lastReserve = opts.reserve;
		this.lastFit = opts.fit;
		this.missing = this.font.missing(text);
		const run = this.font.layout(text, px, this.run, opts);
		const kids = this.view.children as PIXI.Sprite[];
		while (kids.length < run.count) this.view.addChild(new PIXI.Sprite(PIXI.Texture.EMPTY));
		for (let i = 0; i < kids.length; i += 1) {
			const s = kids[i];
			if (i >= run.count) {
				s.visible = false;
				continue;
			}
			s.texture = this.textures[run.frame[i]];
			s.position.set(run.x[i], run.y[i]);
			s.setSize(run.w[i], run.h[i]);
			s.visible = true;
		}
	}

	get text(): string {
		return this.last;
	}

	get width(): number {
		return this.run.width;
	}
}

export class PlaqueTitle {
	readonly view = new PIXI.Container();
	private glow = new PIXI.Sprite(PIXI.Texture.EMPTY);
	private face = new PIXI.Sprite(PIXI.Texture.EMPTY);
	/** the halo's own strength (titles[name].glow.alpha); glowGain() fades it in */
	private glowBase = 0;
	name = '';

	constructor(
		private titles: StingerJson['text']['titles'],
		private atlas: Textures,
	) {
		this.glow.blendMode = 'add';
		this.view.addChild(this.glow, this.face);
	}

	/** the title image `name` at cap height `capPx`, centred on the view's position (x centre, cap centre) */
	set(name: string, capPx: number, maxWidth?: number): void {
		const t = this.titles[name];
		this.name = t ? name : '';
		this.view.visible = !!t;
		if (!t) return;
		let sc = capPx / t.cap;
		if (maxWidth && t.w * sc > maxWidth) sc = maxWidth / t.w;
		const left = (-t.w / 2) * sc;
		const top = -(t.baseline - t.cap / 2) * sc;
		this.face.texture = this.atlas[t.frame] ?? PIXI.Texture.EMPTY;
		this.face.position.set(left, top);
		this.face.setSize(t.w * sc, t.h * sc);
		const g = t.glow;
		this.glow.visible = !!g;
		if (g) {
			// glow.dx / dy: its top left relative to the title image's top left, in title px
			this.glow.texture = this.atlas[`${t.frame}_glow`] ?? PIXI.Texture.EMPTY;
			this.glow.position.set(left + g.dx * sc, top + g.dy * sc);
			this.glow.setSize(g.w * sc, g.h * sc);
			this.glow.tint = parseInt(g.tint.slice(1), 16);
			this.glowBase = g.alpha;
			this.glow.alpha = g.alpha;
		}
	}

	/** the halo at `k` of its strength (0 .. 1): it fades in behind an Epic / Max title */
	glowGain(k: number): void {
		if (this.glow.visible) this.glow.alpha = this.glowBase * k;
	}
}
