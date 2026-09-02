<script lang="ts" module>
	import type { BonusMode, BonusHost } from '../game/types';

	export type EmitterEventBonusIntro =
		| { type: 'bonusIntroShow'; mode: BonusMode; host: BonusHost; totalFs: number }
		| { type: 'bonusIntroHide' };
</script>

<script lang="ts">
	// The bonus board, stencilled on the CLOSED steel door (Corey's concept render, 2026-09-01):
	//   mode header art -> INMATE mugshot plates -> the free-spin count -> three numbered rules.
	// Everything is art or atlas glyphs — not one PIXI.Text — so the screen costs a few hundred
	// batched sprites off already-resident pages and rasterizes nothing (house rule 1).
	//
	// SIZING is transcribed from the render as PERCENTAGES of the door window (see BONUS_INTRO in
	// layoutSpec): the composition is authored in a design box of the window's aspect, so a table
	// percentage is literally that percentage of the door opening on screen and can be checked
	// against the render instead of eyeballed.
	//
	// CONTAINMENT (Corey's primary acceptance test): every element sits INSIDE the door window on
	// every layout. `fit` maps the design box onto the usable window (min of both axes, so it
	// provably lands inside), the rules band scales itself to its own slot if a mode's copy wraps
	// long, and a final measured `k` is the backstop. Only the ModePlaque and the PRESS ANYWHERE
	// prompt live outside, in their HUD slots below the frame.
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
		MUGSHOT_HEAD,
		STRIKE_GREEN,
		SYMBOL_INFO_MAP,
		rulesFor,
		type RuleCopy,
	} from '../game/constants';
	import { BONUS_INTRO, HUD, frameFor, layoutKind } from '../game/layoutSpec';
	import {
		goldBadgeAspect,
		goldBadgeFrame,
		layoutStencil,
		type StencilBlock,
		type StencilPart,
	} from '../game/stencilLayout';
	import PressToContinue from './PressToContinue.svelte';
	import MugshotPanel from './MugshotPanel.svelte';
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

	// ---- door window (the box everything must stay inside) ----
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
	const spec = $derived(BONUS_INTRO[kind]);
	// Phone-sideways is the one layout whose press prompt sits ON the door (the frame art reaches
	// master y ~730, so there is no free band under the rail), and an expanded portrait frame on a
	// tablet can grow down past its prompt too. Reserve that band out of the window rather than
	// hard-coding a per-kind number, so the intro can never run under the prompt even if the HUD
	// slot moves. PressToContinue draws its text across [y - 0.92h, y - 0.5h]; keep 10 master px
	// of air above it. Landscape and phone-portrait reserve nothing — their prompt is below the frame.
	const promptSlot = $derived(HUD[kind].pressToContinue);
	const reserveBottom = $derived(
		Math.max(0, win.y + win.h - (promptSlot.y - promptSlot.height * 0.92) + 10),
	);
	const usableH = $derived(win.h - reserveBottom);
	const fit = $derived(Math.min(win.w / spec.design.w, usableH / spec.design.h));

	// ---- composition, in design units with the ORIGIN AT THE DESIGN CENTRE ----
	type Rect = { x: number; y: number; w: number; h: number };
	const GL_KEY = SYMBOL_INFO_MAP.GL.static.assetKey;

	// In COLUMNS the Glowing Leaf is not an inline chip at all: it is a large tile standing to the
	// LEFT of column 1's copy (the concept render's treatment), sized from spec.rules.leaf and
	// placed by the composition below. Portrait's full-width rows keep it inline in the flow.
	const leafInline = $derived(spec.rules.layout === 'rows');
	const leafScale = 1.9;

	/** Body copy as tinted runs, with the real Glowing Leaf tile inlined where the concept
	 *  render put a green lightning icon — immediately before the GREEN STRIKE it names. */
	const bodyParts = (rule: RuleCopy): StencilPart[] => {
		const MARK = 'GREEN STRIKE';
		const at = rule.body.indexOf(MARK);
		const parts: StencilPart[] = [];
		if (at < 0) {
			if (rule.leafIcon && leafInline) parts.push({ icon: GL_KEY, scale: leafScale });
			parts.push({ text: rule.body });
			return parts;
		}
		if (at > 0) parts.push({ text: rule.body.slice(0, at) });
		if (rule.leafIcon && leafInline) parts.push({ icon: GL_KEY, scale: leafScale });
		parts.push({ text: MARK, tint: STRIKE_GREEN });
		parts.push({ text: rule.body.slice(at + MARK.length) });
		return parts;
	};

	type RuleItem = {
		/** columns only: boxed numeral + gold title on ONE line (the badge rides the glyph flow) */
		head?: { block: StencilBlock; cx: number; top: number };
		body: { block: StencilBlock; cx: number; top: number };
		/** columns only, rule 1: the big Glowing Leaf tile standing left of the copy */
		leaf?: { x: number; y: number; size: number };
	};

	const composition = $derived.by(() => {
		const D = spec.design;
		const top = -D.h / 2; // design-space y of the design box's top edge
		const pW = (p: number) => (p / 100) * D.w;
		const pH = (p: number) => (p / 100) * D.h;
		const r = spec.rules;
		const rules = rulesFor(mode, r.copy);
		const rects: Rect[] = [];
		const add = (rect: Rect): Rect => {
			rects.push(rect);
			return rect;
		};

		// 1. mode header art (both stencil lines are in the one image)
		const headerW = pW(spec.header.w);
		const headerH = headerW / BONUS_INTRO_HEADER_ASPECT;
		const header = {
			key: BONUS_INTRO_HEADER[mode],
			rect: add({ x: -headerW / 2, y: top + pH(spec.header.top), w: headerW, h: headerH }),
		};

		// 2. INMATE mugshot plates — both in feast, the single host centred otherwise. The plates
		// share a HEIGHT and keep their own aspects (01 and 02 are not the same shape, and their
		// chalk strokes must not scale non-uniformly), so the row width is the sum of the widths.
		const plateH = pH(spec.mugs.h);
		const plateOverhang = plateH * MUGSHOT_HEAD.size * MUGSHOT_HEAD.overhang;
		const plateCy = top + pH(spec.mugs.top) + plateH / 2;
		const widths = hosts.map((n) => plateH * INMATE_PLATE[n as 'marky' | 'marty'].aspect);
		const mugGap = pW(spec.mugs.gap);
		const rowW = widths.reduce((a, b) => a + b, 0) + mugGap * (hosts.length - 1);
		let mx = -rowW / 2;
		const mugs = hosts.map((name, i) => {
			const cx = mx + widths[i] / 2;
			mx += widths[i] + mugGap;
			// The head hangs MUGSHOT_HEAD.overhang of its own height past the plate's lower edge, so
			// the box this panel really occupies is taller than the plate. Measure it, or the
			// re-centring below is computed from a box smaller than what is drawn.
			add({ x: cx - widths[i] / 2, y: plateCy - plateH / 2, w: widths[i], h: plateH + plateOverhang });
			return { name: name as 'marky' | 'marty', cx, cy: plateCy, h: plateH };
		});

		// 3. free-spin count art, keyed on the AWARDED COUNT (never on the mode, so the picture can
		// never disagree with the counter). Its band is DERIVED: it opens spec.spins.gap below the
		// bottom of the HEAD INK (the head hangs past its plate, and the count art used to collide
		// with Marky's antennae) and closes at the rules band, so the art fills every pixel left
		// between the two. Fits by height, so the tall "8" and the wide "10" share the same slot.
		const art = FREE_SPINS_ART[totalFs === 8 ? 8 : 10];
		const headInkBottom = top + pH(spec.mugs.top + spec.mugs.h) + plateOverhang;
		const spinsTop = headInkBottom + pH(spec.spins.gap);
		const spinsBand = Math.max(0, top + pH(r.top) - spinsTop);
		const spinsW = Math.min(D.w * 0.95, spinsBand * art.aspect);
		const spinsH = spinsW / art.aspect;
		const spins = {
			key: art.key,
			rect: add({ x: -spinsW / 2, y: spinsTop + (spinsBand - spinsH) / 2, w: spinsW, h: spinsH }),
		};

		// 4. the three numbered rules
		const bandTop = top + pH(r.top);
		const bandH = pH(r.h);
		const bandW = pW(r.w);
		const badgeH = pH(r.badge);
		const titleCap = pH(r.titleCap);
		const bodyCap = pH(r.bodyCap);
		const items: RuleItem[] = [];
		let dividers: number[] = [];
		let blockH = 0;

		if (r.layout === 'columns') {
			const colGap = pW(r.gap);
			const headGap = bodyCap * 0.5;
			const leafSize = pH(r.leaf);
			const leafGap = leafSize * 0.14;

			// COLUMN WIDTHS ARE CONTENT-DRIVEN, not equal thirds, and every column is held to at most
			// THREE LINES. Column 1 has to house the large leaf tile AND the longest sentence, so
			// equal thirds would push it to five lines or halve the cap. For each column we binary
			// search the NARROWEST width whose real wrap is <= 3 lines (measured with the same pure
			// layout that draws it — no character-count guessing, which is what let a four-line
			// column through before), then widen everything proportionally to fill the band. If the
			// three together still cannot fit, the body cap backs off in 3% steps until they do, so
			// "<= 3 lines" is guaranteed and the cap is the largest that satisfies it.
			const TARGET_LINES = 3;
			const extra = rules.map((rule, i) => (i === 0 && rule.leafIcon ? leafSize + leafGap : 0));
			const partsFor = rules.map((rule) => bodyParts(rule));
			const solve = (cap: number) => {
				const bodies = partsFor.map((parts) => {
					const natural = layoutStencil({ parts, cap }).width;
					let lo = natural / (TARGET_LINES + 1);
					let hi = natural;
					for (let it = 0; it < 18; it += 1) {
						const mid = (lo + hi) / 2;
						if (layoutStencil({ parts, cap, maxWidth: mid, lead: r.lead }).lines <= TARGET_LINES)
							hi = mid;
						else lo = mid;
					}
					return hi;
				});
				const widths = bodies.map((w, i) => w + extra[i]);
				return { widths, total: widths.reduce((a, b) => a + b, 0) + colGap * 2 };
			};
			let cap = bodyCap;
			let sol = solve(cap);
			for (let guard = 0; guard < 12 && sol.total > bandW; guard += 1) {
				cap *= 0.97;
				sol = solve(cap);
			}
			const sum = sol.widths.reduce((a, b) => a + b, 0);
			const surplus = Math.max(0, bandW - sol.total);
			const colWs = sol.widths.map((w) => w + (surplus * w) / sum);
			const colLefts: number[] = [];
			let cxRun = -bandW / 2;
			for (const w of colWs) {
				colLefts.push(cxRun);
				cxRun += w + colGap;
			}
			const colW = Math.min(...colWs); // the tightest column governs the shared title cap
			// The badge + title must stay on ONE line: a wrapped title ("3 HEAD / START") reads as a
			// mistake. Title widths scale linearly with the cap while the badge does NOT (its size is
			// fixed by r.badge), so solve for the largest cap at which the WIDEST of the three titles
			// still fits its column, and use that one cap for all three so they stay a matched set.
			// width(cap) = badgeWidth + wordSpace(cap) + titleWidth(cap). The badge's width is fixed by
			// r.badge and does NOT scale with the cap, while the other two terms are linear in it, so
			// measuring the title once at cap 100 solves the largest fitting cap in closed form.
			// SPACE (0.3 of the cap) is the gap the layout puts between the badge and the title.
			const SPACE_AT_100 = 30;
			const headCap = Math.min(
				titleCap,
				...rules.map((rule, i) => {
					const n = (i + 1) as 1 | 2 | 3;
					const unit = layoutStencil({ parts: [{ text: rule.title, face: 'gold' }], cap: 100 }).width;
					const badgeW = badgeH * goldBadgeAspect(n);
					return (((colW * 0.98 - badgeW) * 100) / (unit + SPACE_AT_100));
				}),
			);
			rules.forEach((rule, i) => {
				const n = (i + 1) as 1 | 2 | 3;
				const cx = colLefts[i] + colWs[i] / 2;
				// badge + title on ONE line: the badge is inline art in the glyph flow, so it comes
				// out centred and baseline-aligned with the title without any extra bookkeeping
				const head = layoutStencil({
					parts: [
						{ icon: goldBadgeFrame(n), scale: badgeH / headCap, aspect: goldBadgeAspect(n) },
						{ text: rule.title, face: 'gold' },
					],
					cap: headCap,
					maxWidth: colWs[i],
					align: 'center',
				});
				const body = layoutStencil({
					parts: partsFor[i],
					cap,
					maxWidth: colWs[i] - extra[i],
					lead: r.lead,
					align: 'center',
				});
				const bodyTop = head.height + headGap;
				// column 1: leaf tile and copy are ONE centred group — the leaf on the left, the
				// text beside it, the pair centred in the column and vertically centred on each other
				const groupW = extra[i] + body.width;
				const bodyCx = extra[i] ? cx - groupW / 2 + extra[i] + body.width / 2 : cx;
				const item: RuleItem = {
					head: { block: head, cx, top: 0 },
					body: { block: body, cx: bodyCx, top: bodyTop },
				};
				let rowH = body.height;
				if (extra[i]) {
					rowH = Math.max(body.height, leafSize);
					item.leaf = {
						x: cx - groupW / 2,
						y: bodyTop + (body.height - leafSize) / 2,
						size: leafSize,
					};
				}
				items.push(item);
				blockH = Math.max(blockH, bodyTop + rowH);
			});
			dividers = [0, 1].map((i) => colLefts[i + 1] - colGap / 2);
		} else {
			// portrait only: three stacked, fully centred rows — the badge AND the gold title both
			// ride the glyph flow, so each rule is one centred wrapped block that uses the full
			// window width. Three columns here would put body copy under ~8 CSS px caps.
			const rowGap = pH(r.gap);
			let y = 0;
			rules.forEach((rule, i) => {
				const n = (i + 1) as 1 | 2 | 3;
				const block = layoutStencil({
					parts: [
						{ icon: goldBadgeFrame(n), scale: badgeH / bodyCap, aspect: goldBadgeAspect(n) },
						{ text: ` ${rule.title} `, face: 'gold', capScale: titleCap / bodyCap },
						...bodyParts(rule),
					],
					cap: bodyCap,
					maxWidth: bandW,
					lead: r.lead,
					align: 'center',
				});
				items.push({ body: { block, cx: 0, top: y } });
				y += block.height + rowGap;
			});
			blockH = Math.max(0, y - rowGap);
		}

		// The rules band is the one block whose height depends on how a mode's copy wraps. Scale
		// JUST that group to its own band (never the whole screen) so the header, plates and count
		// art keep the render's exact percentages whatever the copy does.
		const rulesScale = Math.min(1, blockH > 0 ? bandH / blockH : 1);
		const rulesTop = bandTop + (bandH - blockH * rulesScale) / 2;
		add({ x: -bandW / 2, y: rulesTop, w: bandW, h: blockH * rulesScale });

		// ---- the containment backstop ----
		// Union of every drawn rect, from real glyph extents (layoutStencil is pure, so this is
		// known before anything draws). The bands already sum to <= 99% of H, so k stays 1 in
		// practice; it exists so no future copy change can ever push art past the door edge.
		const minX = Math.min(...rects.map((q) => q.x));
		const maxX = Math.max(...rects.map((q) => q.x + q.w));
		const minY = Math.min(...rects.map((q) => q.y));
		const maxY = Math.max(...rects.map((q) => q.y + q.h));
		const k = Math.min(1, D.w / (maxX - minX), D.h / (maxY - minY));
		return {
			header,
			mugs,
			spins,
			items,
			dividers,
			rulesTop,
			rulesScale,
			blockH,
			k,
			ox: -((minX + maxX) / 2) * k,
			oy: -((minY + maxY) / 2) * k,
		};
	});
</script>

<!-- persistent: the container claims its Game.svelte template slot at game start and keeps it —
     a lazy (re)mount joins the stage LAST, above layers that must cover it (z-order trap).
     FadeContainer sets visible=false at alpha 0, so the idle intro neither renders nor eats
     presses; content has no mount-armed logic, it re-renders from mode/host/totalFs. -->
<FadeContainer persistent {show}>
	<!-- no dim backdrop: the closed steel door IS the backdrop (Corey 2026-08-30) -->
	<MainContainer>
		<!-- centred on the USABLE part of the window (see reserveBottom) — with fit taken as the min
		     of both axes the design box provably lands inside it, and `k` keeps the content inside
		     the design box, so nothing can reach the door edges or the press prompt -->
		<Container x={win.x + win.w / 2} y={win.y + usableH / 2} scale={fit}>
			<Container x={composition.ox} y={composition.oy} scale={composition.k}>
				<Sprite
					key={composition.header.key}
					x={composition.header.rect.x}
					y={composition.header.rect.y}
					width={composition.header.rect.w}
					height={composition.header.rect.h}
				/>
				{#each composition.mugs as mug (mug.name)}
					<MugshotPanel x={mug.cx} y={mug.cy} h={mug.h} name={mug.name} />
				{/each}
				<Sprite
					key={composition.spins.key}
					x={composition.spins.rect.x}
					y={composition.spins.rect.y}
					width={composition.spins.rect.w}
					height={composition.spins.rect.h}
				/>
				<!-- the rules band scales as one group inside its own slot -->
				<Container y={composition.rulesTop} scale={composition.rulesScale}>
					{#if composition.dividers.length}
						<Graphics
							draw={(g) => {
								// span the MEASURED content height, not the band: the group is centred in
								// its band, so drawing the full band height from the group's own origin
								// ran the rules past the door's bottom edge (caught by the containment probe)
								const h = composition.blockH;
								for (const x of composition.dividers) {
									g.moveTo(x, h * 0.04);
									g.lineTo(x, h * 0.96);
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
							<Sprite
								key={GL_KEY}
								x={item.leaf.x}
								y={item.leaf.y}
								width={item.leaf.size}
								height={item.leaf.size}
							/>
						{/if}
						<StencilText
							block={item.body.block}
							x={item.body.cx}
							y={item.body.top}
							tint={0xefe9dc}
						/>
					{/each}
				</Container>
			</Container>
		</Container>
	</MainContainer>
	<!-- active={show}: this PressToContinue is ALWAYS mounted (persistent FadeContainer), so the
	     press-gate registration must follow visibility, not mount -->
	<PressToContinue showText active={show} onpress={() => oncomplete()} />
</FadeContainer>
