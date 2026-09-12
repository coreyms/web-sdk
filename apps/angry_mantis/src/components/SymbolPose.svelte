<script lang="ts">
	// The animated face of one board cell (SYMBOL_POSES in constants.ts, game/symbolPoses.svelte.ts).
	//
	// ALWAYS MOUNTED inside ReelSymbol's squash container, invisible until a pose runs — a
	// `{#if}`-mounted Pixi node joins the stage as the LAST child and would jump above the tile's
	// own overlays (house rules, the conditional-mount z-order trap). While a pose plays the cell
	// draws plate + contact shadow + the moving insect and ReelSymbol hides the baked tile; the
	// three compose EXACTLY that baked tile on frame 0, because the builder derived the still from
	// the pose sheet's own idle frame 0 (tools/make_placeholders.py).
	//
	// Nothing here creates a texture: every frame already lives in the insect's atlas and the sprite
	// just points at a different one, driven by the single shared rAF in game/symbolPoses.
	import * as PIXI from 'pixi.js';
	import { untrack } from 'svelte';
	import { BaseSprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import type { ReelSymbol } from '../game/stateGame.svelte';
	import {
		playPose,
		poseFrames,
		poseKey,
		poseRuns,
		startAmbientPoses,
		stopPose,
	} from '../game/symbolPoses.svelte';

	type Props = {
		reelIndex: number;
		reelSymbol: ReelSymbol;
		width: number;
		height: number;
	};

	const props: Props = $props();
	const context = getContext();

	const name = $derived(props.reelSymbol.rawSymbol.name as string);
	const row = $derived(props.reelSymbol.symbolIndexOfBoard);
	const run = $derived(poseRuns[poseKey(props.reelIndex, row)]);
	const frames = $derived(run ? poseFrames(run.symbol, run.anim) : null);
	const texture = $derived(frames ? frames[Math.min(run.frame, frames.length - 1)] : null);

	const sheetTexture = (key: string): PIXI.Texture | null =>
		((context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined)?.[key] ?? null);
	// the plate and the contact shadow the insect lifts off (amSymbols, preloaded with the board)
	const plate = $derived(sheetTexture(`${name}_eaten.png`));
	const shadow = $derived(sheetTexture(`${name}_shadow.png`));
	const showing = $derived(Boolean(texture && plate));

	startAmbientPoses();

	// Win: the cell's own 'win' state drives the loop for as long as it lasts (TIMINGS.symbolWin,
	// and the scatter trigger's hold). SymbolSprite keeps running its 1.06 pulse underneath — it is
	// simply not on screen while a pose plays, so symbols WITHOUT a win pose still pulse as before
	// and the win's oncomplete chain is untouched.
	// (every playPose/stopPose call is untracked: they READ and WRITE the shared poseRuns state, and
	// an effect that subscribes to what it writes re-runs forever — house rules, Svelte 5 trap 1)
	$effect(() => {
		const win = props.reelSymbol.symbolState === 'win';
		untrack(() => (win ? playPose(props.reelIndex, row, name, 'win') : stopPose(props.reelIndex, row, 'win')));
	});

	// Eat: the board tiles do NOT cower. Only the course served front and centre plays the eat clip
	// (Mantis.svelte's hero tray, symbolPoses HERO_REEL) — the background flies just lose their
	// insect when the cell turns 'eaten', as before (Corey 2026-09-11).

	// Nothing animates on a tile in motion: the pre-spin fall-out and the empty reel end every pose
	// in the cell (a landing beat runs during 'fallingIn', so only those two clear it).
	$effect(() => {
		const motion = context.stateGame.board[props.reelIndex].reelState.motion;
		if (motion !== 'fallingOut' && motion !== 'hanging') return;
		untrack(() => {
			stopPose(props.reelIndex, row);
		});
	});

	// the cell was handed a different symbol (BoardBase's list is unkeyed) or the layer unmounted
	$effect(() => {
		void props.reelSymbol;
		const reel = props.reelIndex;
		const at = row;
		return () => {
			stopPose(reel, at);
		};
	});
</script>

<BaseSprite anchor={0.5} texture={plate ?? PIXI.Texture.EMPTY} width={props.width} height={props.height} visible={showing} />
<BaseSprite anchor={0.5} texture={shadow ?? PIXI.Texture.EMPTY} width={props.width} height={props.height} visible={showing && shadow !== null} />
<BaseSprite anchor={0.5} texture={texture ?? PIXI.Texture.EMPTY} width={props.width} height={props.height} visible={showing} />
