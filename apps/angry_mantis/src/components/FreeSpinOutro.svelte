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
	import { Sprite } from 'pixi-svelte';
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
	import { doorRect, layoutKind } from '../game/layoutSpec';
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
	const door = $derived(doorRect(kind, vw).door);
	const trays = $derived({
		cx: door.x + door.w / 2,
		cy: door.y + DOOR_PAINT.outro.trays.y * door.h,
		size: DOOR_PAINT.outro.trays.size * door.w,
		gap: DOOR_PAINT.outro.trays.gap * door.w,
	});
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
						<!-- eaten trays: real plates over the door, not paint (Corey 2026-09-10) -->
						{#if recap}
							{#each recap.eatenList as symbol, i (symbol)}
								<Sprite anchor={0.5} x={trays.cx + (i - (recap.eatenList.length - 1) / 2) * trays.gap} y={trays.cy} width={trays.size * pop.current} height={trays.size * pop.current} key="{symbol}_eaten.png" />
							{/each}
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
