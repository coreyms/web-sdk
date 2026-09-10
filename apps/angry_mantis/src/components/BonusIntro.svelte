<script lang="ts" module>
	import type { BonusMode, BonusHost } from '../game/types';

	export type EmitterEventBonusIntro =
		| { type: 'bonusIntroShow'; mode: BonusMode; host: BonusHost; totalFs: number }
		| { type: 'bonusIntroHide' };
</script>

<script lang="ts">
	// The bonus intro IS the closed steel door: the mode header, the free-spin count and the strokes
	// beside it are PAINTED INTO the door by DoorPaint.svelte (game/doorPaint.ts, Corey 2026-09-10)
	// and roll down with it. The mugshot plates that used to sit between them came off the same
	// day (Corey: they covered the painted numeral). This component is the press gate only — it
	// holds the door until the player presses (or a running AUTOPLAY BONUSES presses for them).
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();

	let show = $state(false);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		bonusIntroShow: async (emitterEvent) => {
			void emitterEvent; // mode / host / totalFs drive the painted door (doorPaintIntro in bonusStart)
			show = true;
			// gated on player input (Corey 2026-08-30) — the door holds until they press. A running
			// autoplay with AUTOPLAY BONUSES on presses for them ~1s after the door is ready — but
			// re-checked at FIRE time: stopping autoplay during the window (autoSpinsCounter -> 0)
			// must restore the hard press-gate, not press through it. autoPress pins THIS door's
			// resolver, so a late timer can never press a future door (resolving twice is a no-op).
			const pressed = waitForResolve((resolve) => (oncomplete = resolve));
			if (autoBonusesRunning()) {
				const autoPress = oncomplete;
				void waitForTimeout(1000).then(() => {
					if (autoBonusesRunning()) autoPress();
				});
			}
			await pressed;
		},
		bonusIntroHide: () => (show = false),
	});
</script>

<!-- persistent: the container claims its Game.svelte template slot at game start and keeps it —
     a lazy (re)mount joins the stage LAST, above layers that must cover it (z-order trap).
     FadeContainer sets visible=false at alpha 0, so the idle intro neither renders nor eats presses. -->
<FadeContainer persistent {show}>
	<!-- no dim backdrop and no sprites: the painted steel door IS the intro (Corey 2026-08-30 / 09-10) -->
	<!-- active={show}: this PressToContinue is ALWAYS mounted (persistent FadeContainer), so the
	     press-gate registration must follow visibility, not mount -->
	<PressToContinue showText active={show} onpress={() => oncomplete()} />
</FadeContainer>
