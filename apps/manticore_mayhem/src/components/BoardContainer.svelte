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
<!-- label 'board': BoardFrame's DEV hooks find the board container by it (the board window mask that used to
     mark it is gone: Corey 2026-10-13, "board window clip off"; only BoardCells' fall layer is cut at the window) -->
<Container
	label="board"
	x={context.stateGameDerived.boardLayout().x}
	y={context.stateGameDerived.boardLayout().y}
	pivot={context.stateGameDerived.boardLayout().pivot}
	scale={context.stateGameDerived.boardLayout().scale}
	interactiveChildren={false}
	sortableChildren={true}
>
	{@render props.children()}
</Container>
