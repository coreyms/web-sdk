<script lang="ts" module>
	import type { Striker, BonusHost, PayingSymbolName, Position } from '../game/types';

	export type EmitterEventMantis =
		| { type: 'mantisShow'; host: BonusHost }
		| { type: 'mantisHide' }
		| { type: 'mantisStrike'; striker: Striker; trigger: 'auto' | 'glowingLeaf'; position?: Position }
		| { type: 'mantisEat'; striker: Striker; symbol: PayingSymbolName | null; from?: Position | null };
</script>

<script lang="ts">
	// Bonus-session mantises on the BoneRutter rig: Marty (default art, stands right, faces left)
	// and Marky ('Marky' skin, stands left, mirrored to face right). One Strike clip carries the
	// whole strike-and-eat performance — wind-up, claw impact at RIG.strike.hitFrame, then
	// recovery/chomp playing out underneath the insect's flight to the mouth (see constants.ts).
	import { MainContainer } from 'components-layout';
	import { Sprite, Container } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { nextSymbolToEat } from '../game/stateGame.svelte';
	import GameText from './GameText.svelte';
	import { TIMINGS, SYMBOL_SIZE, CELL_FILL, RIG } from '../game/constants';
	import { getSymbolX, getSymbolY } from '../game/utils';
	import { MARTY, MASTER, layoutKind } from '../game/layoutSpec';
	import type { Rig } from '../bonerutter';
	import { rigPointInHost } from '../game/mantisRig';
	import BoneRig from './BoneRig.svelte';

	const context = getContext();

	// Bonus mantises match the base-game Marty exactly (Corey 2026-08-26): marty stands in the SAME
	// spot/size as the base-game Marty; marky mirrors him across the master centre.
	const mantisPlace = () => {
		const kind = layoutKind(context.stateLayoutDerived.layoutType());
		const m = MARTY[kind];
		return { marty: { x: m.x, y: m.y }, marky: { x: MASTER[kind].width - m.x, y: m.y }, size: m.size };
	};

	let show = $state(false);
	let host = $state<BonusHost>('marty');
	let eating = $state<{ striker: Striker; symbol: PayingSymbolName | null } | null>(null);
	let chomp = $state(false);
	let martyRig = $state<Rig | null>(null);
	let markyRig = $state<Rig | null>(null);
	// eaten symbol: flies from the leaf cell to the striker's mouth (offsets are relative to the mantis)
	const fly = new Tween({ x: 0, y: 0, s: 1 }, { duration: Math.round(TIMINGS.eat * 0.6), easing: cubicIn });
	// fallback mouth position (fractions of the placeholder body) for the frame-perfect-race case
	// where a strike lands before the rig finishes loading
	const mouthOffset = (isMarty: boolean, size: number) => ({ x: isMarty ? -size * 0.15 : size * 0.22, y: isMarty ? -size * 0.3 : -size * 0.23 });
	// opening auto-bites have no board leaf, so a dinner leaf drops to the board centre carrying the
	// meal; the strike launches from it and the leaf fades away once the insect is taken
	let autoLeaf = $state<PayingSymbolName | null>(null);
	const leafDrop = new Tween(0, { duration: Math.round(TIMINGS.strike * 0.6), easing: cubicIn });
	const leafFade = new Tween(1, { duration: Math.round(TIMINGS.eat * 0.6), easing: cubicOut });

	const rigOf = (striker: Striker) => (striker === 'marty' ? martyRig : markyRig);

	context.eventEmitter.subscribeOnMount({
		mantisShow: ({ host: h }) => {
			host = h;
			show = true;
		},
		mantisHide: () => (show = false),
		mantisStrike: async ({ striker, position }) => {
			show = true;
			if (!position) {
				// auto bite: bring the meal in on a dinner leaf before the lunge, same read as a board leaf
				const symbol = nextSymbolToEat();
				if (symbol) {
					const layout = context.stateGameDerived.boardLayout();
					autoLeaf = symbol;
					leafFade.set(1, { duration: 0 });
					leafDrop.set(-(layout.height * layout.scale) / 2 - 140, { duration: 0 });
					await leafDrop.set(0);
				}
			}
			// speed maps the claw impact onto TIMINGS.strike; the 2s recovery/chomp tail keeps
			// playing under the eat phase and hands back to idle on its own
			const rig = rigOf(striker);
			if (rig) {
				const speed = (RIG.strike.hitFrame / RIG.strike.fps) * 1000 / TIMINGS.strike;
				rig.play(RIG.strike[striker], {
					loop: false,
					speed,
					onComplete: () => rigOf(striker)?.play(RIG.idle),
				});
			}
			await waitForTimeout(TIMINGS.strike);
		},
		mantisEat: async ({ striker, symbol, from }) => {
			const place = mantisPlace();
			const layout = context.stateGameDerived.boardLayout();
			const isMarty = striker === 'marty';
			const me = isMarty ? place.marty : place.marky;
			eating = { striker, symbol };
			if (symbol) {
				// start at the dinner leaf's cell (board-local -> master via the board transform);
				// opening bites launch from the board centre, where their own leaf just dropped in
				const start = from
					? {
							x: layout.x + (getSymbolX(from.reel) - layout.width / 2) * layout.scale,
							y: layout.y + (getSymbolY(from.row) - layout.height / 2) * layout.scale,
						}
					: { x: layout.x, y: layout.y };
				const rig = rigOf(striker);
				const mouth = (rig && rigPointInHost(rig, 'Normal Mouth', !isMarty)) ?? mouthOffset(isMarty, place.size);
				// initial scale matches the on-leaf overlay size so the pickup is seamless
				fly.set({ x: start.x - me.x, y: start.y - me.y, s: (SYMBOL_SIZE * CELL_FILL) / 90 }, { duration: 0 });
				if (autoLeaf) leafFade.set(0); // the leaf empties as the insect lifts off
				await fly.set({ ...mouth, s: 0.55 });
				chomp = true; // insect vanishes into the mouth; the strike clip's chomp tail sells it
				await waitForTimeout(TIMINGS.eat * 0.5);
				chomp = false;
			} else {
				await waitForTimeout(TIMINGS.eat);
			}
			eating = null;
			autoLeaf = null;
		},
	});

	const visible = $derived.by(() => {
		if (!show) return [] as Striker[];
		if (host === 'both') return ['marty', 'marky'] as Striker[];
		return [host] as Striker[];
	});
</script>

{#if show}
	<MainContainer>
		{@const place = mantisPlace()}
		{#each visible as name (name)}
			{@const isMarty = name === 'marty'}
			{@const me = isMarty ? place.marty : place.marky}
			<Container x={me.x} y={me.y}>
				{#if isMarty}
					<BoneRig bind:rig={martyRig} size={place.size} />
				{:else}
					<BoneRig bind:rig={markyRig} size={place.size} mirror skin="Marky" />
				{/if}
				{#if eating?.striker === name}
					{#if eating.symbol}
						{#if !chomp}
							<Sprite anchor={0.5} x={fly.current.x} y={fly.current.y} width={90 * fly.current.s} height={90 * fly.current.s} key="{eating.symbol}_insect.png" />
						{/if}
					{:else}
						<GameText y={-140} text="..."  preset="silver" size={36} />
					{/if}
				{/if}
			</Container>
		{/each}
		{#if autoLeaf}
			{@const layout = context.stateGameDerived.boardLayout()}
			<!-- auto-bite dinner leaf: drops to the board centre with the insect riding it; the insect
			     hides once the eat flight takes over (which starts at this exact spot and size) -->
			<Container x={layout.x} y={layout.y + leafDrop.current} alpha={leafFade.current}>
				<Sprite anchor={0.5} width={SYMBOL_SIZE * CELL_FILL} height={SYMBOL_SIZE * CELL_FILL} key="GL.png" />
				{#if !eating}
					<Sprite anchor={0.5} width={SYMBOL_SIZE * CELL_FILL} height={SYMBOL_SIZE * CELL_FILL} key="{autoLeaf}_insect.png" />
				{/if}
			</Container>
		{/if}
	</MainContainer>
{/if}
