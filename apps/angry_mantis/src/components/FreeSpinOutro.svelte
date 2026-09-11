<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	// End-of-feature wrap-up on the closed steel door — ONE screen, one press gate (Corey
	// 2026-08-31, replacing the separate SessionSummary). Since 2026-09-10 the door itself carries
	// the presentation: the mode header, the BIG WIN plate (big-tier totals only) and the amount are
	// PAINTED into the steel by DoorPaint.svelte (game/doorPaint.ts) and roll down with it. This
	// component only lays the eaten trays over the door, drives the count-up into the paint state,
	// and holds the press gate. The recap line ("N SPINS - M SYMBOLS EATEN") came off (Corey).
	import * as PIXI from 'pixi.js';
	import { Container, Graphics, Rectangle, Sprite } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import { stateBetDerived } from 'state-shared';
	import { doorRect, layoutKind, FRAME_ART, RAIL_ART } from '../game/layoutSpec';
	import { DOOR_PAINT, paintedAmountSupported } from '../game/doorPaint';
	import { doorPaintState } from '../game/doorPaint.svelte';
	import { tokenizeNumerals } from '../game/numeralTokens';
	import { STINGER_PLATE } from '../game/stinger';
	import PressToContinue from './PressToContinue.svelte';
	import CountUpText from './CountUpText.svelte';
	import PaintedAmountFeed from './PaintedAmountFeed.svelte';
	import StagedCountUpProvider from './StagedCountUpProvider.svelte';
	import { WIN_TIER_STAGES_END_FEATURE } from '../game/winLevelMap';

	const context = getContext();

	const countSound = (type: 'soundLoop' | 'soundStop') =>
		context.eventEmitter.broadcast({ type, name: 'sfx_money_counter' });

	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	// one presentation per count-up: the {#key} below rebuilds the provider/OnMount subtree even
	// when the previous fade-out hasn't cleared winLevelData yet (the persistent FadeContainer no
	// longer unmounts it for us) — a remount-armed count-up would otherwise never start and the
	// awaited freeSpinOutroCountUp would never resolve on the second bonus
	let presentId = $state(0);
	let oncomplete = $state(() => {});
	const pop = new Tween(0.6, { duration: 420, easing: backOut });

	context.eventEmitter.subscribeOnMount({
		freeSpinOutroShow: () => {
			show = true;
			pop.set(0.6, { duration: 0 });
			pop.set(1);
		},
		freeSpinOutroHide: async () => (show = false),
		freeSpinOutroCountUp: async (emitterEvent) => {
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			// the plate is painted for big-tier totals only; under that the amount sits on bare steel
			// (Corey 2026-09-10). winLevelData arrives already gated by freeSpinEnd (a buy that did not
			// pay for itself is held to a medium level).
			doorPaintState.plate = emitterEvent.winLevelData.type === 'big';
			presentId += 1;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});

	// AUTOPLAY BONUSES: a running autoplay presses on for the player 1s AFTER the count-up has
	// settled (startCountUp resolves once countUpCompleted is set, finishCountUp interrupts
	// included) — the total-win count is never cut short. This is the ONLY wrap-up gate now.
	const autoContinueAfterCountUp = async () => {
		if (!autoBonusesRunning()) return;
		const press = oncomplete; // pin to this outro's gate — a late timer must not press a future one
		await waitForTimeout(1000);
		// re-checked at FIRE time (BonusIntro precedent): stopping autoplay during the window
		// (autoSpinsCounter -> 0) must restore the hard press-gate, not press through it
		if (autoBonusesRunning()) press();
	};

	// the closed door's rect (layoutSpec.doorRect) — the trays are placed in fractions of it, the
	// same units the painted layers use, so they land where the artifact put them
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const vw = $derived(
		context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale,
	);
	const rects = $derived(doorRect(kind, vw));
	const door = $derived(rects.door);
	// the counter: the trays' bottom edge sits on the rail's top face, in frame-art px mapped
	// through the window's vertical scale (portrait grows the frame, so never a master constant)
	const railSy = $derived(rects.win.h / FRAME_ART.winH);
	const trays = $derived.by(() => {
		const t = DOOR_PAINT.outro.trays;
		const size = t.size * door.w;
		const bottom = rects.win.y + rects.win.h + t.railSit * railSy;
		// the sprite is centred; its art ends artBottom of the way down, and THAT edge stands on the rail
		return { cx: door.x + door.w / 2, cy: bottom - size * t.artBottom + size / 2, bottom, size, gap: t.gap * door.w };
	});
	// the reflections live on the bright band right under the trays only: the rest of the rail's
	// top face and its highlight seam, never the front face below (that is the mode pill's, and a
	// mirror down there read as a smear behind it — Corey 2026-09-11). Frame-art px → master.
	const railSeam = $derived(rects.win.y + rects.win.h + (RAIL_ART.frontFace[0] - FRAME_ART.winY - FRAME_ART.winH) * railSy);
	const trayX = (i: number, n: number) => trays.cx + (i - (n - 1) / 2) * trays.gap;
	// the leaning tray's shadow: a wedge from its top corners (touching the door, no shadow) to a
	// wider, darker foot, as `bands` stacked quads with rising alpha — drawn once per size, no
	// gradient texture. Local space: the tray's centre, size s.
	const drawLeanShadow = (g: PIXI.Graphics, s: number) => {
		const t = DOOR_PAINT.outro.trays;
		const top = -s / 2 + s * t.shadow.artTop;
		const bottom = -s / 2 + s * t.artBottom;
		const half = (s * t.shadow.artWidth) / 2;
		const n = t.shadow.bands;
		for (let k = 0; k < n; k++) {
			const q0 = k / n;
			const q1 = (k + 1) / n;
			const y0 = top + (bottom - top) * q0;
			const y1 = top + (bottom - top) * q1;
			const w0 = half + s * t.shadow.flare * q0;
			const w1 = half + s * t.shadow.flare * q1;
			const a = t.shadow.alpha * ((q0 + q1) / 2) ** 1.3;
			g.poly([-w0, y0, w0, y0, w1, y1, -w1, y1]).fill({ color: 0x000000, alpha: a });
		}
	};
	// stashed by the bonusEnd handler right before this freeSpinEnd presentation
	const recap = $derived(context.stateGame.sessionRecap);

	// ---- the amount: painted when the atlas can draw it, else the sprite count-up over the door ----
	const targetText = $derived(bookEventAmountToCurrencyString(amount));
	const painted = $derived(paintedAmountSupported(targetText, tokenizeNumerals));
	// fallback box (master units): the same spot the paint would use
	const fallback = $derived.by(() => {
		const o = DOOR_PAINT.outro;
		if (doorPaintState.plate) {
			const plateW = o.plate.w * door.w;
			const plateH = plateW / STINGER_PLATE.big.aspect;
			return { x: door.x + door.w / 2 + o.amountInPlate.dx * plateW, y: door.y + o.plate.y * door.h + o.amountInPlate.dy * plateH, h: o.amountInPlate.h * plateH, maxW: o.amountInPlate.maxW * plateW };
		}
		return { x: door.x + door.w / 2, y: door.y + o.amountOnDoor.y * door.h, h: o.amountOnDoor.h * door.w, maxW: o.amountOnDoor.maxW * door.w };
	});
</script>


<!-- persistent: the container claims its Game.svelte template slot at game start and keeps it —
     a lazy (re)mount joins the stage LAST, above layers that must cover it (z-order trap) -->
<FadeContainer
	persistent
	{show}
	oncomplete={() => {
		// drop the presentation only once the fade-OUT settles (a superseded fade's promise never
		// resolves, and the guard re-checks, so a show overlap can't wipe the incoming one);
		// while empty, the subtree's press rect and hotkey are gone too
		if (!show) winLevelData = undefined;
	}}
>
	{#key presentId}
		{#if winLevelData}
			{@const duration = Math.max(1200, winLevelData.presentDuration / stateBetDerived.timeScale())}
			<StagedCountUpProvider {amount} {duration} stages={WIN_TIER_STAGES_END_FEATURE}>
				{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
					<!-- same rule as Win.svelte: the money-counter loop rides big-tier wrap-ups only, and
					     stops the moment the count settles or a press skips it -->
					<OnMount
						onmount={() => {
							const big = winLevelData?.type === 'big';
							// no slam stinger on the wrap-up (Corey 2026-09-10): the plate is painted on the door
							// that just rolled down, so the sting belongs to mid-feature big wins only
							if (big) countSound('soundLoop');
							return startCountUp().then(() => {
								if (big) countSound('soundStop');
								autoContinueAfterCountUp();
							});
						}}
					/>
					<!-- the counting value goes INTO the paint (DoorPaint rewrites the glyph boxes — a few
					     uniforms, no raster) -->
					<PaintedAmountFeed value={countUpAmount} target={amount} enabled={painted} />
					<MainContainer>
						<!-- eaten trays: real plates standing on the counter under the plate (Corey 2026-09-10/11) -->
						{#if recap}
							{@const n = recap.eatenList.length}
							{@const t = DOOR_PAINT.outro.trays}
							{@const s = trays.size * pop.current}
							<!-- 1. shadows on the door behind them: a wedge per leaning tray, clipped to the door so
							     nothing falls on the counter -->
							<Container>
								<Rectangle isMask x={door.x} y={door.y} width={door.w} height={rects.win.y + rects.win.h - door.y} />
								{#each recap.eatenList as symbol, i (symbol)}
									<Graphics x={trayX(i, n)} y={trays.cy} draw={(g) => drawLeanShadow(g, s)} />
								{/each}
							</Container>
							<!-- 2. the trays, bottom edge on the rail's top face -->
							{#each recap.eatenList as symbol, i (symbol)}
								<Sprite anchor={0.5} x={trayX(i, n)} y={trays.cy} width={s} height={s} key="{symbol}_eaten.png" />
							{/each}
							<!-- 3. reflections down the rail's front face: mirrored, squashed, steel-blue additive,
							     clipped to the rail's top face + seam under the trays -->
							<Container>
								<Rectangle isMask x={door.x} y={trays.bottom} width={door.w} height={Math.max(1, railSeam - trays.bottom)} />
								{#each recap.eatenList as symbol, i (symbol)}
									<!-- the mirror lives on a wrapper: Pixi's width/height setters keep the sprite's own
									     scale sign, so a negative scale on the sized sprite would flip every pop tick -->
									<Container x={trayX(i, n)} y={trays.bottom} scale={{ x: 1, y: -t.reflect.squash }}>
										<!-- anchored on the art's bottom pixel, not the frame's, so the mirror touches the tray -->
										<Sprite anchor={{ x: 0.5, y: t.artBottom }} width={s} height={s} tint={t.reflect.tint} alpha={t.reflect.alpha} blendMode="add" key="{symbol}_eaten.png" />
									</Container>
								{/each}
							</Container>
						{/if}
						{#if !painted}
							<!-- a currency the stencil atlas cannot paint (or too long for the shader's slots):
							     the sprite/styled count-up sits on the door in the paint's spot instead -->
							<CountUpText amount={countUpAmount} target={amount} settled={countUpCompleted} size={fallback.h} x={fallback.x} y={fallback.y + fallback.h / 2} maxWidth={fallback.maxW} tint={DOOR_PAINT.outro.amountColor} shadow={{ dx: DOOR_PAINT.outro.shadowOffset.dx, dy: DOOR_PAINT.outro.shadowOffset.dy, tint: DOOR_PAINT.outro.amountShadow }} />
						{/if}
					</MainContainer>
					<!-- active={show}: winLevelData outlives the fade-out (cleared on settle), so the press
					     gate must follow visibility or Space stays disabled through the door-open -->
					<PressToContinue showText active={show} onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())} />
				{/snippet}
			</StagedCountUpProvider>
		{/if}
	{/key}
</FadeContainer>
