<script lang="ts">
	import type { Snippet } from 'svelte';

	import { Container } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = {
		children: Snippet;
	};

	const props: Props = $props();

	const context = getContext();
</script>

<!-- interactiveChildren=false: no symbol is pointer-interactive, so skip hit-testing this whole
     subtree on every pointer event (clicks are handled by the full-screen press overlay instead) -->
<Container
	x={context.stateGameDerived.boardLayout().x}
	y={context.stateGameDerived.boardLayout().y}
	pivot={context.stateGameDerived.boardLayout().pivot}
	scale={context.stateGameDerived.boardLayout().scale}
	interactiveChildren={false}
	sortableChildren={true}
>
	{@render props.children()}
</Container>
