<script lang="ts" module>
	import type { BonusMode, BonusHost } from '../game/types';

	export type EmitterEventBonusIntro =
		| { type: 'bonusIntroShow'; mode: BonusMode; host: BonusHost; totalFs: number }
		| { type: 'bonusIntroHide' };
</script>

<script lang="ts">
	// The bonus board, stencilled on the CLOSED steel door — a direct transcription of Corey's
	// concept render. Everything is art or atlas glyphs, never a PIXI.Text, so the screen costs a
	// few hundred batched sprites off resident pages and rasterizes nothing (house rule 1).
	//
	// LAYOUT IS A PLAIN BOX TABLE (game/layoutSpec BONUS_INTRO): each element has a box in
	// FRACTIONS OF THE DOOR WINDOW and its art is fit inside that box (contain, centred). There
	// are no derived bands, gap allowances or overhang reservations — those silently consumed ~10%
	// of the door and shrank the artwork. One table serves all three LayoutKinds because the
	// window aspect is the same everywhere; only portrait stacks the rules into rows.
	//
	// The boxes sum to 99% of the window height with no dead space, so containment is structural:
	// `fit` maps the design box onto the window, and a final measured `k` is a backstop that should
	// never engage. The plaque and PRESS ANYWHERE prompt live outside the door in their HUD slots.
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { Sprite, Container, Graphics } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import {
		BONUS_INTRO_HEADER,
		BONUS_INTRO_HEADER_ASPECT,
		FREE_SPINS_ART,
		INMATE_PLATE,
		STRIKE_GREEN,
		SYMBOL_INFO_MAP,
		rulesFor,
		type RuleCopy,
	} from '../game/constants';
	import { BONUS_INTRO, INTRO_DESIGN, RULES_LAYOUT, frameFor, layoutKind } from '../game/layoutSpec';
	import {
		goldBadgeAspect,
		goldBadgeFrame,
		layoutStencil,
		type StencilBlock,
		type StencilPart,
	} from '../game/stencilLayout';
	import PressToContinue from './PressToContinue.svelte';
	import StencilText from './StencilText.svelte';

	const context = getContext();

	let show = $state(false);
	let mode = $state<BonusMode>('free');
	let host = $state<BonusHost>('marty');
	let totalFs = $state(0);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		bonusIntroShow: async (emitterEvent) => {
			mode = emitterEvent.mode;
			host = emitterEvent.host;
			totalFs = emitterEvent.totalFs;
			show = true;
			// gated on player input (Corey 2026-08-30) — the door holds until they press. A running
			// autoplay with AUTOPLAY BONUSES on presses for them ~1s after the door is ready — but
			// re-checked at FIRE time: stopping autoplay during the window (autoSpinsCounter -> 0)
			// must restore the hard press-gate, not press through it. autoPress pins THIS door's
			// resolver, so a late timer can never press a future door (resolving twice is a no-op).
			const pressed = waitForResolve((resolve) => (oncomplete = resolve));
			if (autoBonusesRunning()) {
				const autoPress = oncomplete;
				void waitForTimeout(1000).then(() => {
					if (autoBonusesRunning()) autoPress();
				});
			}
			await pressed;
		},
		bonusIntroHide: () => (show = false),
	});

	const hosts = $derived(host === 'both' ? ['marky', 'marty'] : [host]); // Marky always left, Marty right

	// ---- door window: the rect every box is a fraction of ----
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const vw = $derived(
		context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale,
	);
	const f = $derived(frameFor(kind, vw));
	const win = $derived({
		x: f.x + f.inset,
		y: f.y + f.inset,
		w: f.width - f.inset * 2,
		h: f.height - f.inset * 2,
	});
	const D = INTRO_DESIGN;
	// no reserved prompt band on any layout — the whole window is the canvas for the boxes
	const fit = $derived(Math.min(win.w / D.w, win.h / D.h));

	// ---- boxes -> design units (origin at the design centre) ----
	type Rect = { x: number; y: number; w: number; h: number };
	const GL_KEY = SYMBOL_INFO_MAP.GL.static.assetKey;
	const box = (fx: number, fy: number, fw: number, fh: number): Rect => ({
		x: (fx - 0.5) * D.w,
		y: (fy - 0.5) * D.h,
		w: fw * D.w,
		h: fh * D.h,
	});
	/** fit an aspect INSIDE a box, centred (the render's treatment for every piece of art) */
	const contain = (b: Rect, aspect: number): Rect => {
		const w = Math.min(b.w, b.h * aspect);
		const h = w / aspect;
		return { x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h };
	};

	/** Body copy as tinted runs. In columns the leaf is a separate tile at the column's left edge;
	 *  in portrait's rows it rides inline in the glyph flow. */
	const bodyParts = (rule: RuleCopy, inlineLeaf: boolean): StencilPart[] => {
		const MARK = 'GREEN STRIKE';
		const at = rule.body.indexOf(MARK);
		const parts: StencilPart[] = [];
		if (at < 0) {
			if (rule.leafIcon && inlineLeaf) parts.push({ icon: GL_KEY, scale: 1.9 });
			parts.push({ text: rule.body });
			return parts;
		}
		if (at > 0) parts.push({ text: rule.body.slice(0, at) });
		if (rule.leafIcon && inlineLeaf) parts.push({ icon: GL_KEY, scale: 1.9 });
		parts.push({ text: MARK, tint: STRIKE_GREEN });
		parts.push({ text: rule.body.slice(at + MARK.length) });
		return parts;
	};

	type RuleItem = {
		head?: { block: StencilBlock; cx: number; top: number };
		body: { block: StencilBlock; cx: number; top: number };
		leaf?: Rect;
	};

	const composition = $derived.by(() => {
		const B = BONUS_INTRO;
		const rects: Rect[] = [];
		const add = (r: Rect): Rect => {
			rects.push(r);
			return r;
		};

		// 1. mode header art — contains into a full-width box at 1%..25% of H
		const header = {
			key: BONUS_INTRO_HEADER[mode],
			rect: add(contain(box(B.header.x, B.header.y, B.header.w, B.header.h), BONUS_INTRO_HEADER_ASPECT)),
		};

		// 2. INMATE plates — IDENTICAL boxes, each plate contained + centred inside its own (the two
		// exports share an aspect now, so they also draw the same size).
		const xs = hosts.length === 1 ? [B.plates.soloX] : (B.plates.x as readonly number[]);
		const mugs = hosts.map((name, i) => {
			const slot = box(xs[i], B.plates.y, B.plates.w, B.plates.h);
			const plate = contain(slot, INMATE_PLATE[name as 'marky' | 'marty'].aspect);
			// head: 1.05x the SLOT height, centred on the slot, vertical centre 55% down it
			const hh = slot.h * B.head.scale;
			const head = {
				x: slot.x + (slot.w - hh) / 2,
				y: slot.y + slot.h * B.head.centerAt - hh / 2,
				w: hh,
				h: hh,
			};
			add(plate);
			add(head);
			return { name: name as 'marky' | 'marty', plate, head };
		});

		// 3. free-spin count art, keyed on the AWARDED COUNT (never the mode, so the picture can
		// never disagree with the counter) — contains into a full-width box at 48%..78% of H
		const art = FREE_SPINS_ART[totalFs === 8 ? 8 : 10];
		const spins = {
			key: art.key,
			rect: add(contain(box(B.spins.x, B.spins.y, B.spins.w, B.spins.h), art.aspect)),
		};

		// 4. rules band — three EQUAL columns (or three stacked rows in portrait)
		const r = B.rules;
		const band = box(r.x, r.y, r.w, r.h);
		const titleCap = r.titleCap * D.h;
		const bodyCap = r.bodyCap * D.h;
		const badgeH = r.badge * D.h;
		const leafH = r.leaf * D.h;
		const rules = rulesFor(mode, 'short');
		const columns = RULES_LAYOUT[kind] === 'columns';
		const items: RuleItem[] = [];
		let dividers: number[] = [];
		let blockH = 0;

		/** largest cap at which `text` + its badge still fit ONE line of `width` */
		const fitTitleCap = (title: string, width: number, n: 1 | 2 | 3) => {
			const unit = layoutStencil({ parts: [{ text: title, face: 'gold' }], cap: 100 }).width;
			const badgeW = badgeH * goldBadgeAspect(n);
			return ((width * 0.98 - badgeW) * 100) / (unit + 30); // 30 = the word space at cap 100
		};
		/** largest cap at which `parts` wrap to at most `lines` inside `width` */
		const fitBodyCap = (parts: StencilPart[], width: number, lines: number, max: number) => {
			let lo = max * 0.4;
			let hi = max;
			if (layoutStencil({ parts, cap: hi, maxWidth: width, lead: r.lead }).lines <= lines) return hi;
			for (let i = 0; i < 18; i += 1) {
				const mid = (lo + hi) / 2;
				if (layoutStencil({ parts, cap: mid, maxWidth: width, lead: r.lead }).lines <= lines) lo = mid;
				else hi = mid;
			}
			return lo;
		};

		if (columns) {
			const colW = band.w / 3;
			// ONE title cap for all three so the headings read as a set; shrunk only if a 10-letter
			// title would otherwise wrap (that is the only element allowed to give).
			const headCap = Math.min(
				titleCap,
				...rules.map((rule, i) => fitTitleCap(rule.title, colW, (i + 1) as 1 | 2 | 3)),
			);
			const headGap = bodyCap * 0.35;
			rules.forEach((rule, i) => {
				const n = (i + 1) as 1 | 2 | 3;
				const colX = band.x + i * colW;
				const cx = colX + colW / 2;
				const head = layoutStencil({
					parts: [
						{ icon: goldBadgeFrame(n), scale: badgeH / headCap, aspect: goldBadgeAspect(n) },
						{ text: rule.title, face: 'gold' },
					],
					cap: headCap,
					maxWidth: colW,
					align: 'center',
				});
				// column 1 carries the leaf tile at its LEFT EDGE, its copy beside it
				const hasLeaf = i === 0 && rule.leafIcon;
				const leafGap = hasLeaf ? leafH * 0.14 : 0;
				const textW = colW - (hasLeaf ? leafH + leafGap : 0);
				const parts = bodyParts(rule, false);
				// Column 1 is the only one that has to give: the leaf tile takes a quarter of its
				// width, so its copy cannot hold three lines at the table's 3%-of-H cap. Corey's own
				// render sets that column in FOUR lines, so it gets a fourth line here too — which
				// keeps its cap within a whisker of the other two instead of collapsing it. Nothing
				// else changes; columns 2 and 3 stay at exactly 3 lines and exactly 3% of H.
				const cap = fitBodyCap(parts, textW, hasLeaf ? 4 : 3, bodyCap);
				const body = layoutStencil({ parts, cap, maxWidth: textW, lead: r.lead, align: 'center' });
				const bodyTop = band.y + head.height + headGap;
				const bodyCx = hasLeaf ? colX + leafH + leafGap + (colW - leafH - leafGap) / 2 : cx;
				const item: RuleItem = {
					head: { block: head, cx, top: band.y },
					body: { block: body, cx: bodyCx, top: bodyTop },
				};
				if (hasLeaf) {
					item.leaf = { x: colX, y: bodyTop + (body.height - leafH) / 2, w: leafH, h: leafH };
					add(item.leaf);
				}
				items.push(item);
				blockH = Math.max(blockH, head.height + headGap + Math.max(body.height, hasLeaf ? leafH : 0));
			});
			// dividers land on exact window fractions, not on content boundaries
			dividers = r.dividers.map((d) => (d - 0.5) * D.w);
		} else {
			// portrait: three stacked, fully centred rows — badge and gold title ride the glyph flow
			const rowGap = bodyCap * 0.45;
			let y = 0;
			rules.forEach((rule, i) => {
				const n = (i + 1) as 1 | 2 | 3;
				const parts: StencilPart[] = [
					{ icon: goldBadgeFrame(n), scale: badgeH / bodyCap, aspect: goldBadgeAspect(n) },
					{ text: ` ${rule.title} `, face: 'gold', capScale: titleCap / bodyCap },
					...bodyParts(rule, true),
				];
				const block = layoutStencil({
					parts,
					cap: bodyCap,
					maxWidth: band.w,
					lead: r.lead,
					align: 'center',
				});
				items.push({ body: { block, cx: band.x + band.w / 2, top: band.y + y } });
				y += block.height + rowGap;
			});
			blockH = Math.max(0, y - rowGap);
		}

		// The rules band is the only group whose height depends on how copy wraps; scale JUST it to
		// its own box so the art boxes above keep the render's exact fractions whatever the copy does.
		const rulesScale = Math.min(1, blockH > 0 ? band.h / blockH : 1);
		add({ x: band.x, y: band.y, w: band.w, h: blockH * rulesScale });

		// containment backstop — measured from real glyph extents before anything draws
		const minX = Math.min(...rects.map((q) => q.x));
		const maxX = Math.max(...rects.map((q) => q.x + q.w));
		const minY = Math.min(...rects.map((q) => q.y));
		const maxY = Math.max(...rects.map((q) => q.y + q.h));
		const k = Math.min(1, D.w / (maxX - minX), D.h / (maxY - minY));
		return { header, mugs, spins, items, dividers, band, rulesScale, blockH, k };
	});
</script>

<!-- persistent: the container claims its Game.svelte template slot at game start and keeps it —
     a lazy (re)mount joins the stage LAST, above layers that must cover it (z-order trap).
     FadeContainer sets visible=false at alpha 0, so the idle intro neither renders nor eats
     presses; content has no mount-armed logic, it re-renders from mode/host/totalFs. -->
<FadeContainer persistent {show}>
	<!-- no dim backdrop: the closed steel door IS the backdrop (Corey 2026-08-30) -->
	<MainContainer>
		<Container x={win.x + win.w / 2} y={win.y + win.h / 2} scale={fit}>
			<Container scale={composition.k}>
				<Sprite
					key={composition.header.key}
					x={composition.header.rect.x}
					y={composition.header.rect.y}
					width={composition.header.rect.w}
					height={composition.header.rect.h}
				/>
				{#each composition.mugs as mug (mug.name)}
					<Sprite
						key={INMATE_PLATE[mug.name].key}
						x={mug.plate.x}
						y={mug.plate.y}
						width={mug.plate.w}
						height={mug.plate.h}
					/>
					<Sprite
						key="{mug.name}Headshot"
						x={mug.head.x}
						y={mug.head.y}
						width={mug.head.w}
						height={mug.head.h}
					/>
				{/each}
				<Sprite
					key={composition.spins.key}
					x={composition.spins.rect.x}
					y={composition.spins.rect.y}
					width={composition.spins.rect.w}
					height={composition.spins.rect.h}
				/>
				<!-- the rules group scales about the band's CENTRE-TOP: the band is centred in the
				     window (x 5%..95%), so scaling about its left edge would slide the whole band
				     sideways whenever the copy needed shrinking (caught by the containment probe:
				     portrait was 21px left of centre) -->
				<Container y={composition.band.y * (1 - composition.rulesScale)} scale={composition.rulesScale}>
					{#if composition.dividers.length}
						<Graphics
							draw={(g) => {
								for (const x of composition.dividers) {
									g.moveTo(x, composition.band.y + composition.blockH * 0.04);
									g.lineTo(x, composition.band.y + composition.blockH * 0.96);
								}
								g.stroke({ color: 0xd8cdb4, width: 1.2, alpha: 0.45 });
							}}
						/>
					{/if}
					{#each composition.items as item, i (i)}
						{#if item.head}
							<StencilText block={item.head.block} x={item.head.cx} y={item.head.top} />
						{/if}
						{#if item.leaf}
							<Sprite key={GL_KEY} x={item.leaf.x} y={item.leaf.y} width={item.leaf.w} height={item.leaf.h} />
						{/if}
						<StencilText block={item.body.block} x={item.body.cx} y={item.body.top} tint={0xefe9dc} />
					{/each}
				</Container>
			</Container>
		</Container>
	</MainContainer>
	<!-- active={show}: this PressToContinue is ALWAYS mounted (persistent FadeContainer), so the
	     press-gate registration must follow visibility, not mount -->
	<PressToContinue showText active={show} onpress={() => oncomplete()} />
</FadeContainer>
