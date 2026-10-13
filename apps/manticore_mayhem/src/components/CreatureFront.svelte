<script lang="ts">
	// THE CREATURE'S PLACE IN FRONT OF THE BOARD (game/creature.ts, constants CREATURE.place.<layout>.layer 'front').
	// Mounted in components/Game.svelte straight after the MainContainer that holds the board frame, the board and the
	// board's chains, and before every other canvas layer: mount order is the z order (house rule: always mounted), so
	// what is in here is drawn over the board and under the spin total, the plaques, the win screens, the transition and
	// the canvas logo. The HTML HUD is over the whole canvas.
	// It draws nothing itself: its one container takes each courtyard scene's FRONT root (game/scene.ts SceneView.front,
	// listed in game/creature.ts creatureFront), which components/Background.svelte fits, shoves and fades exactly as it
	// does the scene's own root.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { creatureFront } from '../game/creature';

	const host = new PIXI.Container();
	host.label = 'creature-front';
	host.eventMode = 'none';
	host.interactiveChildren = false;
	// (registered first, so on unmount the scenes' roots are out of the host before pixi-svelte destroys it)
	onMount(() => {
		creatureFront.host = host;
		creatureFront.sync();
		return () => {
			if (creatureFront.host === host) creatureFront.host = null;
			host.removeChildren();
		};
	});
	getContextParent().addToParent(host);
</script>
