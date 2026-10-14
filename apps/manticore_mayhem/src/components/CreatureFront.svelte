<script lang="ts">
	// THE CREATURE'S TWO PLACES ON THE STAGE (game/creature.ts creatureFront, constants CREATURE.place.<layout>.layer).
	// Mounted TWICE in components/Game.svelte (mount order is the z order, house rule: always mounted):
	//   layer="behind"  straight after the canvas logo and before the MainContainer that holds the board frame, the
	//                   board and the board's chains: over the scene and the logo, under the board
	//   layer="front"   straight after that MainContainer and before every other canvas layer: over the board, under
	//                   the spin total, the plaques, the win screens and the transition
	// The HTML HUD is over the whole canvas.
	// It draws nothing itself: its one container takes each courtyard scene's twin root (game/scene.ts SceneView.front,
	// listed in creatureFront.roots) while the current spot's layer is its own; components/Background.svelte fits,
	// shoves and fades that root exactly as it does the scene's own root.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { creatureFront, type CreatureLayer } from '../game/creature';

	type Props = { layer: CreatureLayer };
	const { layer }: Props = $props();

	const host = new PIXI.Container();
	host.label = `creature-${layer}`;
	host.eventMode = 'none';
	host.interactiveChildren = false;
	// (registered first, so on unmount the scenes' roots are out of the host before pixi-svelte destroys it)
	onMount(() => {
		creatureFront.hosts[layer] = host;
		creatureFront.sync();
		return () => {
			if (creatureFront.hosts[layer] === host) creatureFront.hosts[layer] = null;
			host.removeChildren();
		};
	});
	getContextParent().addToParent(host);
</script>
