<script lang="ts" module>
	import type { Position } from '../game/types';

	// `text` overrides the formatted amount — used for the per-scatter '+1 SPIN' retrigger floaters
	export type EmitterEventComboWin =
		| { type: 'comboWinShow'; amount: number; text?: undefined; positions: Position[] }
		| { type: 'comboWinShow'; amount?: undefined; text: string; positions: Position[] };
</script>

<script lang="ts">
	// Per-combo win amounts as concurrent damage floaters (Mother Clucker study, Corey 2026-08-30):
	// each amount pops in AT the cluster — centered on the cluster's own footprint, overlapping the
	// lit tiles, never lifted above them — then slowly grows, drifts upward and fades over ~1.3s.
	// Several floaters coexist; the emitter handler returns immediately so combos never serialize.
	// Floaters deliberately outlive winInfo, riding through the strike/eat choreography the way
	// tumble games let win numbers ride the cascade.
	import { Tween } from 'svelte/motion';
	import { backOut, linear } from 'svelte/easing';
	import { Container } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { stateBetDerived } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { getSymbolX, getSymbolY } from '../game/utils';
	import { SYMBOL_SIZE } from '../game/constants';
	import GameText from './GameText.svelte';
	import ArtAmount, { artAmountSupports } from './ArtAmount.svelte';

	const context = getContext();

	type Floater = { id: number; text: string; x: number; y: number; pop: Tween<number>; age: Tween<number> };
	let floaters = $state<Floater[]>([]);
	let nextId = 0;

	const LIFETIME = 1300; // pop → grow/drift → gone
	const DRIFT = 42; // master px of upward travel over the lifetime
	const GROW = 0.09; // late-life scale gain — mirrors the reference's slow swell

	context.eventEmitter.subscribeOnMount({
		comboWinShow: (emitterEvent) => {
			const layout = context.stateGameDerived.boardLayout();
			// positions are symbols[] index space (padded rows): board row = row - 1
			const pts = emitterEvent.positions.map((p) => ({
				x: getSymbolX(p.reel),
				y: getSymbolY(p.row - 1),
			}));
			// cluster centroid, clamped inside the board — the number OVERLAPS the winning tiles
			const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
			const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
			const bx = Math.max(SYMBOL_SIZE, Math.min(layout.width - SYMBOL_SIZE, cx));
			const by = Math.max(SYMBOL_SIZE * 0.5, Math.min(layout.height - SYMBOL_SIZE * 0.5, cy));
			const speed = stateBetDerived.timeScale();
			const fx = layout.x + (bx - layout.width / 2) * layout.scale;
			let fy = layout.y + (by - layout.height / 2) * layout.scale;
			// two combos can share nearly the same centroid (e.g. stacked ways wins) — if a live
			// floater already occupies this spot, step down half a cell until clear. The older one
			// is drifting upward, so the pair separates immediately.
			const cell = SYMBOL_SIZE * layout.scale;
			const boardBottom = layout.y + (layout.height / 2 - SYMBOL_SIZE * 0.4) * layout.scale;
			const clashes = (yy: number) =>
				floaters.some(
					(o) => Math.abs(o.x - fx) < cell * 1.7 && Math.abs(o.y - o.age.current * DRIFT - yy) < cell * 0.45,
				);
			let guard = 0;
			while (clashes(fy) && guard++ < 8) fy += cell * 0.5;
			if (fy > boardBottom) fy = boardBottom;
			const f: Floater = {
				id: nextId++,
				text: emitterEvent.text !== undefined ? emitterEvent.text : bookEventAmountToCurrencyString(emitterEvent.amount),
				x: fx,
				y: fy,
				pop: new Tween(0, { duration: 90 / speed, easing: backOut }),
				age: new Tween(0, { duration: LIFETIME / speed, easing: linear }),
			};
			floaters.push(f);
			f.pop.set(1);
			f.age.set(1).then(() => {
				floaters = floaters.filter((o) => o.id !== f.id);
			});
		},
	});

	// fully opaque until 65% of life, then fade out
	const alphaOf = (age: number) => (age < 0.65 ? 1 : Math.max(0, 1 - (age - 0.65) / 0.35));
</script>

<!-- ONE always-mounted MainContainer with the {#each} inside: a per-floater MainContainer
     created inside the each block never renders (pixi-svelte addToParent/onMount quirk) -->
<MainContainer>
	{#each floaters as f (f.id)}
		<Container
			x={f.x}
			y={f.y - f.age.current * DRIFT}
			alpha={alphaOf(f.age.current)}
			scale={f.pop.current * (1 + f.age.current * GROW) * context.stateGameDerived.boardLayout().scale}
		>
			{#if artAmountSupports(f.text)}
				<ArtAmount text={f.text} height={SYMBOL_SIZE * 0.25} maxWidth={SYMBOL_SIZE * 3.4} />
			{:else}
				<GameText text={f.text} preset="silver" size={SYMBOL_SIZE * 0.25} maxWidth={SYMBOL_SIZE * 3.4} />
			{/if}
		</Container>
	{/each}
</MainContainer>
