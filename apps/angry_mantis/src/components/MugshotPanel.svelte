<script lang="ts">
	// Booking mugshot for one mantis: Corey's chalk height-chart plate with the character's head
	// pinned to it. The plate art carries its own INMATE label and foot marks (and mirrors them —
	// 01 labels its chart on the left, 02 on the right), so this component only has to place the
	// head: large, low, hanging past the plate's bottom edge, and nudged toward the plate's empty
	// side so it never covers the chart numbers.
	import { Container, Sprite } from 'pixi-svelte';

	import { INMATE_PLATE, MUGSHOT_HEAD } from '../game/constants';

	type Props = {
		/** Plate centre, in the intro's design space. */
		x: number;
		y: number;
		/** Plate height; width follows the art's own aspect. */
		h: number;
		name: 'marky' | 'marty';
	};
	const { x, y, h, name }: Props = $props();

	const plate = $derived(INMATE_PLATE[name]);
	const w = $derived(h * plate.aspect);
	// Head height as a fraction of the plate: tall enough to dominate the panel, short enough that
	// its crown clears the label band across the plate's top.
	// At HEAD = 1.0 with a 0.25 overhang the crown lands 25% of the plate below its top — clear of
	// the INMATE banner (the art gives it the top ~20%) — and a quarter of the head hangs past the
	// bottom rule, which is the render's proportion.
	const HEAD = MUGSHOT_HEAD.size;
	const OVERHANG = MUGSHOT_HEAD.overhang; // of the head, below the plate's lower edge
	const head = $derived(h * HEAD);
</script>

<Container {x} {y}>
	<Sprite key={plate.key} anchor={0.5} width={w} height={h} />
	<Sprite
		key="{name}Headshot"
		anchor={0.5}
		x={w * plate.headShift}
		y={h / 2 + head * (OVERHANG - 0.5)}
		width={head}
		height={head}
	/>
</Container>
