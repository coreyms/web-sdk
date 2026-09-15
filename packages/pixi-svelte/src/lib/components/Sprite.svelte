<script lang="ts" module>
	import * as PIXI from 'pixi.js';

	import { type Props as BaseProps } from './BaseSprite.svelte';

	export type Props = Omit<BaseProps, 'texture'> & {
		debug?: boolean;
		key: string;
	};
</script>

<script lang="ts">
	import BaseSprite from './BaseSprite.svelte';
	import { getContextApp } from '../context.svelte';
	import type { LoadedSprite } from '../types';

	const { debug, key, ...baseSpriteProps }: Props = $props();
	const context = getContextApp();
	const texture = $derived(
		(context.stateApp.loadedAssets?.[key] || PIXI.Texture.EMPTY) as LoadedSprite,
	);
</script>

<!-- a key that is still in the deferred load phase resolves itself when that phase lands (the
     texture is derived from loadedAssets), so only a miss AFTER the whole manifest is in is a bug
     worth a console error — a replay mounts its scene while the deferred atlases are still on the
     wire and used to log ten of these at boot (2026-09-15) -->
{#if (texture === PIXI.Texture.EMPTY && context.stateApp.loaded) || debug}
	{console.error(`Sprite: key "${key}" is not found in the loadedAssets`)}
	{console.log('loadedAssets', $state.snapshot(context.stateApp).loadedAssets)}
{/if}

<BaseSprite {...baseSpriteProps} {texture} />
