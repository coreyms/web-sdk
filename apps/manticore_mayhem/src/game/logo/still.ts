// THE LOGO, IN THE CANVAS (components/Logo.svelte owns it, constants LOGO the numbers): the Citadel Tablet (Corey
// 2026-11-16, images/logo_tablet_r1_2026-11-16, take A), a still picture in every layout and tier. It replaced the
// stacked logo with its animated wings and its glint (2026-11-17; Corey: "No glinting on the lettering").
// It is drawn in the canvas so the manticore can stand in front of it, in the same box as the chrome's <img>
// (game/logo/layout.ts), with the one thing the <img> wears:
//   the drop shadow   CSS drop-shadow(0 4px 8px rgba(0,0,0,0.7)). No filters in the canvas (house rule), so the
//                     shadow is baked ONCE into a small texture with a 2D canvas (its own shadowBlur, the same
//                     Gaussian) and drawn under the art
// THE ART'S OWN PIXELS: `content` is scaled so that one of its units is one px of the art (LOGO.artPx, 1893 x 620,
// whichever tier's file is loaded). `trace` is an empty container over the art in those same units: the place the
// groove line trace attaches in a later pass (game/logo/grooves.json is in art px; it is not loaded yet).
// A tick allocates nothing and runs only while a fade does.
import * as PIXI from 'pixi.js';

import { LOGO } from '../constants';

export type StillShadow = { dy: number; blur: number; alpha: number };
export type StillTiming = { fadeMs: number; shadowBakeWidth: number; artPx: { width: number; height: number } };

export class LogoStill {
	readonly root = new PIXI.Container();
	/** the art in ART px (scaled to the box): the picture, then the trace */
	readonly content = new PIXI.Container();
	/** THE GROOVE TRACE's place (empty for now): children here draw in the art's own px, over the picture */
	readonly trace = new PIXI.Container();
	/** THE PANEL (constants LOGO_KEY, components/Logo.svelte): `lettering` between the picture and the trace (the LOGO
	 *  state's name), `over` above the trace (the cover over the panel and the KEY), both in the art's own px */
	readonly lettering = new PIXI.Container();
	readonly over = new PIXI.Container();
	ready = false;

	private readonly timing: StillTiming;
	private readonly shadow = new PIXI.Sprite(PIXI.Texture.EMPTY);
	readonly art = new PIXI.Sprite(PIXI.Texture.EMPTY);
	private image: CanvasImageSource | null = null;
	private aspect = 1;
	private bakedBlur = -1;
	private alpha = 0;
	private alphaTarget = 0;
	// DEV / probe
	bakes = 0;
	box = { x: 0, y: 0, width: 0, height: 0 };

	constructor(timing: StillTiming) {
		this.timing = timing;
		this.root.label = 'logo-still';
		this.root.visible = false;
		this.root.alpha = 0;
		this.shadow.label = 'logo-still-shadow';
		this.art.label = 'logo-still-art';
		this.content.label = 'logo-art';
		this.trace.label = 'logo-trace';
		this.lettering.label = 'logo-lettering';
		this.over.label = 'logo-panel';
		this.content.addChild(this.art, this.lettering, this.trace, this.over);
		this.root.addChild(this.shadow, this.content);
	}

	/** `still`: the FRAME (game/assets.ts logoStill: logo-frame.webp, or its phone tier copy); `lettering`: its lettering
	 *  layer (logoLettering), cropped to constants LOGO.lettering.box of the frame's px and drawn there, in `lettering` */
	build(still: PIXI.Texture, lettering?: PIXI.Texture): void {
		this.art.texture = still;
		this.aspect = still.width / still.height;
		// the art in art px whatever the file's own size
		this.art.width = this.timing.artPx.width;
		this.art.height = this.timing.artPx.width / this.aspect;
		if (lettering) {
			const [x0, y0, x1, y1] = LOGO.lettering.box;
			const k = this.timing.artPx.width / LOGO.art.width;
			const sp = new PIXI.Sprite(lettering);
			sp.label = 'logo-lettering-art';
			sp.position.set(x0 * k, y0 * k);
			sp.setSize((x1 - x0) * k, (y1 - y0) * k);
			this.lettering.removeChildren().forEach((c) => c.destroy());
			this.lettering.addChild(sp);
		}
		this.image = (still.source.resource as CanvasImageSource) ?? null;
		this.ready = true;
	}

	/** the art box's corner and width in canvas px; the shadow's offset and blur in the same px */
	place(x: number, y: number, width: number, shadow: StillShadow): void {
		if (!this.ready) return;
		const height = width / this.aspect;
		this.box = { x, y, width, height };
		this.root.position.set(x, y);
		this.content.scale.set(width / this.timing.artPx.width);
		// the shadow: baked at shadowBakeWidth px of art, redone only when the blur's share of the width changes
		const B = this.timing.shadowBakeWidth;
		const blur = Math.round(((shadow.blur * B) / width) * 4) / 4;
		const pad = Math.ceil(blur * 1.5) + 2;
		if (blur !== this.bakedBlur) this.bake(B, blur, pad);
		const k = width / B;
		this.shadow.scale.set(k);
		this.shadow.position.set(-pad * k, -pad * k + shadow.dy);
		this.shadow.alpha = shadow.alpha;
	}

	private bake(B: number, blur: number, pad: number): void {
		if (!this.image || typeof document === 'undefined') return;
		const h = Math.round(B / this.aspect);
		const canvas = document.createElement('canvas');
		canvas.width = B + pad * 2;
		canvas.height = h + pad * 2;
		const g = canvas.getContext('2d');
		if (!g) return;
		// the picture itself is drawn off the canvas; only its shadow lands on it
		const off = canvas.width + B;
		g.shadowColor = '#000';
		g.shadowBlur = blur;
		g.shadowOffsetX = off;
		g.drawImage(this.image, pad - off, pad, B, h);
		const old = this.shadow.texture;
		this.shadow.texture = PIXI.Texture.from(canvas);
		if (old !== PIXI.Texture.EMPTY) old.destroy(true);
		this.bakedBlur = blur;
		this.bakes += 1;
	}

	/** fade in / out with the HUD (`instant`: no fade) */
	show(on: boolean, instant = false): void {
		this.alphaTarget = on ? 1 : 0;
		if (!instant) return;
		this.alpha = this.alphaTarget;
		this.root.alpha = this.alpha;
		this.root.visible = this.alpha > 0;
	}

	get shown(): boolean {
		return this.alphaTarget > 0;
	}

	/** false when nothing is left to do (no fade running) */
	tick(dtMs: number): boolean {
		if (this.alpha !== this.alphaTarget) {
			const step = dtMs / this.timing.fadeMs;
			this.alpha = this.alphaTarget > this.alpha ? Math.min(this.alphaTarget, this.alpha + step) : Math.max(this.alphaTarget, this.alpha - step);
			this.root.alpha = this.alpha;
			this.root.visible = this.alpha > 0;
		}
		return this.alpha !== this.alphaTarget;
	}

	state() {
		const t = this.art.texture;
		return {
			ready: this.ready,
			shown: this.shown,
			alpha: this.alpha,
			visible: this.root.visible,
			box: { ...this.box },
			bakes: this.bakes,
			/** the loaded file's own size, px, and the art's (the trace's units) */
			texture: [t.source.pixelWidth, t.source.pixelHeight],
			artPx: [this.timing.artPx.width, this.timing.artPx.height],
			contentScale: this.content.scale.x,
			traceChildren: this.trace.children.length,
			shadow: { x: this.shadow.x, y: this.shadow.y, scale: this.shadow.scale.x, alpha: this.shadow.alpha, w: this.shadow.texture.width, h: this.shadow.texture.height },
		};
	}
}
