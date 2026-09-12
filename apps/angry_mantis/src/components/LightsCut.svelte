<script lang="ts" module>
	export type EmitterEventLightsCut =
		| { type: 'lightsOut' } // lamps out on the current room, then a beat (await: dim and held)
		| { type: 'lightsSwitch' } // the world changes in the dark, then a beat (await: new room dim)
		| { type: 'lightsOn' }; // the new room's tubes restrike (await: fully lit)
</script>

<script lang="ts">
	// Event wiring only. The "lamps out, lamps on" transition (LIGHTS_CUT, constants.ts) is played
	// by game/lightsCut.svelte.ts and drawn by Background.svelte — nothing is drawn here: the first
	// cut covered the canvas with a black rectangle and read as a dropped frame, so the sequence is
	// now crossfades between the lit and lamps-off renders of the same room, with the door, the
	// board and the rigs staying on screen the whole way through.
	// This component exists because the book event handlers speak in emitter events and
	// subscribeOnMount needs a component; it awaits the module's three steps in order.
	import { getContext } from '../game/context';
	import { lightsOn, lightsOut, lightsSwitch } from '../game/lightsCut.svelte';

	const context = getContext();

	context.eventEmitter.subscribeOnMount({
		lightsOut: () => lightsOut(),
		lightsSwitch: () => lightsSwitch(),
		lightsOn: () => lightsOn(),
	});
</script>
