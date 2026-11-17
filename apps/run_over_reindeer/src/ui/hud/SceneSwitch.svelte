<script lang="ts">
	// THE SCENE SWITCH (dark mode, 2026-11-17; game/sceneChoice.ts): "Scene", Auto, Snow or Dark. One row of the help menu
	// (ui/hud/HudMenuPanel.svelte, between GAME INFO and the sliders) and the same row on the press screen
	// (ui/LandingScreen.svelte, in a menu panel's glass). Drawn with the menu's own parts (hud.css): the small spaced word
	// (.vt) over a row of three glass keys (.gl), the picked one lit as the open Menu key is. A press sets the choice at once
	// (remembered on the device); the scene follows when the board is at rest (components/Board.svelte takeSceneSet).
	// (the HUD's look is imported here too: the press screen mounts the switch before the HUD)
	import '../hudTheme';
	import './hud.css';
	import { SCENE_CHOICES, type SceneChoice } from '../../game/sceneChoice';
	import { setSceneChoice, stateScene } from '../../game/stateScene.svelte';

	type Props = { cls?: string };
	const { cls = '' }: Props = $props();
	const LABEL: Record<SceneChoice, string> = { auto: 'Auto', snow: 'Snow', dark: 'Dark' };
</script>

<div class="scn {cls}" role="radiogroup" aria-label="Scene" data-scene-switch>
	<span class="vt">Scene</span>
	<div class="seg">
		{#each SCENE_CHOICES as c (c)}
			<button type="button" class="slot-btn hg gl sco" class:is-on={stateScene.choice === c} role="radio" aria-checked={stateScene.choice === c} data-scene-choice={c} onclick={() => setSceneChoice(c)}>{LABEL[c]}</button>
		{/each}
	</div>
</div>
