// THE LOGO'S STILL, IN THE CANVAS (2026-10-13; components/Logo.svelte owns it, constants LOGO.still the numbers).
// Until then the still was an <img> in the HTML chrome, which is over the whole canvas, so the manticore could never
// stand in front of it. Now every logo is drawn in the canvas, under him: this still wherever the animated logo is not
// (the phone tier, every portrait screen, the phone master, and as the desktop's stand-in until its atlas is in).
// It is the same picture in the same box as the <img> was (game/logo/layout.ts), with the two things the <img> wore:
//   the drop shadow   CSS drop-shadow(0 4px 8px rgba(0,0,0,0.7)). No filters in the canvas (house rule), so the
//                     shadow is baked ONCE into a small texture with a 2D canvas (its own shadowBlur, the same
//                     Gaussian) and drawn under the art
//   the Shine         ui/Shine.svelte: a white band masked by the letters (logo-stacked-glint.webp, white + alpha).
//                     No masks in the canvas (house rule): the glint texture is cut into vertical strips (frames of
//                     the one source) and the band is each strip's opacity, a subtle sweep every idleMs and a full
//                     one on `bet`
// A tick allocates nothing and writes only while a sweep or a fade runs.
import * as PIXI from 'pixi.js';

export type StillShadow = { dy: number; blur: number; alpha: number };
export type StillTiming = {
	fadeMs: number;
	shadowBakeWidth: number;
	shine: { strips: number; band: number; from: number; to: number; peak: number; idleMs: number; idleSweepMs: number; idleRampMs: number; idleOpacity: number; bigMs: number; bigRampAt: number; press: boolean };
};

export class LogoStill {
	readonly root = new PIXI.Container();
	ready = false;
	/** the sweeps run (off: the desktop's stand-in, reduced motion) */
	shine = false;

	private readonly timing: StillTiming;
	private readonly shadow = new PIXI.Sprite(PIXI.Texture.EMPTY);
	private readonly art = new PIXI.Sprite(PIXI.Texture.EMPTY);
	private readonly strips: PIXI.Sprite[] = [];
	private image: CanvasImageSource | null = null;
	private aspect = 1;
	private bakedBlur = -1;
	private alpha = 0;
	private alphaTarget = 0;
	/** the current sweep: when it started and whether it is the full one; the idle cycle restarts after it */
	private sweepAt = -1;
	private big = false;
	private lit = false;
	// DEV / probe
	bakes = 0;
	sweeps = 0;
	box = { x: 0, y: 0, width: 0, height: 0 };

	constructor(timing: StillTiming) {
		this.timing = timing;
		this.root.label = 'logo-still';
		this.root.visible = false;
		this.root.alpha = 0;
		this.shadow.label = 'logo-still-shadow';
		this.art.label = 'logo-still-art';
		this.root.addChild(this.shadow, this.art);
	}

	/** `still`: logo-stacked.webp; `glint`: its letters as white + alpha (null: no Shine) */
	build(still: PIXI.Texture, glint: PIXI.Texture | null): void {
		this.art.texture = still;
		this.aspect = still.width / still.height;
		this.image = (still.source.resource as CanvasImageSource) ?? null;
		if (glint) {
			const n = this.timing.shine.strips;
			const w = glint.frame.width / n;
			for (let i = 0; i < n; i += 1) {
				const s = new PIXI.Sprite(new PIXI.Texture({ source: glint.source, frame: new PIXI.Rectangle(glint.frame.x + i * w, glint.frame.y, w, glint.frame.height) }));
				s.label = 'logo-still-glint';
				s.alpha = 0;
				s.visible = false;
				this.strips.push(s);
				this.root.addChild(s);
			}
		}
		this.ready = true;
	}

	/** the art box's corner and width in canvas px; the shadow's offset and blur in the same px */
	place(x: number, y: number, width: number, shadow: StillShadow): void {
		if (!this.ready) return;
		const height = width / this.aspect;
		this.box = { x, y, width, height };
		this.root.position.set(x, y);
		this.art.width = width;
		this.art.height = height;
		const n = this.strips.length;
		for (let i = 0; i < n; i += 1) {
			const s = this.strips[i];
			s.position.set((i * width) / n, 0);
			s.width = width / n;
			s.height = height;
		}
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

	/** a sweep from `now`: the full one (a spin was pressed) or the idle's */
	sweep(now: number, big: boolean): void {
		if (!this.shine || !this.strips.length) return;
		this.sweepAt = now;
		this.big = big;
		this.sweeps += 1;
	}

	private dark(): void {
		if (!this.lit) return;
		this.lit = false;
		for (const s of this.strips) {
			s.alpha = 0;
			s.visible = false;
		}
	}

	/** false when nothing is left to do (no fade running, no Shine to keep time for) */
	tick(now: number, dtMs: number): boolean {
		if (this.alpha !== this.alphaTarget) {
			const step = dtMs / this.timing.fadeMs;
			this.alpha = this.alphaTarget > this.alpha ? Math.min(this.alphaTarget, this.alpha + step) : Math.max(this.alphaTarget, this.alpha - step);
			this.root.alpha = this.alpha;
			this.root.visible = this.alpha > 0;
		}
		const fading = this.alpha !== this.alphaTarget;
		if (!this.shine || !this.strips.length || this.alphaTarget === 0) {
			this.dark();
			this.sweepAt = -1;
			return fading;
		}
		const S = this.timing.shine;
		if (this.sweepAt < 0) this.sweep(now, false);
		const t = now - this.sweepAt;
		let u: number; // the band's way across, 0 .. 1
		let opacity: number;
		if (this.big) {
			if (t >= S.bigMs) {
				// the idle cycle starts again behind the full sweep, as the CSS animation list did
				this.sweep(now, false);
				this.dark();
				return true;
			}
			const v = t / S.bigMs;
			u = 1 - (1 - v) * (1 - v);
			opacity = v < S.bigRampAt ? v / S.bigRampAt : 1 - (v - S.bigRampAt) / (1 - S.bigRampAt);
		} else {
			if (t >= S.idleMs) {
				this.sweep(now, false);
				return true;
			}
			if (t >= S.idleSweepMs + S.idleRampMs) {
				this.dark();
				return true;
			}
			u = Math.min(1, t / S.idleSweepMs);
			opacity = S.idleOpacity * (t < S.idleRampMs ? t / S.idleRampMs : t > S.idleSweepMs ? 1 - (t - S.idleSweepMs) / S.idleRampMs : 1);
		}
		// the band: a triangle `band` art widths wide whose centre runs from `from` to `to` (art widths)
		const centre = S.from + (S.to - S.from) * u;
		const half = S.band / 2;
		const n = this.strips.length;
		for (let i = 0; i < n; i += 1) {
			const d = Math.abs((i + 0.5) / n - centre);
			const a = d >= half ? 0 : opacity * S.peak * (1 - d / half);
			const s = this.strips[i];
			s.alpha = a;
			s.visible = a > 0;
		}
		this.lit = true;
		return true;
	}

	state() {
		return { ready: this.ready, shine: this.shine, shown: this.shown, alpha: this.alpha, visible: this.root.visible, box: { ...this.box }, strips: this.strips.length, lit: this.strips.filter((s) => s.visible).length, bakes: this.bakes, sweeps: this.sweeps, idleMs: this.timing.shine.idleMs, idleOpacity: this.timing.shine.idleOpacity, peakAlpha: Math.max(0, ...this.strips.map((x) => x.alpha)), shadow: { x: this.shadow.x, y: this.shadow.y, scale: this.shadow.scale.x, alpha: this.shadow.alpha, w: this.shadow.texture.width, h: this.shadow.texture.height }, big: this.big };
	}
}
