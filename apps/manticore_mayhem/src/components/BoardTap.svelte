<script lang="ts">
	// THE BOARD'S TAP AREA (2026-10-13; Corey: "touching the board during anticipation should end the anticipation
	// and/or rapidly speed it up the spin through clusters"). Mounted in the MainContainer straight after the board
	// (components/Game.svelte). It draws nothing: one empty container whose hitArea is the board's 8 x 8 opening, in
	// the MainContainer's master units like the board itself. A tap or click on it goes to game/boardTap.ts
	// routeBoardTap (the creature's hit test first, then the board), which broadcasts `boardTap`;
	// ui/controls.svelte.ts decides whether a live spin is hurried (the Spin press's own slam stop).
	// The press gates' full screen rectangle and every HTML control are over it and take their own presses first.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { BOARD_SIZES } from '../game/constants';
	import { boardOpening, boardTapLog, routeBoardTap } from '../game/boardTap';

	const context = getContext();
	const area = new PIXI.Container();
	const rect = new PIXI.Rectangle();
	area.label = 'board-tap';
	area.eventMode = 'static';
	area.interactiveChildren = false;
	area.hitArea = rect;
	const hurry = () => context.eventEmitter.broadcast({ type: 'boardTap' });
	area.onpointertap = (event: PIXI.FederatedPointerEvent) => {
		routeBoardTap(event.global.x, event.global.y, hurry);
	};
	// the opening: the board container is centred on boardLayout().x / y at boardLayout().scale
	$effect(() => {
		const b = context.stateGameDerived.boardLayout();
		const w = BOARD_SIZES.width * b.scale;
		const h = BOARD_SIZES.height * b.scale;
		rect.x = b.x - w / 2;
		rect.y = b.y - h / 2;
		rect.width = w;
		rect.height = h;
	});
	// the creature's poke area asks this, so a tap on the opening is never his (game/creature.ts)
	const local = new PIXI.Point();
	boardOpening.contains = (x, y) => {
		if (!area.parent) return false;
		area.toLocal({ x, y }, undefined, local);
		return rect.contains(local.x, local.y);
	};
	onMount(() => {
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			// tools/manticore/skip_probe.js: where the area is on the canvas (CSS px of the canvas), and what was routed
			((window as any).__manticore ??= {}).boardTap = {
				rect: () => {
					const a = area.toGlobal({ x: rect.x, y: rect.y });
					const b = area.toGlobal({ x: rect.x + rect.width, y: rect.y + rect.height });
					return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
				},
				log: () => boardTapLog.map((e) => ({ ...e })),
				hurryLevel: () => context.stateGame.hurryLevel,
				timeScale: () => context.stateGameDerived.timeScale(),
			};
		}
		return () => {
			area.onpointertap = null;
			boardOpening.contains = () => false;
			if (import.meta.env.DEV && typeof window !== 'undefined') delete (window as any).__manticore?.boardTap;
		};
	});
	getContextParent().addToParent(area);
</script>
