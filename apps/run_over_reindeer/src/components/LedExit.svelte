<script lang="ts">
	// THE PRESS ON THE LED BILLBOARD (game/landing/ledSign.ts): the sign powers down (components/Board.svelte plays it);
	// when its dots are out the game's chrome comes up (oncomplete), and the sign sinks away and is unloaded after.
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';

	type Props = { oncomplete: () => void };
	const props: Props = $props();
	const context = getContext();

	onMount(async () => {
		await context.eventEmitter.broadcastAsync({ type: 'boardLandingPress' });
		props.oncomplete();
	});
</script>
