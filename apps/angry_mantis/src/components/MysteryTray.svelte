<script lang="ts" module>
	export type EmitterEventMysteryTray = { type: 'mysteryTrayShow' } | { type: 'mysteryTrayHide' };
</script>

<script lang="ts">
	// The Mystery Buy's empty result (2026-09-05 reshape). Half of all Mystery Buys award nothing:
	// the book is one plain base reveal with no scatter trigger and finalWin 0. The reels have
	// already shown the miss; this beat just names it so the player is never left wondering whether
	// the buy registered. No amount, no counter, no round-end call (a zero-win round never sends
	// end-round). Atlas glyphs only (ArtAmount), nothing rasterizes; press (or autoplay) dismisses.
	import { Container, Graphics } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import { frameFor, layoutKind } from '../game/layoutSpec';
	import ArtAmount from './ArtAmount.svelte';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();

	let show = $state(false);
	let oncomplete = $state(() => {});
	const pop = new Tween(0.7, { duration: 380, easing: backOut });

	context.eventEmitter.subscribeOnMount({
		mysteryTrayShow: async () => {
			show = true;
			pop.set(0.7, { duration: 0 });
			void pop.set(1);
			const pressed = waitForResolve((resolve) => (oncomplete = resolve));
			// same rule as the bonus intro: a running autoplay with AUTOPLAY BONUSES on presses for
			// the player ~1.2s in, re-checked at fire time so stopping autoplay restores the gate
			if (autoBonusesRunning()) {
				const autoPress = oncomplete;
				void waitForTimeout(1200).then(() => {
					if (autoBonusesRunning()) autoPress();
				});
			}
			await pressed;
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
		<PressToContinue showText active={show} onpress={() => oncomplete()} />
	{/if}
</FadeContainer>
