<script lang="ts" module>
	import type { Striker, BonusHost, PayingSymbolName, Position } from '../game/types';

	export type EmitterEventMantis =
		| { type: 'mantisShow'; host: BonusHost }
		| { type: 'mantisHide' }
		| { type: 'mantisStrike'; striker: Striker; trigger: 'auto' | 'glowingLeaf'; position?: Position }
		| { type: 'mantisEat'; striker: Striker; symbol: PayingSymbolName | null; from?: Position | null };
</script>

<script lang="ts">
	// Placeholder character renderer. Real game: MantisRig.svelte (Spine, marty/marky skins) per spec §16.
	import { MainContainer } from 'components-layout';
	import { Sprite, Container } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { nextSymbolToEat } from '../game/stateGame.svelte';
	import GameText from './GameText.svelte';
	import { TIMINGS, SYMBOL_SIZE, CELL_FILL } from '../game/constants';
	import { getSymbolX, getSymbolY } from '../game/utils';
	import { MARTY, MASTER, layoutKind } from '../game/layoutSpec';

	const context = getContext();

	// Bonus mantises match the base-game Marty exactly (Corey 2026-08-26): marty stands in the SAME
	// spot/size as the MartyArt illustration he replaces; marky mirrors him across the master centre.
	const mantisPlace = () => {
		const kind = layoutKind(context.stateLayoutDerived.layoutType());
		const m = MARTY[kind];
		return { marty: { x: m.x, y: m.y }, marky: { x: MASTER[kind].width - m.x, y: m.y }, size: m.size };
	};

	let show = $state(false);
	let host = $state<BonusHost>('marty');
	let striking = $state<Striker | null>(null);
	let eating = $state<{ striker: Striker; symbol: PayingSymbolName | null } | null>(null);
	let chomp = $state(false);
	const lungeMarty = new Tween(0, { duration: TIMINGS.strike / 2, easing: cubicOut });
	const lungeMarky = new Tween(0, { duration: TIMINGS.strike / 2, easing: cubicOut });
	// eaten symbol: flies from the board centre to the striker's mouth (offsets are relative to the mantis)
	const fly = new Tween({ x: 0, y: 0, s: 1 }, { duration: Math.round(TIMINGS.eat * 0.6), easing: cubicIn });
	// Full-body placeholder art until the Spine rigs land: martyArt faces LEFT (stands on the right),
	// markyArt faces RIGHT (stands on the left) — both look toward the board. Sized in units of the
	// base-game Marty square; marky's canvas is 3:2 landscape so he keeps the same body height.
	const BODY = { marty: { w: 1, h: 1 }, marky: { w: 1.5, h: 1 } };
	const mouthOffset = (isMarty: boolean, size: number) => ({ x: isMarty ? -size * 0.15 : size * 0.22, y: isMarty ? -size * 0.3 : -size * 0.23 });
	// opening auto-bites have no board leaf, so a dinner leaf drops to the board centre carrying the
	// meal; the strike launches from it and the leaf fades away once the insect is taken
	let autoLeaf = $state<PayingSymbolName | null>(null);
	const leafDrop = new Tween(0, { duration: Math.round(TIMINGS.strike * 0.6), easing: cubicIn });
	const leafFade = new Tween(1, { duration: Math.round(TIMINGS.eat * 0.6), easing: cubicOut });

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
			striking = striker;
			const lunge = striker === 'marty' ? lungeMarty : lungeMarky;
			await lunge.set(striker === 'marty' ? -140 : 140);
			await lunge.set(0);
			striking = null;
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
				// initial scale matches the on-leaf overlay size so the pickup is seamless
				fly.set({ x: start.x - me.x, y: start.y - me.y, s: (SYMBOL_SIZE * CELL_FILL) / 90 }, { duration: 0 });
				if (autoLeaf) leafFade.set(0); // the leaf empties as the insect lifts off
				await fly.set({ ...mouthOffset(isMarty, place.size), s: 0.55 });
				chomp = true;
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
			{@const lunge = isMarty ? lungeMarty.current : lungeMarky.current}
			{@const me = isMarty ? place.marty : place.marky}
			<Container x={me.x + lunge} y={me.y}>
				<Sprite
					anchor={0.5}
					width={place.size * BODY[name].w}
					height={place.size * BODY[name].h}
					key={isMarty ? 'martyArt' : 'markyArt'}
				/>
				{#if eating?.striker === name}
					{#if eating.symbol}
						{#if !chomp}
							<Sprite anchor={0.5} x={fly.current.x} y={fly.current.y} width={90 * fly.current.s} height={90 * fly.current.s} key="{eating.symbol}_insect.png" />
						{:else}
							<GameText y={-place.size * 0.55} text="CHOMP!" preset="gold" size={36} />
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
