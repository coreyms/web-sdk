<script lang="ts">
	// Cafeteria backdrops (cover-fit) under a dark wash so the board and chrome read on top.
	// TWO RENDERS PER SCENE: the lit room and — where Corey has delivered it — the same room with
	// the lamps off (tools/build_lights_off.py). base/ante/regular bonus share the base scene; super
	// and feast get their own. Which layer is up is not a state flag but a set of alphas owned by
	// game/lightsCut.svelte.ts: the "lamps out, lamps on" mode transition (LIGHTS_CUT) fades the lit
	// layer off its own dark render, crosses dark-to-dark for the world change, then stutters the new
	// room's lit layer back in. Everything here is alpha and zIndex on static sprites.
	// zIndex ladder (lightsCut's rule: the layer underneath is always opaque, only the top one
	// animates): the scene the game is switching TO sits above the one it is leaving, and inside a
	// scene the lit render sits above its own off render. All of it stays between AmbientFly's
	// behind-the-glass slot (−2.2) and AmbientLights (−1.9).
	import { untrack } from 'svelte';
	import { Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { BACKGROUND_WASH } from '../game/constants';
	import { BACKDROP, FAN } from '../game/ambientSpec';
	import { LIT_KEY, SCENES, lightsState, lightsSyncScene, offKeyOf, skyAlpha, washExtra } from '../game/lightsCut.svelte';
	import AmbientFan from './AmbientFan.svelte';
	import AmbientSky from './AmbientSky.svelte';
	import AmbientRoaches from './AmbientRoaches.svelte';
	import AmbientFly from './AmbientFly.svelte';
	import AmbientLights from './AmbientLights.svelte';

	const context = getContext();
	const IMAGE_RATIO = 1920 / 1080;
	const ROOM_Z = -2.05; // the four hundredths above it are the room stack

	const cover = $derived.by(() => {
		const { width, height } = context.stateLayoutDerived.canvasSizes();
		const canvasRatio = width / height;
		return canvasRatio > IMAGE_RATIO
			? { width, height: width / IMAGE_RATIO }
			: { width: height * IMAGE_RATIO, height };
	});
	const backdropScale = $derived(cover.width / BACKDROP.w); // backdrop px → canvas px
	const freegame = $derived(context.stateGame.gameType === 'freegame');
	const scene = $derived(context.stateGame.scene);
	const sceneIndex = $derived(SCENES.indexOf(scene));

	// a texture that has not landed yet draws as Texture.EMPTY and logs — the off renders and the
	// super/feast rooms are deferred assets (bonusStart awaits assetGate before the cut starts)
	const ready = (key: string) => !!(context.stateApp.loadedAssets as Record<string, unknown> | undefined)?.[key];

	// one entry per room layer that should be on the stage right now. A layer whose alpha is 0 stays
	// mounted for the duration of a cut so the restrike's zero steps do not churn Pixi nodes.
	const layers = $derived(
		SCENES.flatMap((s) => {
			const z = ROOM_Z + (s === scene ? 0.01 : 0);
			const off = offKeyOf(s);
			return [
				{ key: LIT_KEY[s], alpha: lightsState.lit[s], z: z + 0.005 },
				...(off ? [{ key: off, alpha: lightsState.dark[s], z }] : []),
			];
		}).filter((layer) => layer.alpha > 0 || (lightsState.active && ready(layer.key))),
	);

	$effect(() => {
		// no-cut paths only (a replay or resume that lands straight in a room); the cut owns the
		// alphas while it runs. untrack: this writes the state the layers read, never reads it here.
		const target = scene;
		untrack(() => lightsSyncScene(target));
	});
</script>

<Rectangle {...context.stateLayoutDerived.canvasSizes()} backgroundColor={0x06120a} zIndex={-3} />

<!-- sky + bonus clouds, UNDER the rooms: the room art's panes are cut to alpha (the off renders get
     the lit render's alpha copied onto them by the tool), so this layer shows only through the
     glass. A scene's sky carries the SUM of its two room alphas, so it holds still through
     lamps-out and the restrike and crossfades only during the world change — each render's window
     bars are lit for its own sky, so the two must never drift apart. -->
<AmbientSky
	x={context.stateLayoutDerived.canvasSizes().width / 2 - (BACKDROP.w / 2) * backdropScale}
	y={context.stateLayoutDerived.canvasSizes().height / 2 - (BACKDROP.h / 2) * backdropScale}
	scale={backdropScale}
	alphas={SCENES.map((s) => skyAlpha(s))}
	top={sceneIndex}
	zIndex={-2.5}
/>

{#each layers as layer (layer.key)}
	<Sprite
		key={layer.key}
		anchor={0.5}
		x={context.stateLayoutDerived.canvasSizes().width / 2}
		y={context.stateLayoutDerived.canvasSizes().height / 2}
		width={cover.width}
		height={cover.height}
		alpha={layer.alpha}
		visible={layer.alpha > 0}
		zIndex={layer.z}
	/>
{/each}

<!-- ambient layer, between the base backdrop and the wash: authored in backdrop px (ambientSpec.ts),
     mapped through the same cover fit as the backdrop sprite. Only the base scene has the fan housing.
     Keyed to the base room's LIT alpha: the blades belong to the lit render, so they leave with the
     lamps and come back with the restrike. -->
<AmbientFan
	x={context.stateLayoutDerived.canvasSizes().width / 2 + (FAN.hub.x - BACKDROP.w / 2) * backdropScale}
	y={context.stateLayoutDerived.canvasSizes().height / 2 + (FAN.hub.y - BACKDROP.h / 2) * backdropScale}
	scale={backdropScale}
	alpha={lightsState.lit.base}
	visible={lightsState.lit.base > 0}
	zIndex={-1.5}
/>

<!-- lamp flicker: "off" patches over the lit room, under the fan (the hanging lamp's patch covers
     the fan housing). Base LIT alpha only — a lamp cannot flicker while the breaker is off. -->
<AmbientLights
	x={context.stateLayoutDerived.canvasSizes().width / 2 - (BACKDROP.w / 2) * backdropScale}
	y={context.stateLayoutDerived.canvasSizes().height / 2 - (BACKDROP.h / 2) * backdropScale}
	scale={backdropScale}
	alpha={lightsState.lit.base}
	visible={lightsState.lit.base > 0}
	zIndex={-1.9}
/>

<!-- floor cockroaches in EVERY scene (Corey 2026-09-08: they stay through bonus / super / feast —
     the three rooms share the floor): over the room, under the wash (backdrop px like the fan) -->
<AmbientRoaches
	x={context.stateLayoutDerived.canvasSizes().width / 2 - (BACKDROP.w / 2) * backdropScale}
	y={context.stateLayoutDerived.canvasSizes().height / 2 - (BACKDROP.h / 2) * backdropScale}
	scale={backdropScale}
	zIndex={-1.4}
/>

<!-- the housefly: in the air it draws over the room (zFront); inside the window it drops between
     the sky and the room (zBehind) so only the glass shows it -->
<AmbientFly
	x={context.stateLayoutDerived.canvasSizes().width / 2 - (BACKDROP.w / 2) * backdropScale}
	y={context.stateLayoutDerived.canvasSizes().height / 2 - (BACKDROP.h / 2) * backdropScale}
	scale={backdropScale}
	alpha={lightsState.lit.base}
	visible={lightsState.lit.base > 0}
	zFront={-1.3}
	zBehind={-2.2}
/>

<!-- dark wash so board/chrome contrast holds on the busier cafeteria art; a touch darker in free
     spins (levels in BACKGROUND_WASH) and deeper again while the lamps are out (LIGHTS_CUT.washExtra),
     so the door and the rigs go down with the room instead of staying lit in a dark cafeteria -->
<Rectangle
	{...context.stateLayoutDerived.canvasSizes()}
	backgroundColor={0x060c06}
	alpha={(freegame ? BACKGROUND_WASH.freegame : BACKGROUND_WASH.base) + washExtra()}
	zIndex={-1}
/>
