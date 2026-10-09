// THE PLAQUE'S SCENE: every Pixi object of the animated win plaque in ONE container this class owns (the
// ArtAmount pattern: raw objects, no pixi-svelte component per sprite), driven by one tick. House rules: no
// filters, no masks, no texture created or uploaded per frame, nothing allocated per frame (typed arrays and
// pooled sprites sized for the Max tier), always mounted (components/StingerPlaque.svelte), hidden by default
// and NOT ticking while hidden.
//
// Draw order, back to front (the recipes' own, model/stinger_*_fx.json draw_order):
//   scene dim (a black sprite over the whole canvas, layout.scene_dim)
//   the 15 layered cut-outs in their json order: six deforming meshes (two of them twice, as the centre
//     wings' back sheets under the body) and the static body and front pieces
//   slab_dark (normal blend, 0.35): the marble 35 % darker, under everything additive
//   vein wash, veins a b c            additive
//   panel embers                      additive
//   barb halos, barb highlights       additive
//   front embers                      additive
//   glint slices, stars               additive
//   eye lids (normal), eye glows, eye blooms, eye streaks (additive)
//   text: title halo (additive), title, amount, rows
//
// THE TEXT'S CHOREOGRAPHY (stage 2, the approved timing mocks: model/scripts/a1_timing.py draw_text) runs on
// the same clock, every number from STINGER_PLAQUE:
//   T0 = the impact. The title punches in at T0 + titleDelayMs, the amount appears at T0 + amountDelayMs,
//   the intro's rows rise in from T0 + rowsDelayMs. A tier up swaps the title (old one out, new one punched in),
//   pulses the amount and fires the plaque's own beat; the count's end pulses and brightens the amount and
//   sweeps the glint once; the exit fades the text faster than the plaque lifts.
// The COUNT itself (which amount, which tier, when) is the caller's: components/StingerPlaque.svelte feeds
// setAmountText / tierUp / countEnd between advance() and render().
import * as PIXI from 'pixi.js';

import { EmberFx } from './embers';
import { FLARE_LAND, FLARE_TIER, StingerMotion } from './motion';
import { BarbFx, EyeFx, GlintFx, LID_CLOSED, LID_OPEN, VeinFx, rgbInt } from './overlays';
import { PlaqueText, PlaqueTitle } from './plaqueText';
import { PlaqueFont } from './text';
import { STINGER_TIERS, type StingerData, type StingerJson, type StingerMode, type StingerScreen, type StingerTier } from './types';

type Textures = Record<string, PIXI.Texture>;

/** the choreography around the data (game/constants.ts STINGER_PLAQUE) */
export type StingerTiming = {
	enterMs: number;
	enterDropPx: number;
	titleDelayMs: number;
	titlePunchMs: number;
	titlePunchFrom: number;
	titleFadeMs: number;
	titleGlowMs: number;
	amountDelayMs: number;
	amountFadeMs: number;
	tierTitleDelayMs: number;
	tierTitleFrom: number;
	tierTitleFadeMs: number;
	tierOldOutMs: number;
	tierOldScale: number;
	tierPulseMs: number;
	tierPulseUpMs: number;
	tierPulse: number;
	endPulseMs: number;
	endPulse: number;
	endBrighten: number;
	endBrightenMs: number;
	glintEndDelayMs: number;
	amountSlideMs: number;
	rowsDelayMs: number;
	rowStaggerMs: number;
	rowFadeMs: number;
	rowRisePx: number;
	lineFadeMs: number;
	textExitMs: number;
	enterScale: number;
	enterFadeShare: number;
	squashMs: number;
	squash: number;
	exitMs: number;
	exitLiftPx: number;
	landFlareLeadFrames: number;
	flareBlendMs: number;
	eyeFlareDelayMs: number;
	glintLandDelayMs: number;
	glintTierHoldMs: number;
	veinStepMs: number;
	chargeMs: number;
	chargeLift: number;
	eyePulse: { low: number; high: number; periodMs: number };
	blink: { gapMinMs: number; gapMaxMs: number; doubleChance: number; doubleGapMs: number; afterFlareMs: number };
};

export type StingerShow = {
	screen: StingerScreen;
	tier: StingerTier;
	/** the feature, for the intro's title and rows and the wrap up's line */
	mode?: StingerMode;
	/** the wrap up's line, already worded (default: "in <the mode's free spins>") */
	line?: string;
};

const LIDS = ['quarter', 'half', 'three_quarter', 'closed'] as const;
const GLOWS = ['open', 'quarter', 'half', 'three_quarter'] as const;
const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** smoothstep and back out, exactly the mocks' (a1_timing.py sm / backout) */
const sm = (x: number) => {
	const u = clamp01(x);
	return u * u * (3 - 2 * u);
};
const backOut = (x: number) => {
	const u = clamp01(x) - 1;
	return 1 + 2.70158 * u * u * u + 1.70158 * u * u;
};
const cubicOut = (x: number) => {
	const u = 1 - clamp01(x);
	return 1 - u * u * u;
};

export class StingerView {
	/** canvas px; holds the dim and the placed plaque */
	readonly root = new PIXI.Container();
	ready = false;
	phase: 'hidden' | 'enter' | 'up' | 'exit' = 'hidden';
	screen: StingerScreen = 'win';
	tier = 0;
	mode: StingerMode = 'bonus';
	/** the cost of the last tick, ms (DEV state) */
	tickMs = 0;

	private timing: StingerTiming;
	private json!: StingerJson;
	private dim = new PIXI.Sprite(PIXI.Texture.WHITE);
	private placed = new PIXI.Container();
	private body = new PIXI.Container();
	private textLayer = new PIXI.Container();

	private motion!: StingerMotion;
	private vein!: VeinFx;
	private glint!: GlintFx;
	private barb!: BarbFx;
	private eye!: EyeFx;
	private embers!: EmberFx;

	/** per mover: the vertex array its mesh draws from, and the mesh's position buffer */
	private verts: Float32Array[] = [];
	private buffers: PIXI.Buffer[] = [];
	private veinSprites: PIXI.Sprite[] = [];
	private glowSprite!: PIXI.Sprite;
	private slices: PIXI.Sprite[] = [];
	private stars: PIXI.Sprite[] = [];
	private starBase = 1;
	private barbSprites: { halo: PIXI.Sprite; highlight: PIXI.Sprite; base: number }[] = [];
	private lids: PIXI.Sprite[] = [];
	private glows: PIXI.Sprite[] = [];
	private blooms: PIXI.Sprite[] = [];
	private streaks: PIXI.Sprite[] = [];
	private lidTex: PIXI.Texture[][] = [];
	private glowTex: PIXI.Texture[][] = [];
	private lidShown!: Uint8Array;
	private bloomBase = 1;
	private streakBase = 1;
	private emberSprites: PIXI.Sprite[] = [];
	private emberTex: PIXI.Texture[] = [];
	private emberBase: number[] = [];
	private emberShown!: Uint8Array;

	/** the title on show and the one a tier up is sending out: the two swap roles at every tier up */
	private title!: PlaqueTitle;
	private titleOld!: PlaqueTitle;
	private amount!: PlaqueText;
	/** the amount again, additive: the count end's brighten (set once, at the end) */
	private amountGlow!: PlaqueText;
	/** carries the amount's pulse (a scale about the row's centre) */
	private amountBox = new PIXI.Container();
	private rows: PlaqueText[] = [];
	private rowY = [0, 0, 0];
	private amountPx = 64;
	private amountMax = 0;
	private amountOpts: { maxWidth: number; tabular: boolean; reserve: string | undefined; fit: string | undefined } = { maxWidth: 0, tabular: true, reserve: undefined, fit: undefined };
	private missingWarned = '';

	// the text's beats (seconds on the plaque clock; Infinity = not scheduled)
	private titleT0 = 0;
	private titleFrom = 1.35;
	private titleFadeS = 0.1;
	private oldT0 = Infinity;
	private oldScale0 = 1;
	private oldAlpha0 = 1;
	/** when the amount appears: the caller's count starts here (public: the count's zero) */
	amountT0 = 0;
	private pulseT0 = Infinity;
	private pulseS = 0.25;
	private pulseUpS = 0.12;
	private pulseTo = 1.12;
	private endT0 = Infinity;
	private slideT0 = -Infinity;
	private slideFrom = 0;
	private rowsT0 = 0;
	private lineT0 = Infinity;
	/** what the text was last drawn at (DEV state) */
	private drawn = { titleScale: 1, titleAlpha: 0, oldAlpha: 0, amountScale: 1, amountAlpha: 0, amountX: 0, glow: 0, rowAlpha: [0, 0, 0], text: 1 };
	/** true for the one advance() in which the plaque touched down */
	landed = false;

	// the clock (seconds since show) and the beats on it
	private t = 0;
	private dt = 0;
	private enterS = 0.25;
	private exitS = 0.2;
	private impactT = 0.25;
	private exitT0 = 0;
	private sceneDim = 0.28;
	private panelX = 0;
	private panelY = 0;

	constructor(timing: StingerTiming) {
		this.timing = timing;
		this.root.visible = false;
		this.dim.tint = 0x000000;
		this.dim.alpha = 0;
		this.placed.addChild(this.body);
		this.root.addChild(this.dim, this.placed);
	}

	/** build the scene once the data and the atlases are in (called once) */
	build(data: StingerData, atlas: Textures, random: () => number = Math.random): void {
		if (this.ready) return;
		const json = (this.json = data.json);
		const T = this.timing;
		const R = json.sprites;
		const tex = (name: string) => atlas[`stg_${name}`] ?? PIXI.Texture.EMPTY;
		/** a sprite of the named frame at its ship size; `anchored` = its rect is relative to its anchor */
		const sprite = (name: string, opts: { add?: boolean; anchored?: boolean; centre?: boolean } = {}) => {
			const s = new PIXI.Sprite(tex(name));
			const r = R[name];
			const k = r[2] / Math.max(s.texture.width, 1);
			s.scale.set(k);
			if (opts.centre) s.anchor.set(0.5);
			else if (opts.anchored) s.pivot.set(-r[0] / k, -r[1] / k);
			else s.position.set(r[0], r[1]);
			if (opts.add) s.blendMode = 'add';
			return s;
		};
		const scaleOf = (name: string) => R[name][2] / Math.max(tex(name).width, 1);

		this.motion = new StingerMotion(data);
		this.motion.blendS = T.flareBlendMs / 1000;
		this.vein = new VeinFx(json);
		this.vein.stepS = T.veinStepMs / 1000;
		this.glint = new GlintFx(json);
		this.barb = new BarbFx(json);
		this.barb.blendS = T.flareBlendMs / 1000;
		this.barb.chargeS = T.chargeMs / 1000;
		this.barb.chargeLift = T.chargeLift;
		this.eye = new EyeFx(json, random);
		this.eye.pulse = { low: T.eyePulse.low, high: T.eyePulse.high, periodS: T.eyePulse.periodMs / 1000 };
		this.eye.blink = { gapMinS: T.blink.gapMinMs / 1000, gapMaxS: T.blink.gapMaxMs / 1000, doubleChance: T.blink.doubleChance, doubleGapS: T.blink.doubleGapMs / 1000, afterFlareS: T.blink.afterFlareMs / 1000 };
		this.embers = new EmberFx(json);

		// the layered plaque: one mesh per mover first (a back sheet needs its front sheet's geometry), then
		// every layer in the json's order, which is the z order
		const meshOf = new Map<string, PIXI.MeshSimple>();
		data.movers.forEach((M, i) => {
			const mesh = new PIXI.MeshSimple({ texture: tex(M.name), vertices: new Float32Array(M.nv * 2), uvs: M.uvs, indices: M.indices });
			mesh.autoUpdate = false; // the tick rewrites the vertices and flags the buffer itself
			this.verts[i] = mesh.vertices as Float32Array;
			this.buffers[i] = mesh.geometry.getBuffer('aPosition');
			meshOf.set(M.name, mesh);
		});
		for (const L of json.motion.layers) {
			if (L.type === 'static') this.body.addChild(sprite(L.name));
			// a back sheet draws its front sheet's geometry (one vertex buffer, two textures)
			else if (L.share) this.body.addChild(new PIXI.Mesh({ geometry: meshOf.get(L.share)!.geometry, texture: tex(L.name) }));
			else this.body.addChild(meshOf.get(L.name)!);
		}

		// slab + veins
		const slab = sprite(json.vein.slab);
		slab.alpha = json.text.layout.slab_dark;
		this.glowSprite = sprite(json.vein.glow, { add: true });
		this.veinSprites = json.vein.sprites.map((n) => sprite(n, { add: true }));
		this.body.addChild(slab, this.glowSprite, ...this.veinSprites);

		// embers: one pooled sprite per table row, in the layer its region belongs to
		const panelEmbers = new PIXI.Container();
		const frontEmbers = new PIXI.Container();
		this.emberTex = json.embers.sprites.map(tex);
		this.emberBase = json.embers.sprites.map(scaleOf);
		this.emberShown = new Uint8Array(this.embers.capacity).fill(255);
		for (let p = 0; p < this.embers.capacity; p += 1) {
			const s = new PIXI.Sprite(PIXI.Texture.EMPTY);
			s.anchor.set(0.5);
			s.blendMode = 'add';
			s.visible = false;
			this.emberSprites.push(s);
			(this.embers.panel[p] ? panelEmbers : frontEmbers).addChild(s);
		}

		// barbs: halos under highlights
		const halos: PIXI.Sprite[] = [];
		const highlights: PIXI.Sprite[] = [];
		for (const side of ['L', 'R'] as const) {
			const S = json.barb.sides[side];
			const halo = sprite(S.halo, { add: true, anchored: true });
			const highlight = sprite(S.highlight, { add: true, anchored: true });
			// both of a barb's sprites are cut at the same scale
			this.barbSprites.push({ halo, highlight, base: scaleOf(S.highlight) });
			halos.push(halo);
			highlights.push(highlight);
		}
		this.body.addChild(panelEmbers, ...halos, ...highlights, frontEmbers);

		// glint
		const gt = json.glint.tint;
		for (const sl of json.glint.slices) {
			const s = sprite(sl.sprite, { add: true });
			s.tint = rgbInt(gt[0], gt[1], gt[2]);
			s.visible = false;
			this.slices.push(s);
		}
		this.starBase = scaleOf('star');
		for (let j = 0; j < GlintFx.MAX_STARS; j += 1) {
			const s = sprite('star', { add: true, centre: true });
			s.tint = rgbInt(json.glint.starTint[0], json.glint.starTint[1], json.glint.starTint[2]);
			s.visible = false;
			this.stars.push(s);
		}
		this.body.addChild(...this.slices, ...this.stars);

		// eyes: every lid, then every glow, bloom and streak
		const F = json.eyes.flare;
		this.bloomBase = scaleOf(F.bloom);
		this.streakBase = scaleOf(F.streak);
		this.lidShown = new Uint8Array(this.eye.names.length).fill(255);
		for (const name of this.eye.names) {
			const E = json.eyes.eyes[name];
			this.lidTex.push(LIDS.map((k) => tex(E.lids[k])));
			this.glowTex.push(GLOWS.map((k) => tex(E.glows[k])));
			// a head's lid frames share one box, and so do its glow frames
			const lid = sprite(E.lids.closed);
			lid.visible = false;
			const glow = sprite(E.glows.open, { add: true });
			const bloom = sprite(F.bloom, { add: true, centre: true });
			const streak = sprite(F.streak, { add: true, centre: true });
			bloom.position.set(E.centre[0], E.centre[1]);
			streak.position.set(E.centre[0], E.centre[1]);
			streak.rotation = (E.streakRot * Math.PI) / 180;
			bloom.visible = streak.visible = false;
			this.lids.push(lid);
			this.glows.push(glow);
			this.blooms.push(bloom);
			this.streaks.push(streak);
		}
		this.body.addChild(...this.lids, ...this.glows, ...this.blooms, ...this.streaks);

		// text, on the panel
		const font = new PlaqueFont(json);
		const [px, py, pw, ph] = json.text.layout.panel;
		this.panelX = px + pw / 2;
		this.panelY = py + ph / 2;
		this.sceneDim = json.text.layout.scene_dim;
		this.title = new PlaqueTitle(json.text.titles, atlas);
		this.titleOld = new PlaqueTitle(json.text.titles, atlas);
		this.titleOld.view.visible = false;
		this.amount = new PlaqueText(font, atlas);
		this.amountGlow = new PlaqueText(font, atlas);
		this.amountGlow.view.blendMode = 'add'; // the glyph sprites inherit it
		this.amountGlow.view.visible = false;
		this.amountBox.addChild(this.amount.view, this.amountGlow.view);
		this.rows = [0, 1, 2].map(() => new PlaqueText(font, atlas));
		this.textLayer.position.set(this.panelX, py);
		this.textLayer.addChild(this.titleOld.view, this.title.view, this.amountBox, ...this.rows.map((r) => r.view));
		this.body.addChild(this.textLayer);
		// the entrance moves and scales the plaque about the panel centre
		this.body.pivot.set(this.panelX, this.panelY);
		this.ready = true;
	}

	/** the five texture sources, for mip chains and the pre-upload */
	sources(atlas: Textures): { plaque?: PIXI.TextureSource; fx?: PIXI.TextureSource; glint?: PIXI.TextureSource; titles?: PIXI.TextureSource; glyphs?: PIXI.TextureSource } {
		return { plaque: atlas.stg_body?.source, fx: atlas.stg_veins_a?.source, glint: atlas.stg_glint_00?.source, titles: atlas.stg_title_total_win?.source, glyphs: atlas.stg_g_0030?.source };
	}

	/** where the panel centre is on the canvas, the canvas px per ship px, and the canvas size (for the dim) */
	place(x: number, y: number, scale: number, canvasWidth: number, canvasHeight: number): void {
		this.placed.position.set(x, y);
		this.placed.scale.set(scale);
		this.dim.setSize(canvasWidth, canvasHeight);
	}

	// ---- the three screens (stage 1: the text simply appears) ---------------------------------------
	private setScreen(o: StingerShow): void {
		const L = this.json.text.layout;
		const C = this.json.text.copy;
		const ph = L.panel[3];
		this.screen = o.screen;
		this.mode = o.mode ?? 'bonus';
		const rowsOff = () => this.rows.forEach((r) => (r.view.visible = false));
		if (o.screen === 'win') {
			this.title.view.y = ph * L.win.title_cy;
			this.setWinTitle();
			this.amountPx = L.win.amount_px;
			this.amountMax = L.win.max_width;
			this.amountBox.y = ph * L.win.amount_cy;
			this.amountBox.visible = true;
			rowsOff();
		} else if (o.screen === 'intro') {
			this.title.set(`intro_${this.mode}`, L.intro.title_cap, L.intro.max_width);
			this.title.view.y = ph * L.intro.title_cy;
			this.amountBox.visible = false;
			const copy = C.intro[this.mode] ?? [];
			this.rows.forEach((r, i) => {
				r.view.visible = i < copy.length;
				if (i >= copy.length) return;
				r.set(copy[i], L.intro.text_px, { maxWidth: L.intro.max_width });
				this.rowY[i] = ph * L.intro.rows_cy[i];
				this.report(r);
			});
		} else {
			this.title.set(C.wrap.title, L.wrap.title_cap, L.wrap.max_width);
			this.title.view.y = ph * L.wrap.title_cy;
			this.amountPx = L.wrap.amount_px;
			this.amountMax = L.wrap.max_width;
			this.amountBox.y = ph * L.wrap.amount_cy;
			this.amountBox.visible = true;
			rowsOff();
			// "in {spins} {mode}": the feature's own title names both ("10 SUPER FREE SPINS")
			const line = o.line ?? C.wrap.line.replace('{spins} {mode}', titleCase(this.json.text.titles[`intro_${this.mode}`]?.text ?? ''));
			this.rows[0].set(line, L.wrap.line_px, { maxWidth: L.wrap.max_width });
			this.rowY[0] = ph * L.wrap.line_cy;
			this.rows[0].view.visible = true;
			this.report(this.rows[0]);
		}
	}

	private setWinTitle(): void {
		const L = this.json.text.layout.win;
		this.title.set(`win_${STINGER_TIERS[this.tier]}`, L.title_cap, L.max_width);
	}

	/** a character the forged atlas lacks is never dropped silently: say which (once per set) */
	private report(row: PlaqueText): void {
		if (!row.missing || row.missing === this.missingWarned) return;
		this.missingWarned = row.missing;
		console.warn(`[manticore] plaque glyph atlas lacks ${JSON.stringify(row.missing)} (in ${JSON.stringify(row.text)})`);
	}

	/**
	 * The amount as a formatted string (the component formats it with the game's currency helper). Cheap enough
	 * for every frame of a count: an unchanged string is a no-op, a changed one moves pooled sprites.
	 *   fit      the count's FINAL string: the glyph size is fitted to it once, so it never changes mid count
	 *   reserve  (stage 1, the DEV hook) the box is fixed to this string and the digits right align in it
	 * THE ROW STAYS CENTRED AND SLIDES (house rule "Counting amounts", rule 3): when the row's width changes it
	 * starts offset so its right edge, and with it every digit already there, stays where it was, and that
	 * offset eases to zero over amountSlideMs. The digits keep ticking while it slides.
	 */
	setAmountText(text: string, fit?: string, reserve?: string): void {
		if (!this.ready) return;
		const o = this.amountOpts; // one options object, reused: a count calls this every frame
		o.maxWidth = this.amountMax;
		o.reserve = reserve;
		o.fit = fit;
		const had = this.amount.text !== '';
		const w0 = this.amount.width;
		this.amount.set(text, this.amountPx, o);
		const w1 = this.amount.width;
		if (had && w1 !== w0 && reserve === undefined && this.phase !== 'hidden') {
			this.slideFrom = this.slideNow(this.t) - (w1 - w0) / 2;
			this.slideT0 = this.t;
		}
		this.report(this.amount);
	}

	/** the amount row's x offset from the panel centre right now (ship px) */
	private slideNow(t: number): number {
		const u = (t - this.slideT0) / (this.timing.amountSlideMs / 1000);
		return u >= 1 ? 0 : this.slideFrom * (1 - cubicOut(u));
	}

	// ---- show / tier up / hide ------------------------------------------------------------------------
	/**
	 * The entrance, the text beats and the exit run in REAL time at every turbo level, the way Angry Mantis's
	 * stinger does (its STINGER_MOTION is never scaled): turbo shortens the COUNT, which is the caller's.
	 */
	show(o: StingerShow): void {
		if (!this.ready) return;
		const T = this.timing;
		const fps = this.motion.fps;
		this.tier = Math.max(0, STINGER_TIERS.indexOf(o.tier));
		this.t = 0;
		this.enterS = T.enterMs / 1000;
		this.impactT = this.enterS;
		this.landed = false;
		this.titleT0 = this.impactT + T.titleDelayMs / 1000;
		this.titleFrom = T.titlePunchFrom;
		this.titleFadeS = T.titleFadeMs / 1000;
		this.oldT0 = Infinity;
		this.titleOld.view.visible = false;
		this.amountT0 = this.impactT + T.amountDelayMs / 1000;
		this.pulseT0 = Infinity;
		this.endT0 = Infinity;
		this.slideT0 = -Infinity;
		this.slideFrom = 0;
		this.rowsT0 = this.impactT + T.rowsDelayMs / 1000;
		// the wrap up's line waits for the count's end (countEnd); shown at once if nothing ever counts (DEV hook)
		this.lineT0 = -Infinity;
		this.amountGlow.view.visible = false;
		// land_flare frame `lead` is the impact, and it runs over the idle from frame 75
		const landT0 = Math.max(0, this.impactT - T.landFlareLeadFrames / fps);
		this.motion.reset(this.motion.landIdleStart, landT0);
		this.motion.startFlare(FLARE_LAND, landT0);
		this.vein.reset(this.tier);
		this.glint.reset(this.tier);
		this.glint.land(this.impactT + T.glintLandDelayMs / 1000);
		this.barb.reset(this.tier);
		this.barb.charge(this.impactT);
		this.eye.reset(this.tier, 0);
		this.eye.flare(this.impactT + T.eyeFlareDelayMs / 1000);
		this.embers.reset();
		this.embers.start(this.tier, this.impactT);
		this.amount.set('', this.amountPx);
		this.setScreen(o);
		this.phase = 'enter';
		this.root.visible = true;
		this.tick(0);
	}

	/** an amount is about to count on this screen: no idle glint sweep until countEnd, and the wrap up's line waits for it */
	countBegins(): void {
		if (!this.ready) return;
		this.glint.holdIdle();
		this.lineT0 = Infinity;
	}

	/**
	 * The count has landed on its final amount: the end pulse with its brighten, one glint sweep, and the wrap
	 * up's line. `withTierUp`: the last tier landed on this same frame (tierUp(tier, false) was just called), so
	 * the sweep waits out the tier beat's hold.
	 */
	countEnd(withTierUp = false): void {
		if (!this.ready || this.phase === 'hidden' || this.phase === 'exit') return;
		const T = this.timing;
		const t = this.t;
		this.pulseT0 = t;
		this.pulseS = T.endPulseMs / 1000;
		this.pulseUpS = this.pulseS / 2;
		this.pulseTo = T.endPulse;
		this.endT0 = t;
		// the brighten: the same row once more, additive (one layout, here, not per frame)
		const o = this.amountOpts;
		this.amountGlow.set(this.amount.text, this.amountPx, o);
		this.glint.sweepAt(t + (withTierUp ? T.glintTierHoldMs : T.glintEndDelayMs) / 1000);
		this.lineT0 = t + this.pulseS;
	}

	/** the seconds the wrap up's line needs after countEnd to be fully in */
	get lineInS(): number {
		return (this.timing.endPulseMs + this.timing.lineFadeMs) / 1000;
	}

	/** the seconds after show() at which the intro's last row is fully in */
	get rowsInS(): number {
		return this.rowsT0 + (2 * this.timing.rowStaggerMs + this.timing.rowFadeMs) / 1000;
	}

	/** the plaque clock, seconds since show() */
	get clock(): number {
		return this.t;
	}

	/**
	 * The tier up beat, at any moment: additive tier_flare, vein step, barb charge, eye flare, ember burst, glint
	 * held off; on the win screen the title swaps (old one out, new one punched in) and the amount pulses.
	 * `pulse` false = the count ends on this same frame and countEnd's own pulse plays instead.
	 */
	tierUp(tier: StingerTier, pulse = true): void {
		if (!this.ready || this.phase === 'hidden' || this.phase === 'exit') return;
		const T = this.timing;
		const t = this.t;
		this.tier = Math.max(0, STINGER_TIERS.indexOf(tier));
		this.barb.flareStarting(t);
		this.motion.startFlare(FLARE_TIER, t);
		this.vein.setTier(this.tier, t);
		this.barb.setTier(this.tier);
		this.barb.charge(t);
		this.eye.setTier(this.tier);
		this.eye.flare(t + T.eyeFlareDelayMs / 1000);
		this.embers.setTier(this.tier, t);
		this.glint.tierUp(this.tier, t, T.glintTierHoldMs / 1000);
		if (this.screen !== 'win') return;
		// the title swap: the title on screen becomes the outgoing one from wherever its own punch has got to,
		// and the other title object comes in as the new tier's
		const d = this.drawn;
		const out = this.title;
		this.title = this.titleOld;
		this.titleOld = out;
		this.oldT0 = t;
		this.oldScale0 = d.titleScale;
		this.oldAlpha0 = t >= this.titleT0 ? d.titleAlpha : 0;
		this.title.view.y = out.view.y;
		this.title.view.visible = false;
		this.setWinTitle();
		this.titleT0 = t + T.tierTitleDelayMs / 1000;
		this.titleFrom = T.tierTitleFrom;
		this.titleFadeS = T.tierTitleFadeMs / 1000;
		if (pulse) {
			this.pulseT0 = t;
			this.pulseS = T.tierPulseMs / 1000;
			this.pulseUpS = T.tierPulseUpMs / 1000;
			this.pulseTo = T.tierPulse;
		}
	}

	hide(): void {
		if (this.phase === 'hidden' || this.phase === 'exit') return;
		this.exitS = this.timing.exitMs / 1000;
		this.exitT0 = this.t;
		this.phase = 'exit';
	}

	/** advance by dtMs and write every transform. Returns false once the plaque is hidden (stop ticking). */
	tick(dtMs: number): boolean {
		this.advance(dtMs);
		return this.render();
	}

	/** move the clock on. The caller may then feed this frame's amount / tier up / count end before render(). */
	advance(dtMs: number): void {
		this.landed = false;
		if (this.phase === 'hidden' || !this.ready) return;
		this.dt = Math.min(dtMs, 100) / 1000;
		this.t += this.dt;
		if (this.phase === 'enter' && this.t >= this.impactT) {
			this.phase = 'up';
			this.landed = true;
		}
	}

	/** write every transform for the clock's time. Returns false once the plaque is hidden (stop ticking). */
	render(): boolean {
		if (this.phase === 'hidden' || !this.ready) return false;
		const started = performance.now();
		const T = this.timing;
		const dt = this.dt;
		const t = this.t;

		// the entrance, the touch down, the exit: one transform on the body, one alpha on the plaque and the dim
		let y = 0;
		let sx = 1;
		let sy = 1;
		let alpha = 1;
		let dim = this.sceneDim;
		if (this.phase === 'enter') {
			const u = t / this.enterS;
			y = -T.enterDropPx * (1 - u * u); // falls in accelerating, like the tiles
			sx = sy = T.enterScale + (1 - T.enterScale) * u * u;
			alpha = Math.min(1, u / T.enterFadeShare);
			dim *= u;
		} else if (this.phase === 'exit') {
			const e = (t - this.exitT0) / this.exitS;
			if (e >= 1) {
				this.phase = 'hidden';
				this.root.visible = false;
				this.tickMs = performance.now() - started;
				return false;
			}
			y = -T.exitLiftPx * e * e;
			alpha = 1 - e;
			dim *= 1 - e;
		} else {
			const v = (t - this.impactT) / (T.squashMs / 1000);
			if (v < 1) {
				const s = Math.sin(Math.PI * v) * T.squash;
				sy = 1 - s;
				sx = 1 + s / 2;
			}
		}
		this.body.position.y = y;
		this.body.scale.set(sx, sy);
		this.placed.alpha = alpha;
		this.dim.alpha = dim;
		this.writeText(t);

		// the movers
		const motion = this.motion;
		for (let i = 0; i < this.verts.length; i += 1) {
			motion.evaluate(i, t, this.verts[i]);
			this.buffers[i].update();
		}

		// veins
		const vein = this.vein;
		vein.update(t, dt);
		for (let k = 0; k < this.veinSprites.length; k += 1) {
			this.veinSprites[k].alpha = vein.alpha[k];
			this.veinSprites[k].tint = vein.tint;
		}
		this.glowSprite.alpha = vein.glowAlpha;
		this.glowSprite.tint = vein.tint;

		// glint
		const glint = this.glint;
		glint.update(t);
		for (let i = 0; i < this.slices.length; i += 1) {
			const a = glint.sliceAlpha[i];
			this.slices[i].visible = a > 0;
			this.slices[i].alpha = a;
		}
		const sites = this.json.glint.sites;
		for (let j = 0; j < this.stars.length; j += 1) {
			const s = this.stars[j];
			const site = glint.starSite[j];
			const a = glint.starAlpha[j];
			s.visible = site >= 0 && a > 0;
			if (!s.visible) continue;
			s.position.set(sites[site].x, sites[site].y);
			s.alpha = a;
			s.scale.set(this.starBase * glint.starScale[j]);
			s.rotation = glint.starRot[j];
		}

		// barbs
		const barb = this.barb;
		barb.update(t, dt, motion.idleFrame(t), motion.flareKind, motion.flareFrame(t));
		for (let s = 0; s < 2; s += 1) {
			const B = this.barbSprites[s];
			const k = B.base * barb.scale[s];
			B.halo.position.set(barb.x[s], barb.y[s]);
			B.halo.rotation = barb.rot[s];
			B.halo.scale.set(k);
			B.halo.alpha = barb.halo[s];
			B.halo.tint = barb.tint;
			B.highlight.position.set(barb.x[s], barb.y[s]);
			B.highlight.rotation = barb.rot[s];
			B.highlight.scale.set(k);
			B.highlight.alpha = barb.highlight[s];
			B.highlight.tint = barb.tint;
		}

		// eyes
		const eye = this.eye;
		eye.update(t);
		for (let i = 0; i < this.lids.length; i += 1) {
			const frame = eye.lid[i];
			if (frame !== this.lidShown[i]) {
				this.lidShown[i] = frame;
				this.lids[i].visible = frame !== LID_OPEN;
				if (frame !== LID_OPEN) this.lids[i].texture = this.lidTex[i][frame - 1];
				this.glows[i].visible = frame !== LID_CLOSED;
				if (frame !== LID_CLOSED) this.glows[i].texture = this.glowTex[i][frame];
			}
			this.glows[i].alpha = Math.min(1, eye.glowAlpha[i]);
			const bloom = this.blooms[i];
			bloom.visible = eye.bloomAlpha[i] > 0;
			if (bloom.visible) {
				bloom.alpha = eye.bloomAlpha[i];
				bloom.scale.set(this.bloomBase * eye.bloomScale[i]);
				bloom.tint = eye.flareTint[i];
			}
			const streak = this.streaks[i];
			streak.visible = eye.streakAlpha[i] > 0;
			if (streak.visible) {
				streak.alpha = eye.streakAlpha[i];
				streak.scale.set(this.streakBase * eye.streakScaleX[i], this.streakBase * eye.streakScaleY[i]);
				streak.tint = eye.flareTint[i];
			}
		}

		// embers
		const em = this.embers;
		em.update(t);
		for (let p = 0; p < this.emberSprites.length; p += 1) {
			const s = this.emberSprites[p];
			const a = em.alpha[p];
			s.visible = a > 0;
			if (a <= 0) continue;
			const kind = em.sprite[p];
			if (kind !== this.emberShown[p]) {
				this.emberShown[p] = kind;
				s.texture = this.emberTex[kind];
			}
			s.position.set(em.x[p], em.y[p]);
			s.scale.set(this.emberBase[kind] * em.scale[p]);
			s.rotation = em.rot[p];
			s.alpha = a;
			s.tint = em.tint[p];
		}
		this.tickMs = performance.now() - started;
		return true;
	}

	/** the text's transforms for time t: a handful of scales, alphas and offsets, nothing laid out */
	private writeText(t: number): void {
		const T = this.timing;
		const d = this.drawn;
		d.text = this.phase === 'exit' ? 1 - sm((t - this.exitT0) / (T.textExitMs / 1000)) : 1;
		this.textLayer.alpha = d.text;

		// the title: punched in (back out overshoot) with a short fade, its halo fading in behind it
		const tin = t - this.titleT0;
		const title = this.title.view;
		title.visible = tin >= 0 && this.title.name !== '';
		if (title.visible) {
			d.titleScale = this.titleFrom + (1 - this.titleFrom) * backOut(tin / (T.titlePunchMs / 1000));
			d.titleAlpha = clamp01(tin / this.titleFadeS);
			title.scale.set(d.titleScale);
			title.alpha = d.titleAlpha;
			this.title.glowGain(sm(tin / (T.titleGlowMs / 1000)));
		} else d.titleAlpha = 0;
		// the outgoing title of a tier up: grows a little and is gone
		const old = this.titleOld.view;
		const x = (t - this.oldT0) / (T.tierOldOutMs / 1000);
		old.visible = x >= 0 && x < 1 && this.oldAlpha0 > 0;
		d.oldAlpha = old.visible ? this.oldAlpha0 * (1 - x) : 0;
		if (old.visible) {
			old.scale.set(this.oldScale0 * (1 + (T.tierOldScale - 1) * x));
			old.alpha = d.oldAlpha;
		}

		// the amount: in with a short fade, pulsing on a tier up and at the end, sliding when a digit is added
		if (this.screen !== 'intro') {
			const ain = t - this.amountT0;
			const box = this.amountBox;
			box.visible = ain >= 0;
			d.amountAlpha = clamp01(ain / (T.amountFadeMs / 1000));
			const p = t - this.pulseT0;
			let k = 0;
			if (p >= 0 && p < this.pulseS) k = p < this.pulseUpS ? sm(p / this.pulseUpS) : 1 - sm((p - this.pulseUpS) / (this.pulseS - this.pulseUpS));
			d.amountScale = 1 + (this.pulseTo - 1) * k;
			d.amountX = this.slideNow(t);
			box.alpha = d.amountAlpha;
			box.scale.set(d.amountScale);
			this.amount.view.x = d.amountX;
			d.glow = T.endBrighten * Math.max(0, 1 - (t - this.endT0) / (T.endBrightenMs / 1000));
			const glow = this.amountGlow.view;
			glow.visible = d.glow > 0 && t >= this.endT0;
			if (glow.visible) {
				glow.alpha = d.glow;
				glow.x = d.amountX;
			} else d.glow = 0;
		}

		// rows: the intro's three rise in one after another; the wrap up's line fades in after the count
		if (this.screen === 'intro') {
			for (let i = 0; i < this.rows.length; i += 1) {
				const r = this.rows[i].view;
				if (!r.visible) continue;
				const u = sm((t - this.rowsT0 - (i * T.rowStaggerMs) / 1000) / (T.rowFadeMs / 1000));
				d.rowAlpha[i] = u;
				r.alpha = u;
				r.y = this.rowY[i] + T.rowRisePx * (1 - u);
			}
		} else if (this.screen === 'wrap') {
			const u = sm((t - this.lineT0) / (T.lineFadeMs / 1000));
			d.rowAlpha[0] = u;
			this.rows[0].view.alpha = u;
			this.rows[0].view.y = this.rowY[0];
		}
	}

	/** DEV: what a probe needs */
	state() {
		const b = this.ready ? this.placed : null;
		const at = (x: number, y: number) => {
			const p = this.placed.toGlobal({ x: x - this.panelX, y: y - this.panelY });
			return [Number(p.x.toFixed(2)), Number(p.y.toFixed(2))];
		};
		return {
			ready: this.ready,
			visible: this.root.visible,
			phase: this.phase,
			screen: this.screen,
			tier: STINGER_TIERS[this.tier],
			mode: this.mode,
			t: this.ready ? Number(this.t.toFixed(3)) : 0,
			idleFrame: this.ready ? Number(this.motion.idleFrame(this.t).toFixed(2)) : 0,
			flareFrame: this.ready ? Number(this.motion.flareFrame(this.t).toFixed(2)) : -1,
			embers: this.ready ? this.embers.alive : 0,
			emberPool: this.emberSprites.length,
			glintSweeps: this.ready ? this.glint.sweeps : 0,
			blinks: this.ready ? this.eye.blinks : 0,
			title: this.ready ? this.title.name : '',
			amount: this.ready ? this.amount.text : '',
			/** the text's live transforms: title scale / alpha, the outgoing title's alpha, the amount's pulse scale, alpha and slide offset (ship px), its width, the end brighten, the rows' alphas, the exit fade */
			text: this.ready ? { ...this.drawn, rowAlpha: [...this.drawn.rowAlpha], amountWidth: Number(this.amount.width.toFixed(2)), impact: this.impactT, amountT0: this.amountT0 } : null,
			/** the rows on screen (the intro's three, the wrap up's line) */
			rows: this.ready ? this.rows.filter((r) => r.view.visible).map((r) => r.text) : [],
			missingGlyphs: this.ready ? [this.amount, ...this.rows].map((r) => r.missing).join('') : '',
			tickMs: Number(this.tickMs.toFixed(3)),
			scale: b ? this.placed.scale.x : 0,
			/** canvas px (resting pose, the entrance transform left out): the panel centre, the frame, the bind art box, the panel */
			panelCentre: b ? at(this.panelX, this.panelY) : null,
			frame: b ? [...at(0, 0), ...at(this.json.frame[0], this.json.frame[1])] : null,
			art: b ? [...at(this.json.art[0], this.json.art[1]), ...at(this.json.art[2], this.json.art[3])] : null,
			panel: b ? [...at(this.json.text.layout.panel[0], this.json.text.layout.panel[1]), ...at(this.json.text.layout.panel[0] + this.json.text.layout.panel[2], this.json.text.layout.panel[1] + this.json.text.layout.panel[3])] : null,
			/** the movers' vertices right now, canvas px box (wing tips and tails leave the frame) */
			movers: b ? this.moverBox() : null,
		};
	}

	private moverBox(): number[] {
		let x0 = Infinity;
		let y0 = Infinity;
		let x1 = -Infinity;
		let y1 = -Infinity;
		for (const v of this.verts) {
			for (let j = 0; j < v.length; j += 2) {
				x0 = Math.min(x0, v[j]);
				x1 = Math.max(x1, v[j]);
				y0 = Math.min(y0, v[j + 1]);
				y1 = Math.max(y1, v[j + 1]);
			}
		}
		const a = this.placed.toGlobal({ x: x0 - this.panelX, y: y0 - this.panelY });
		const c = this.placed.toGlobal({ x: x1 - this.panelX, y: y1 - this.panelY });
		return [a.x, a.y, c.x, c.y].map((n) => Number(n.toFixed(2)));
	}
}
