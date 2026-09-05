<script lang="ts" module>
	export type EmitterEventMysteryTray = { type: 'mysteryTrayShow' } | { type: 'mysteryTrayHide' };
</script>

<script lang="ts">
	// The Mystery Spin's empty result (2026-09-05 reshape). Half of all Mystery Spins award nothing:
	// the book is one plain base reveal with no scatter trigger and finalWin 0. The reels have
	// already shown the miss; this beat just names it so the player is never left wondering whether
	// the buy registered. No amount, no counter, no round-end call (a zero-win round never sends
	// end-round). Atlas glyphs only (ArtAmount), nothing rasterizes. Timed beat, no press gate
	// (Corey 2026-09-05): it holds TIMINGS.mysteryTray (turbo-scaled) and clears itself.
	import { Container, Graphics } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { waitForTimeout } from 'utils-shared/wait';
	import { stateBetDerived } from 'state-shared';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';

	import { TIMINGS } from '../game/constants';
	import { getContext } from '../game/context';
	import { frameFor, layoutKind } from '../game/layoutSpec';
	import ArtAmount from './ArtAmount.svelte';

	const context = getContext();

	let show = $state(false);
	const pop = new Tween(0.7, { duration: 380, easing: backOut });

	context.eventEmitter.subscribeOnMount({
		mysteryTrayShow: async () => {
			show = true;
			pop.set(0.7, { duration: 0 });
			void pop.set(1);
			await waitForTimeout(TIMINGS.mysteryTray / stateBetDerived.timeScale());
		},
		mysteryTrayHide: () => (show = false),
	});

	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const vw = $derived(context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale);
	const f = $derived(frameFor(kind, vw));
	const win = $derived({ x: f.x + f.inset, y: f.y + f.inset, w: f.width - f.inset * 2, h: f.height - f.inset * 2 });
	const fit = $derived(Math.min(1, win.w / 640));
</script>

<!-- persistent: claims its Game.svelte slot at start so a lazy mount can't land above the modals -->
<FadeContainer persistent {show}>
	{#if show}
		<MainContainer>
			<!-- dim the board only (the chrome stays live so BALANCE is readable) -->
			<Graphics
				draw={(g) => {
					g.clear();
					g.rect(win.x, win.y, win.w, win.h).fill({ color: 0x000000, alpha: 0.72 });
				}}
			/>
			<Container x={win.x + win.w / 2} y={win.y + win.h / 2} scale={pop.current * fit}>
				<ArtAmount y={-40} text="EMPTY TRAY" height={64} maxWidth={560} />
				<ArtAmount y={36} text="NOTHING ON THE MENU THIS TIME" height={22} maxWidth={560} />
			</Container>
		</MainContainer>
	{/if}
</FadeContainer>
