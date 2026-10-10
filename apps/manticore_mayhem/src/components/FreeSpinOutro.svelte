<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		/** `capped`: the book's `wincap` came this round, so this is the MAX WIN wrap up (never read off the amount) */
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData; capped?: boolean }
		| { type: 'freeSpinOutroHide' };
</script>

<script lang="ts">
	// The feature wrap-up: what the whole session paid and how many spins it took. It is the animated win
	// plaque's wrap screen (components/StingerPlaque.svelte): TOTAL WIN punches in, the amount counts (paced
	// as Angry Mantis paces its wrap-up: the end-feature ladder, never under 1.2 s), the line "in N <mode>"
	// fades in, then the press gate. Veins and embers sit at the tier the book's own level names. The plain
	// screen below stays as the fallback for art that never arrived.
	// A MAX WIN ROUND (the event's `capped`, set from the book's `wincap`; Corey 2026-10-09): the same screen,
	// titled with the win ladder's words instead of TOTAL WIN: BIG WIN slams in and the amount counts to the
	// book's capped amount on the house Max pacing (winLevelMap level 10, 7 s over the base ladder's bars), the
	// title and the look stepping up through Super / Mega / Epic to MAX WIN with each tier's clip; then the
	// same line and the same gate.
	import { Rectangle } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import { BONUS_MODE_LABEL, STINGER_PLAQUE } from '../game/constants';
	import { awaitPlaqueAssets } from '../game/assetGate';
	import { WIN_TIER_SOUND, WIN_TIER_STAGES_END_FEATURE, winLevelMap } from '../game/winLevelMap';
	import { stingerPlaque } from './StingerPlaque.svelte';
	import CountUpText from './CountUpText.svelte';
	import ArtAmount from './ArtAmount.svelte';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();
	const master = $derived(context.stateLayoutDerived.mainLayout());
	const recap = $derived(context.stateGame.sessionRecap);

	let show = $state(false);
	let target = $state(0);
	let resolveGate: (() => void) | null = $state(null);
	// the plaque is carrying this wrap-up (nothing of the plain screen is drawn), and its amount is still counting
	let viaPlaque = $state(false);
	let counting = $state(false);
	// the plain fallback's title word
	let maxWin = $state(false);
	const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
	const dim = new Tween(0, { duration: 280, easing: cubicOut });
	const counted = new Tween(0, { duration: 1200, easing: cubicOut });

	const dismiss = () => {
		const r = resolveGate;
		resolveGate = null;
		r?.();
	};

	context.eventEmitter.subscribeOnMount({
		freeSpinOutroShow: async () => {
			await awaitPlaqueAssets();
			// the line needs the session's recap (bonusEnd wrote it just before this)
			viaPlaque = !!context.stateGame.sessionRecap && !!stingerPlaque.flow?.ready();
			if (viaPlaque) return;
			show = true;
			await dim.set(0.68);
		},
		freeSpinOutroCountUp: async ({ amount, winLevelData, capped }) => {
			maxWin = !!capped;
			// a capped round is the Max tier by the book's own event, whatever level the event carries
			if (capped) winLevelData = winLevelMap[10];
			const big = winLevelData.type === 'big';
			const tier = big ? Math.max(0, WIN_TIER_STAGES_END_FEATURE.findIndex((s) => s.alias === winLevelData.alias)) : 0;
			const session = context.stateGame.sessionRecap;
			const flow = stingerPlaque.flow;
			if (viaPlaque && flow && session) {
				counting = true;
				await flow.wrap({
					amount,
					tier,
					mode: session.mode,
					line: `in ${session.spinsPlayed} ${titleCase(BONUS_MODE_LABEL[session.mode])}`,
					durationMs: Math.max(STINGER_PLAQUE.wrapMinCountMs, winLevelData.presentDuration / context.stateGameDerived.timeScale()),
					ladder: 'endFeature',
					sound: big,
					maxWin: !!capped,
				});
				counting = false;
				await flow.lineIn();
				// auto bonuses press on a moment after the count (Angry Mantis); re-checked when the hold ends, so
				// stopping autoplay during it brings the press gate back
				if (autoBonusesRunning()) await waitForTimeout(STINGER_PLAQUE.wrapAutoHoldMs);
				if (!autoBonusesRunning()) await waitForResolve((resolve) => (resolveGate = resolve));
				return;
			}
			if (big) context.eventEmitter.broadcast({ type: 'soundOnce', name: WIN_TIER_SOUND[tier] });
			target = amount;
			counted.set(0, { duration: 0 });
			await counted.set(amount, { duration: Math.max(900, winLevelData.presentDuration) });
			if (!autoBonusesRunning()) await waitForResolve((resolve) => (resolveGate = resolve));
		},
		freeSpinOutroHide: async () => {
			dismiss();
			if (viaPlaque) {
				counting = false;
				await stingerPlaque.flow?.hide();
				viaPlaque = false;
				return;
			}
			await dim.set(0, { duration: 260 });
			show = false;
		},
	});
</script>

{#if show}
	<MainContainer>
		<Rectangle width={master.width} height={master.height} backgroundColor={0x05060a} alpha={dim.current} />
		<ArtAmount
			text={recap ? BONUS_MODE_LABEL[recap.mode] : 'FREE SPINS'}
			height={master.height * 0.06}
			x={master.width / 2}
			y={master.height * 0.34}
			maxWidth={master.width * 0.8}
			tint={0x9fd9d4}
		/>
		<ArtAmount text={maxWin ? 'MAX WIN' : 'TOTAL WIN'} height={master.height * 0.045} x={master.width / 2} y={master.height * 0.44} maxWidth={master.width * 0.6} alpha={0.8} />
		<CountUpText amount={counted.current} {target} settled={counted.current === target} size={master.height * 0.11} x={master.width / 2} y={master.height * 0.58} maxWidth={master.width * 0.84} />
		{#if recap}
			<ArtAmount text="{recap.spinsPlayed} SPINS PLAYED" height={master.height * 0.035} x={master.width / 2} y={master.height * 0.68} maxWidth={master.width * 0.6} alpha={0.7} />
		{/if}
	</MainContainer>
{/if}

<!-- a press while the plaque counts lands the amount; once it has landed, the press continues -->
{#if counting || resolveGate}
	<PressToContinue showText={!!resolveGate} onpress={() => (counting ? stingerPlaque.flow?.skip() : dismiss())} />
{/if}
