<script lang="ts">
	// The big-win presentation: Corey's tier STINGER plates (game/stinger.ts) with the count-up in
	// the plate's blank panel. Motion picked in the "Win Stingers" preview (2026-09-09):
	//   enter  the BIG plate drops in from above and settles with a SCREEN kick (the whole canvas
	//          jolts, game/screenKick.ts), then the count starts
	//   shove  every tier upgrade is a chow-line shove — the next plate slides in from the right and
	//          pushes the old one out the left, with a lighter kick as it hits home. The number
	//          stays put unless the incoming plate's box sits elsewhere (MAX), then it rides in with
	//          the plate so it lands already in place.
	//   exit   the plate drops off the bottom, rotating, and the amount fades with it.
	// Pure transforms on resident sprites: nothing rasterizes, nothing filters (house rule 1/2).
	import { Container, Sprite } from 'pixi-svelte';
	import { bookEventAmountToBetAmountMultiplier } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { STINGER as STINGER_LAYOUT, layoutKind } from '../game/layoutSpec';
	import { STINGER_AMOUNT, STINGER_BOX, STINGER_MOTION, STINGER_PLATE, STINGER_TIERS, type StingerTier } from '../game/stinger';
	import { WIN_TIER_STAGES } from '../game/winLevelMap';
	import CountUpText from './CountUpText.svelte';
	import { screenKick } from '../game/screenKick';

	type Props = {
		/** the counting book amount */
		amount: number;
		/** the count's final book amount */
		target: number;
		/** the tier the book awarded — upgrades never reveal past it */
		finalAlias: string;
		settled?: boolean;
		/** flip true to play the exit; `onleft` fires when the plate is gone */
		leaving?: boolean;
		onleft?: () => void;
	};
	const { amount, target, finalAlias, settled = false, leaving = false, onleft }: Props = $props();

	const context = getContext();
	const master = $derived(context.stateLayoutDerived.mainLayout());
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const L = $derived(STINGER_LAYOUT[kind]);
	const plateW = $derived(master.width * L.w);
	const plateH = (tier: StingerTier) => plateW / STINGER_PLATE[tier].aspect;

	// tier from the climbing amount, capped at the book's tier (same bars as the wrap-up title)
	const capIndex = $derived(Math.max(0, STINGER_TIERS.indexOf(finalAlias as StingerTier)));
	const stageIndex = $derived.by(() => {
		const xBet = bookEventAmountToBetAmountMultiplier(amount);
		let i = 0;
		while (i < capIndex && xBet >= WIN_TIER_STAGES[i + 1].xBet) i++;
		return i;
	});

	// ---- motion ----
	type Anim = { kind: 'enter' | 'shove' | 'exit'; t0: number; dur: number };
	let shown = $state(0);
	let outgoing = $state<number | null>(null);
	let anim = $state<Anim | null>(null);
	let p = $state(1); // progress of `anim`, 0..1
	let raf = 0;
	let now = $state(performance.now());

	const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
	const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
	const easeInCubic = (t: number) => t * t * t;
	const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

	const slam = () => context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_win_big', forcePlay: true });
	// the whole canvas jolts — amplitude in master px, scaled to canvas px
	const startKick = (amp: number) => screenKick(context.stateApp.pixiApplication, amp * master.scale);
	const start = (kind: Anim['kind'], dur: number) => {
		anim = { kind, t0: performance.now(), dur };
		p = 0;
		if (!raf) raf = requestAnimationFrame(step);
	};
	const step = (t: number) => {
		now = t;
		let live = false;
		if (anim) {
			p = Math.min(1, (t - anim.t0) / anim.dur);
			if (p >= 1) {
				const done = anim.kind;
				anim = null;
				if (done === 'shove') outgoing = null;
				if (done === 'enter') startKick(STINGER_MOTION.kickEnter);
				if (done === 'exit') onleft?.();
			} else live = true;
		}
		raf = live ? requestAnimationFrame(step) : 0;
	};
	$effect(() => () => cancelAnimationFrame(raf));

	// first render: drop in; upgrades: shove; `leaving`: drop out
	let lastIndex = -1;
	$effect(() => {
		const next = stageIndex;
		if (lastIndex === -1) {
			shown = next;
			start('enter', STINGER_MOTION.enter);
			slam();
		} else if (next !== lastIndex) {
			outgoing = shown;
			shown = next;
			start('shove', STINGER_MOTION.shove);
			setTimeout(() => startKick(STINGER_MOTION.kickShove), STINGER_MOTION.shove * 0.78);
			slam();
		}
		lastIndex = next;
	});
	$effect(() => {
		if (leaving && anim?.kind !== 'exit') start('exit', STINGER_MOTION.exit);
	});

	// ---- per-frame transforms (master px) ----
	const shownTier = $derived(STINGER_TIERS[shown]);
	const outTier = $derived(outgoing === null ? null : STINGER_TIERS[outgoing]);
	const groupY = $derived(master.height * L.cy);
	// enter: from above the screen; exit: off the bottom with a tilt
	const drop = $derived.by(() => {
		if (!anim) return { y: 0, rot: 0, alpha: 1 };
		if (anim.kind === 'enter') {
			const e = easeOutBack(p);
			return { y: -(groupY + plateH(shownTier)) * (1 - e), rot: -0.05 * (1 - p), alpha: 1 };
		}
		if (anim.kind === 'exit') {
			const e = easeInCubic(p);
			return { y: (master.height - groupY + plateH(shownTier)) * e, rot: 0.17 * e, alpha: 1 - 0.6 * p };
		}
		return { y: 0, rot: 0, alpha: 1 };
	});
	// shove: incoming from +125% W (overshoot to -3% at 80%), outgoing to -125% W
	const shoveIn = $derived.by(() => {
		if (anim?.kind !== 'shove') return 0;
		const q = p < 0.8 ? easeOutQuint(p / 0.8) : 1;
		const over = p < 0.8 ? 0 : easeInOut((p - 0.8) / 0.2);
		return plateW * (1.25 * (1 - q) - 0.03 * (p < 0.8 ? q : 1 - over));
	});
	const shoveOut = $derived.by(() => {
		if (anim?.kind !== 'shove') return 0;
		const lag = STINGER_MOTION.shoveLag / STINGER_MOTION.shove;
		const q = Math.max(0, (p - lag) / (1 - lag));
		return -plateW * 1.25 * easeInOut(q);
	});
	// the number rides in with the incoming plate only when its box moved (MAX)
	const boxMoves = $derived(outTier !== null && JSON.stringify(STINGER_BOX[outTier]) !== JSON.stringify(STINGER_BOX[shownTier]));
	const amountX = $derived(boxMoves ? shoveIn : 0);

	// amount box in plate-centred master px (box is % of the plate)
	const box = $derived.by(() => {
		const b = STINGER_BOX[shownTier];
		const ph = plateH(shownTier);
		return {
			cx: ((b.x + b.w / 2) / 100 - 0.5) * plateW,
			cy: ((b.y + b.h / 2) / 100 - 0.5) * ph,
			w: (b.w / 100) * plateW * STINGER_AMOUNT.fillW,
			h: (b.h / 100) * ph * STINGER_AMOUNT.fillH,
		};
	});
</script>

<Container x={master.width * 0.5} y={groupY + drop.y} rotation={drop.rot} alpha={drop.alpha}>
	{#if outTier !== null}
		<Sprite key={STINGER_PLATE[outTier].key} anchor={0.5} x={shoveOut} width={plateW} height={plateH(outTier)} />
	{/if}
	<Sprite key={STINGER_PLATE[shownTier].key} anchor={0.5} x={shoveIn} width={plateW} height={plateH(shownTier)} />
	<!-- CountUpText's y is the digit BASELINE; centre the digit box on the panel -->
	<CountUpText
		{amount}
		{target}
		{settled}
		preset="gold"
		size={box.h}
		x={box.cx + amountX}
		y={box.cy + box.h / 2}
		maxWidth={box.w}
		tint={STINGER_AMOUNT.tint}
		shadow={STINGER_AMOUNT.shadow}
	/>
</Container>
