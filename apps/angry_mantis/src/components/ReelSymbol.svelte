<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	import Symbol from './Symbol.svelte';
	import SymbolWrap from './SymbolWrap.svelte';
	import { getSymbolInfo, getSymbolX } from '../game/utils';
	import { SYMBOL_SIZE, CELL_FILL } from '../game/constants';
	import { isAnteLockedSymbol, upcomingEats, stateGame, type ReelSymbol } from '../game/stateGame.svelte';

	type Props = {
		reelIndex: number;
		reelSymbol: ReelSymbol;
	};

	const props: Props = $props();
	const symbolInfo = $derived(
		getSymbolInfo({ rawSymbol: props.reelSymbol.rawSymbol, state: props.reelSymbol.symbolState }),
	);

	// dinner leaf carries the insect ITS strike will eat (cascades in with it). Leaves are struck in
	// reel-major order, so the k-th unstruck leaf of this board shows the k-th symbol still in the eat
	// order — two leaves never preview the same meal. Hidden again once this leaf's strike has fed
	// the mantis (the struck cell goes back to a bare leaf).
	const insectOnLeaf = $derived.by(() => {
		if (props.reelSymbol.rawSymbol.name !== 'GL' || stateGame.gameType === 'basegame') return null;
		const unstruck = stateGame.leafOrder.filter(
			(pos) => !stateGame.consumedLeaves.some((c) => c.reel === pos.reel && c.row === pos.row),
		);
		const index = unstruck.findIndex(
			(pos) => pos.reel === props.reelIndex && pos.row === props.reelSymbol.symbolIndexOfBoard,
		);
		return index === -1 ? null : (upcomingEats()[index] ?? null);
	});
</script>

<!-- the ante-locked scatter draws above its reel's cascading symbols (they fall behind it) -->
<SymbolWrap
	x={getSymbolX(props.reelIndex)}
	y={props.reelSymbol.symbolY.current}
	zIndex={isAnteLockedSymbol(props.reelIndex, props.reelSymbol.symbolIndexOfBoard) ? 10 : 0}
	animating={props.reelSymbol.symbolState === 'win'}
>
	<Symbol
		state={props.reelSymbol.symbolState}
		rawSymbol={props.reelSymbol.rawSymbol}
		oncomplete={() => {
			if (props.reelSymbol.symbolState === 'win') props.reelSymbol.oncomplete();
			if (props.reelSymbol.symbolState === 'land') props.reelSymbol.symbolState = 'static';
		}}
	/>
	{#if insectOnLeaf}
		<Sprite anchor={0.5} key="{insectOnLeaf}_insect.png" width={SYMBOL_SIZE * CELL_FILL} height={SYMBOL_SIZE * CELL_FILL} />
	{/if}
</SymbolWrap>
