<script lang="ts">
	// THE LOGO AS HTML (2026-11-18, Corey's C1): the frame (logo-frame.webp) with its lettering layer laid over the panel
	// at constants LOGO.lettering.box, as the canvas draws them (game/logo/still.ts). The landing screen's logo and the
	// chromes' fallback <img>; the parent sizes it by width, its height follows the frame. The FIRST <img> is the frame:
	// the probes read its box as the logo's.
	import { LOGO_LETTERING_PATH, LOGO_STILL_PATH, stamp } from '../game/assets';
	import { LOGO } from '../game/constants';

	type Props = { width?: number };
	const { width }: Props = $props();
	const [x0, y0, x1, y1] = LOGO.lettering.box;
	const W = LOGO.art.width;
	const H = LOGO.art.height;
</script>

<span class="logo-picture">
	<img class="frame" src={stamp(`/assets/${LOGO_STILL_PATH}`)} alt="Manticore Unleashed" {width} draggable="false" />
	<img
		class="lettering"
		src={stamp(`/assets/${LOGO_LETTERING_PATH}`)}
		alt=""
		aria-hidden="true"
		draggable="false"
		style:left="{(x0 / W) * 100}%"
		style:top="{(y0 / H) * 100}%"
		style:width="{((x1 - x0) / W) * 100}%"
		style:height="{((y1 - y0) / H) * 100}%"
	/>
</span>

<style>
	.logo-picture {
		position: relative;
		display: block;
		width: 100%;
	}
	.frame {
		display: block;
		width: 100%;
		height: auto;
	}
	.lettering {
		position: absolute;
	}
</style>
