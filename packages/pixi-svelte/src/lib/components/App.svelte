<script lang="ts">
	import { onMount, onDestroy, type Snippet } from 'svelte';

	import { getContextApp } from '../context.svelte';

	import InitialiseApplication from './InitialiseApplication.svelte';
	import InitialiseParent from './InitialiseParent.svelte';
	import AssetsLoader from './AssetsLoader.svelte';

	type Props = {
		children: Snippet;
		/** the WebGL context's depth and stencil buffers (InitialiseApplication). Default true: Pixi's own context, as always.
		 *  false: made without them, for a game that draws no mask and no depth test (it saves their memory). */
		depthStencil?: boolean;
	};

	const props: Props = $props();
	const context = getContextApp();

	onMount(() => context.stateApp.reset());
	onDestroy(() => context.stateApp.reset());
</script>

<InitialiseApplication depthStencil={props.depthStencil}>
	<InitialiseParent>
		<AssetsLoader>
			{@render props.children()}
		</AssetsLoader>
	</InitialiseParent>
</InitialiseApplication>
