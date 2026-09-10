<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	// End-of-feature wrap-up on the closed steel door — ONE screen, one press gate (Corey
	// 2026-08-31, replacing the separate SessionSummary): the session recap stashed by bonusEnd
	// (mode header, spins/symbols line, eaten trays) stacked over the tier title + total-win
	// count-up. Text-based (replaces the Mining Mayhem fsOutro Spine + sprites).
	import { Container, Sprite } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import { stateBetDerived } from 'state-shared';
	import { BONUS_INTRO_HEADER, BONUS_INTRO_HEADER_ASPECT } from '../game/constants';
	import { frameFor, layoutKind } from '../game/layoutSpec';
	import PressToContinue from './PressToContinue.svelte';
	import GameText from './GameText.svelte';
	import ArtAmount from './ArtAmount.svelte';
	import StingerPlate from './StingerPlate.svelte';
	import { stingerPlateFor } from '../game/stinger';
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

	// Everything fits INSIDE the door's window (BonusIntro pattern): content is authored in a
	// 620×500 design space centered on the window, then uniformly scaled to fit. Only the PRESS
	// ANYWHERE prompt lives outside, below the counter (HUD pressToContinue slot).
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
	const fit = $derived(Math.min(win.w / 620, win.h / 500, 1.15));
	// The mode header is the intro's stencil art (BONUS / SUPER / FEAST + tagline), sized to the
	// same weight it carries on the intro: it owns the top ~28% of the design space, contained by
	// width, and the recap line + trays sit tight under it (Corey 2026-09-02).
	const HEADER_W = 420;
	const HEADER_H = HEADER_W / BONUS_INTRO_HEADER_ASPECT; // ~138
	const HEADER_Y = -250 + 4 + HEADER_H / 2;
	// the stack (header … plate) spans -246..+185 of the ±250 design space, sitting high so the
	// plate's bottom clears the door's bottom rail with room to spare (Corey 2026-09-09)
	const GROUP_DY = 0;
	const TRAY_Y = -46;
	// the stinger plate under the trays: 540 of the 620 design width (~190 tall), centred at +90
	// so it runs -5..+185 — under the tray row (bottom -14) and well above the rail
	const PLATE_W = 540;
	const PLATE_Y = 90;
	// stashed by the bonusEnd handler right before this freeSpinEnd presentation
	const recap = $derived(context.stateGame.sessionRecap);
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
							// the tier plate's slam stinger, once (it used to ride the branded title's mount)
							if (big) context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_win_big', forcePlay: true });
							if (big) countSound('soundLoop');
							return startCountUp().then(() => {
								if (big) countSound('soundStop');
								autoContinueAfterCountUp();
							});
						}}
					/>
					<!-- no dim backdrop: the closed steel door IS the backdrop (Corey 2026-08-30).
					     All glyphs here are atlas sprites (ArtAmount/StingerPlate/trays) except the
					     TOTAL WIN is branded glyph sprites too — nothing rasterizes per frame, and the
					     {#key presentId} remount keeps no PIXI.Text updating while invisible. -->
					<MainContainer>
						<Container x={win.x + win.w / 2} y={win.y + win.h / 2 + GROUP_DY * fit} scale={pop.current * fit}>
							<!-- Corey's COMPLETE stamp will overlay this header when it lands -->
							<Sprite key={BONUS_INTRO_HEADER[recap?.mode ?? context.stateGame.bonusMode] ?? 'headerBonus'} anchor={0.5} y={HEADER_Y} width={HEADER_W} height={HEADER_H} />
							{#if recap}
								<ArtAmount y={-94} text={`${recap.spinsPlayed} SPIN${recap.spinsPlayed === 1 ? '' : 'S'} - ${recap.symbolsEaten} SYMBOL${recap.symbolsEaten === 1 ? '' : 'S'} EATEN`} height={24} maxWidth={580} />
								{#each recap.eatenList as symbol, i (symbol)}
									<Sprite anchor={0.5} x={(i - (recap.eatenList.length - 1) / 2) * 72} y={TRAY_Y} width={64} height={64} key="{symbol}_eaten.png" />
								{/each}
							{/if}
							<!-- The FINAL tier's stinger plate, no hand-offs, with the count on it; the plain plate
							     when the total is not a big win. winLevelData arrives already gated: freeSpinEnd
							     hands over a medium level when the round total is under what the round cost
							     (Corey 2026-09-09). It rides the door with everything else in this group. -->
							<StingerPlate plate={stingerPlateFor(winLevelData?.type === 'big' ? winLevelData.alias : undefined)} width={PLATE_W} y={PLATE_Y} amount={countUpAmount} target={amount} settled={countUpCompleted} />
						</Container>
					</MainContainer>
					<!-- active={show}: winLevelData outlives the fade-out (cleared on settle), so the press
					     gate must follow visibility or Space stays disabled through the door-open -->
					<PressToContinue showText active={show} onpress={() => (countUpCompleted ? oncomplete() : finishCountUp())} />
				{/snippet}
			</StagedCountUpProvider>
		{/if}
	{/key}
</FadeContainer>
