<script lang="ts">
	// The scene behind the road: flat snow over the whole canvas, in the color the board background's own snow has.
	// The road picture itself (and everything on it) is components/Board.svelte. Trees, the desktop overpass and any
	// ambient life are not made yet.
	import { Rectangle } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { ROAD } from '../game/constants';

	const context = getContext();
</script>

<Rectangle {...context.stateLayoutDerived.canvasSizes()} backgroundColor={ROAD.snow} />
