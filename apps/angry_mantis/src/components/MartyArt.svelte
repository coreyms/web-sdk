<script lang="ts" module>
	export type MartyReaction = 'angry' | 'celebrate' | 'poke';
	export type EmitterEventMartyArt = { type: 'martyReact'; kind: MartyReaction };
</script>

<script lang="ts">
	// Static Marty illustration (base game), bottom-right behind the controls, with placeholder
	// reactions standing in for the Spine rig's angry-* / celebrating-* / poke animations (spec §16).
	// Hidden while the bonus-session mantises (Mantis.svelte) are on stage.
	import { Sprite, Container } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { Tween } from 'svelte/motion';
	import { cubicOut, backOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { MARTY, layoutKind } from '../game/layoutSpec';

	const context = getContext();
	const place = $derived(MARTY[layoutKind(context.stateLayoutDerived.layoutType())]);
	const show = $derived(context.stateGame.gameType === 'basegame');

	const rot = new Tween(0, { duration: 90 });
	const scale = new Tween(1, { duration: 160, easing: cubicOut });
	const hop = new Tween(0, { duration: 220, easing: backOut });
	let busy = false;

	const react = async (kind: MartyReaction) => {
		if (busy || !show) return;
		busy = true;
		if (kind === 'angry') {
			// head-shake: quick alternating tilt
			for (const r of [-0.08, 0.08, -0.06, 0.06, 0]) await rot.set(r);
		} else if (kind === 'celebrate') {
			for (let i = 0; i < 2; i++) {
				await hop.set(-26);
				await hop.set(0, { easing: cubicOut });
			}
			await scale.set(1.06);
			await scale.set(1);
		} else if (kind === 'poke') {
			await scale.set(0.95, { duration: 70 });
			await rot.set(-0.05);
			await rot.set(0.03);
			await rot.set(0);
			await scale.set(1, { duration: 140, easing: backOut });
		}
		busy = false;
	};

	context.eventEmitter.subscribeOnMount({ martyReact: ({ kind }) => react(kind) });
	const poke = () => {
		if (!context.stateXstateDerived.isIdle()) return;
		react('poke');
	};
</script>

<FadeContainer {show} duration={400}>
	<Container x={place.x} y={place.y + hop.current} rotation={rot.current} scale={scale.current}>
		<Sprite key="martyArt" anchor={0.5} width={place.size} height={place.size} eventMode={context.stateXstateDerived.isIdle() ? 'static' : 'none'} cursor="pointer" onpointerup={poke} />
	</Container>
</FadeContainer>
