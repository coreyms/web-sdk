<script lang="ts" module>
	export type EmitterEventDoorSteel =
		| { type: 'doorClose' } // roll down over the window (await: settles fully closed)
		| { type: 'doorOpen' } // roll back up into the header housing (await: fully hidden)
		| { type: 'doorSnap'; closed: boolean }; // jump to a state with no animation
</script>

<script lang="ts">
	// Rolled steel cafeteria door (Corey's art, 2026-08-30). Lives INSIDE the frame's interior
	// window, masked to it, and rolls down from under the frame's header bar. The door art is
	// taller than the window, so closed = bottom rail (handle) flush with the window bottom.
	// The uniform mid-band doubles as a staging surface for transition text later.
	import { Tween } from 'svelte/motion';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { Container, Sprite, Rectangle, Graphics } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';
	import { frameFor, layoutKind, DOOR_ART } from '../game/layoutSpec';

	const context = getContext();
	const vw = $derived(
		context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale,
	);
	const frame = $derived(frameFor(layoutKind(context.stateLayoutDerived.layoutType()), vw));
	const win = $derived({
		x: frame.x + frame.inset,
		y: frame.y + frame.inset,
		w: frame.width - frame.inset * 2,
		h: frame.height - frame.inset * 2,
	});
	// The frame art's inner window edge is anti-aliased/soft, so a door cut exactly at the
	// window rect leaves a ~2px sliver of symbols visible along the sides. Bleed the door
	// (and its mask) under the frame edge so the slats read as sliding in a channel.
	const BLEED = 6;
	const doorW = $derived(win.w + BLEED * 2);
	// door scaled to its bled width; taller than the window by design
	const doorH = $derived((DOOR_ART.h / DOOR_ART.w) * doorW);

	// 0 = hidden above the window, 1 = fully closed. Rendered as a y offset inside the mask.
	const drop = new Tween(0, { duration: 0 });
	// NOTE: the container stays MOUNTED even while hidden — the presentation layers
	// (BonusIntro/FreeSpinOutro/Win) are always-mounted FadeContainers, so Pixi
	// z-order is fixed by Game.svelte template order. Mounting the door lazily put it above
	// the wrap-up text. Visibility toggles instead.
	let engaged = $state(false);

	context.eventEmitter.subscribeOnMount({
		doorClose: async () => {
			engaged = true;
			drop.set(0, { duration: 0 });
			// sfx is cut to the travel: the sprite clip's slam sits 450 ms in, so it fires WITH the drop,
			// not after. Corey's recording is a 1.95 s roll whose slam onset is 1592 ms in; the audiosprite
			// trims 1142 ms off its head (build_audiosprite.py trim_start) to land the slam on the hard
			// stop below. Re-measure and retune that trim if the source is ever re-recorded.
			context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_door_close' });
			// heavy roll-down: accelerates like a released shutter, lands with a hard stop
			await drop.set(1, { duration: 450, easing: cubicIn });
		},
		doorOpen: async () => {
			// latch click 61 ms in (measured), roll fading over the 550 ms rise — inside tolerance, untrimmed
			context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_door_open' });
			await drop.set(0, { duration: 550, easing: cubicOut });
			engaged = false;
		},
		// snap has no travel (resume / instant state set) — stays silent
		doorSnap: ({ closed }) => {
			drop.set(closed ? 1 : 0, { duration: 0 });
			engaged = closed;
		},
	});
</script>

<MainContainer>
	<Container x={win.x} y={win.y} visible={engaged}>
		<!-- bleeds ABOVE the window too: the frame's top inner edge is as soft as the sides, and a
		     mask cut at win.y left a sliver of the top symbol row visible over the closed door
		     (Corey, 2026-09-02). The door art is taller than the window, so it covers the bleed. -->
		<Rectangle isMask x={-BLEED} y={-BLEED} width={doorW} height={win.h + BLEED * 2} />
		<!-- opaque backing riding with the door: the art has faintly translucent slat grooves
		     that would leak the reels through as bright slivers -->
		<Rectangle
			backgroundColor={0x0b0805}
			x={-BLEED}
			width={doorW}
			height={doorH}
			y={win.h + BLEED - doorH + (drop.current - 1) * (win.h + BLEED)}
		/>
		<Sprite
			key="doorSteel"
			x={-BLEED}
			width={doorW}
			height={doorH}
			y={win.h + BLEED - doorH + (drop.current - 1) * (win.h + BLEED)}
		/>
		<!-- soft shadow under the moving bottom rail sells the depth while rolling -->
		{#if drop.current > 0 && drop.current < 1}
			<Graphics
				draw={(g) =>
					g
						.rect(-BLEED, drop.current * (win.h + BLEED), doorW, 10)
						.fill({ color: 0x000000, alpha: 0.35 })}
			/>
		{/if}
	</Container>
</MainContainer>
