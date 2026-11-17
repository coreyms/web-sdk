<script lang="ts">
	// THE TOP LINE (the clock, the game's name, POLYMATH GAMES): DOM text. Its ink and halo are the scene preset's
	// (game/scenePresets.ts topText, scene pass 9): black on the snow, white with a dark halo over an upright phone's
	// forest (`forest`). The halo is CSS text-shadow on the DOM text, no filter.
	import { onMount } from 'svelte';
	import { stateScene } from '../game/stateScene.svelte';

	type Props = { side: 'left' | 'right'; text?: string; clock?: boolean; forest?: boolean };
	const { side, text = '', clock = false, forest = false }: Props = $props();
	const tone = $derived(forest && stateScene.preset.forest ? stateScene.preset.topText.forest : stateScene.preset.topText.scene);

	let now = $state(new Date());
	onMount(() => {
		const id = setInterval(() => (now = new Date()), 30000);
		return () => clearInterval(id);
	});
	const hhmm = $derived(`${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`);
</script>

<div class="strip" data-top-line style:color={tone.ink} style:text-shadow={tone.halo} style:left={side === 'left' ? '14px' : 'auto'} style:right={side === 'right' ? '14px' : 'auto'}>
	{#if clock}{hhmm}&nbsp;&nbsp;&nbsp;{/if}{text}
</div>

<style>
	/* --vp-extra-top (ui/Chrome.svelte): the letterbox over the master on a desktop screen narrower than 16:9 (layoutSpec
	   LANDSCAPE_TALL), so the strip is at the screen's top edge there too; 0 in every other case */
	.strip {
		position: absolute;
		top: calc(10px - var(--vp-extra-top, 0px));
		font-family: var(--ui-font);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 1.5px;
		text-transform: uppercase;
		pointer-events: none;
		white-space: pre;
		z-index: 10;
	}
	/* THE SCENE SWAP (game/stateScene.svelte.ts setScenePreset): the ink and the halo change with the scene's cross-fade */
	:global(:root[data-scene-fade]) .strip {
		transition:
			color var(--scene-fade-ms, 400ms) linear,
			text-shadow var(--scene-fade-ms, 400ms) linear;
	}
</style>
