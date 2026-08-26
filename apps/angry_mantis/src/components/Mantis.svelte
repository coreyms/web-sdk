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
	import GameText from './GameText.svelte';
	import { TIMINGS, SYMBOL_SIZE, CELL_FILL } from '../game/constants';
	import { getSymbolX, getSymbolY } from '../game/utils';
	import { HUD, layoutKind } from '../game/layoutSpec';

	const context = getContext();

	let show = $state(false);
	let host = $state<BonusHost>('marty');
	let striking = $state<Striker | null>(null);
	let eating = $state<{ striker: Striker; symbol: PayingSymbolName | null } | null>(null);
	let chomp = $state(false);
	const lungeMarty = new Tween(0, { duration: TIMINGS.strike / 2, easing: cubicOut });
	const lungeMarky = new Tween(0, { duration: TIMINGS.strike / 2, easing: cubicOut });
	// eaten symbol: flies from the board centre to the striker's mouth (offsets are relative to the mantis)
	const fly = new Tween({ x: 0, y: 0, s: 1 }, { duration: Math.round(TIMINGS.eat * 0.6), easing: cubicIn });
	const mouthOffset = (isMarty: boolean, size: number) => ({ x: isMarty ? -size * 0.35 : size * 0.35, y: -size * 0.25 });

	context.eventEmitter.subscribeOnMount({
		mantisShow: ({ host: h }) => {
			host = h;
			show = true;
		},
		mantisHide: () => (show = false),
		mantisStrike: async ({ striker }) => {
			show = true;
			striking = striker;
			const lunge = striker === 'marty' ? lungeMarty : lungeMarky;
			await lunge.set(striker === 'marty' ? -140 : 140);
			await lunge.set(0);
			striking = null;
		},
		mantisEat: async ({ striker, symbol, from }) => {
			const hud = HUD[layoutKind(context.stateLayoutDerived.layoutType())].mantis;
			const layout = context.stateGameDerived.boardLayout();
			const isMarty = striker === 'marty';
			const me = isMarty ? hud.marty : hud.marky;
			eating = { striker, symbol };
			if (symbol) {
				// start at the glowing leaf's cell (board-local -> master via the board transform);
				// opening bites have no leaf, so they launch from the board centre as before
				const start = from
					? {
							x: layout.x + (getSymbolX(from.reel) - layout.width / 2) * layout.scale,
							y: layout.y + (getSymbolY(from.row) - layout.height / 2) * layout.scale,
						}
					: { x: layout.x, y: layout.y };
				// initial scale matches the on-leaf overlay size so the pickup is seamless
				fly.set({ x: start.x - me.x, y: start.y - me.y, s: (SYMBOL_SIZE * CELL_FILL) / 90 }, { duration: 0 });
				await fly.set({ ...mouthOffset(isMarty, hud.size), s: 0.55 });
				chomp = true;
				await waitForTimeout(TIMINGS.eat * 0.5);
				chomp = false;
			} else {
				await waitForTimeout(TIMINGS.eat);
			}
			eating = null;
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
		{@const hud = HUD[layoutKind(context.stateLayoutDerived.layoutType())].mantis}
		{@const leftX = hud.marky.x}
		{@const rightX = hud.marty.x}
		{#each visible as name (name)}
			{@const isMarty = name === 'marty'}
			{@const lunge = isMarty ? lungeMarty.current : lungeMarky.current}
			<Container x={(isMarty ? rightX : leftX) + lunge} y={isMarty ? hud.marty.y : hud.marky.y}>
				<Sprite
					anchor={0.5}
					width={hud.size}
					height={hud.size}
					key={striking === name ? `${name}_strike.png` : `${name}_idle.png`}
				/>
				{#if eating?.striker === name}
					{#if eating.symbol}
						{#if !chomp}
							<Sprite anchor={0.5} x={fly.current.x} y={fly.current.y} width={90 * fly.current.s} height={90 * fly.current.s} key="{eating.symbol}_insect.png" />
						{:else}
							<GameText y={-hud.size * 0.7} text="CHOMP!" preset="gold" size={36} />
						{/if}
					{:else}
						<GameText y={-140} text="..."  preset="silver" size={36} />
					{/if}
				{/if}
			</Container>
		{/each}
	</MainContainer>
{/if}
