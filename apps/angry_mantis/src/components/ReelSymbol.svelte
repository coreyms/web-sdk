<script lang="ts">
	import Symbol from './Symbol.svelte';
	import SymbolWrap from './SymbolWrap.svelte';
	import { getSymbolInfo, getSymbolX } from '../game/utils';
	import { isAnteLockedSymbol, type ReelSymbol } from '../game/stateGame.svelte';

	type Props = {
		reelIndex: number;
		reelSymbol: ReelSymbol;
	};

	const props: Props = $props();
	const symbolInfo = $derived(
		getSymbolInfo({ rawSymbol: props.reelSymbol.rawSymbol, state: props.reelSymbol.symbolState }),
	);
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
</SymbolWrap>
