<script lang="ts">
	// SKIP TO RESULT. A Pixi-side plate in the feature layer (the HTML chrome is the standard Angry
	// Mantis HUD and does not change), placed from the HUD.skipButton slot like PressToContinue is from
	// its own, in the mode plaque's family: the same dark plate, the same stencil glyphs, a hairline
	// edge and a top highlight for the glass. Modest on purpose: it must not fight the board.
	//
	// Up only while a feature's spins are playing: gameType 'freegame', the first free spin's reveal
	// has begun (fs >= 1, bonusStart zeroes it), no plaque, no press gate, not already skipping. That
	// hides it through the bonusStart transition / plaque, the wrap-up (freeSpinEnd flips gameType
	// first) and the base game. Pressing it is stateGameDerived.requestSkip() and nothing else; the
	// button goes down because `skipping` is now true. Touch and pointer only, no hotkey.
	//
	// House rules: always mounted (visibility by alpha, never {#if} around the MainContainer), no
	// filters, every tunable from layoutSpec / constants, SteadyTween (svelte/motion's leaks a task).
	import { Rectangle } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { cubicOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { featureSpinsLive } from '../game/stateGame.svelte';
	import { HUD, layoutKind } from '../game/layoutSpec';
	import { SKIP_BUTTON } from '../game/constants';
	import { SteadyTween as Tween } from '../game/tween.svelte';
	import ArtAmount from './ArtAmount.svelte';

	const context = getContext();
	const sg = context.stateGame;
	const slot = $derived(HUD[layoutKind(context.stateLayoutDerived.layoutType())].skipButton);

	const up = $derived(featureSpinsLive() && !sg.skipping && sg.fs >= 1 && !sg.plaque && sg.pressGates === 0 && !sg.winShowing);
	const alpha = new Tween(0, { easing: cubicOut });
	$effect(() => {
		void alpha.set(up ? 1 : 0, { duration: up ? SKIP_BUTTON.inMs : SKIP_BUTTON.outMs });
	});

	let pressed = $state(false);
	const press = () => {
		pressed = false;
		if (!up) return;
		if (context.stateGameDerived.requestSkip()) context.eventEmitter.broadcast({ type: 'soundPressMinor' });
	};

	// the plate sits inside the hit area, centred; the hit area itself is the touch target
	const plateH = $derived(Math.min(SKIP_BUTTON.plateHeight, slot.height));
	const px = $derived(slot.x + SKIP_BUTTON.plateInset);
	const py = $derived(slot.y + (slot.height - plateH) / 2);
	const pw = $derived(slot.width - SKIP_BUTTON.plateInset * 2);
	const cx = $derived(slot.x + slot.width / 2);
	const cy = $derived(slot.y + slot.height / 2);
	const textH = $derived(plateH * SKIP_BUTTON.textShare);
	const a = $derived(alpha.current * (pressed ? SKIP_BUTTON.pressedAlpha : 1));
</script>

<MainContainer>
	{#if alpha.current > 0}
		<Rectangle x={px} y={py} width={pw} height={plateH} borderRadius={SKIP_BUTTON.radius} backgroundColor={SKIP_BUTTON.plateColor} alpha={a * SKIP_BUTTON.plateAlpha} borderColor={SKIP_BUTTON.edgeColor} borderWidth={1.5} borderAlpha={SKIP_BUTTON.edgeAlpha} />
		<!-- the glass: a thin highlight along the top edge -->
		<Rectangle x={px + SKIP_BUTTON.radius} y={py + 1.5} width={pw - SKIP_BUTTON.radius * 2} height={1.5} backgroundColor={0xffffff} alpha={a * SKIP_BUTTON.highlightAlpha} />
		<ArtAmount text="SKIP TO RESULT" height={textH} x={cx} y={cy + textH / 2 - 1} maxWidth={pw * 0.88} alpha={a} tint={SKIP_BUTTON.textTint} />
		<!-- the hit area: the whole slot, touch and pointer only -->
		<Rectangle
			x={slot.x}
			y={slot.y}
			width={slot.width}
			height={slot.height}
			backgroundColor={0xffffff}
			alpha={0.001}
			eventMode={up ? 'static' : 'none'}
			cursor="pointer"
			onpointerdown={() => (pressed = true)}
			onpointerupoutside={() => (pressed = false)}
			onpointerup={press}
		/>
	{/if}
</MainContainer>
