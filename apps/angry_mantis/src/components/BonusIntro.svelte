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
	// window aspect is the same everywhere.
	//
	// Three pieces only: the mode header, the mugshot plates and the free-spin count. The 1/2/3
	// rules band that used to sit under the count (EAT / REMOVE / HEAD START) came off on
	// 2026-09-09 (Corey): the mechanic is taught by the Game Info rules and by play itself, and
	// the art gets the whole door.
	//
	// The boxes sum to ~97% of the window height with no dead space, so containment is structural:
	// `fit` maps the design box onto the window, and a final measured `k` is a backstop that should
	// never engage. The plaque and PRESS ANYWHERE prompt live outside the door in their HUD slots.
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { Sprite, Container } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import { BONUS_INTRO_HEADER, BONUS_INTRO_HEADER_ASPECT, FREE_SPINS_ART, INMATE_PLATE } from '../game/constants';
	import { BONUS_INTRO, INTRO_DESIGN, frameFor, layoutKind } from '../game/layoutSpec';
	import PressToContinue from './PressToContinue.svelte';

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

		// containment backstop — measured from real glyph extents before anything draws
		const minX = Math.min(...rects.map((q) => q.x));
		const maxX = Math.max(...rects.map((q) => q.x + q.w));
		const minY = Math.min(...rects.map((q) => q.y));
		const maxY = Math.max(...rects.map((q) => q.y + q.h));
		const k = Math.min(1, D.w / (maxX - minX), D.h / (maxY - minY));
		return { header, mugs, spins, k };
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
			</Container>
		</Container>
	</MainContainer>
	<!-- active={show}: this PressToContinue is ALWAYS mounted (persistent FadeContainer), so the
	     press-gate registration must follow visibility, not mount -->
	<PressToContinue showText active={show} onpress={() => oncomplete()} />
</FadeContainer>
