<script lang="ts" module>
	import type { BonusMode, BonusHost } from '../game/types';

	export type EmitterEventBonusIntro =
		| { type: 'bonusIntroShow'; mode: BonusMode; host: BonusHost; totalFs: number }
		| { type: 'bonusIntroHide' };
</script>

<script lang="ts">
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { Sprite, Container } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { autoBonusesRunning } from '../game/stateGame.svelte';
	import GameText from './GameText.svelte';
	import { BONUS_MODE_HEADER } from '../game/constants';
	import { frameFor, layoutKind } from '../game/layoutSpec';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();

	let show = $state(false);
	let mode = $state<BonusMode>('free');
	let host = $state<BonusHost>('marty');
	let totalFs = $state(0);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		bonusIntroShow: async (emitterEvent) => {
			mode = emitterEvent.mode;
			host = emitterEvent.host;
			totalFs = emitterEvent.totalFs;
			show = true;
			// gated on player input (Corey 2026-08-30) — the door holds until they press. A running
			// autoplay with AUTOPLAY BONUSES on presses for them ~1s after the door is ready.
			const pressed = waitForResolve((resolve) => (oncomplete = resolve));
			await (autoBonusesRunning() ? Promise.race([pressed, waitForTimeout(1000)]) : pressed);
		},
		bonusIntroHide: () => (show = false),
	});

	const hosts = $derived(host === 'both' ? ['marky', 'marty'] : [host]); // Marky always left, Marty right

	// Expanded rules copy (Corey 2026-08-30). Paragraphs word-wrap inside the door; text
	// treatment is provisional until Corey's finalized styles.
	const MODE_DESC: Record<BonusMode, string[]> = {
		free: [
			'Symbols served on the Green Strike leaf will be eaten by Marty. Lowest Symbols are always eaten first.',
			'After a symbol has been eaten it will no longer appear for remaining bonus games.',
		],
		super: [
			'Symbols served on the Green Strike leaf will be eaten by Marky. Lowest Symbols are always eaten first.',
			'After a symbol has been eaten it will no longer appear for remaining bonus games.',
			'In the Super Bonus, Marky has a higher chance of eating symbols.',
		],
		feast: [
			'Symbols served on the Green Strike leaf will be eaten by Marty or Marky. Lowest Symbols are always eaten first.',
			'After a symbol has been eaten it will no longer appear for remaining bonus games.',
			'In the EPIC Feast Mode, both Mantises automatically eat a symbol at the start of the bonus.',
		],
	};

	// Everything (header art, headshots, title, rules) fits INSIDE the door's window: content is
	// authored in a 620×500 design space centered on the window, then uniformly scaled to fit.
	// Only the PRESS ANYWHERE prompt lives outside, below the counter (HUD pressToContinue slot).
	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const vw = $derived(
		context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale,
	);
	const f = $derived(frameFor(kind, vw));
	const win = $derived({
		x: f.x + f.inset,
		y: f.y + f.inset,
		w: f.width - f.inset * 2,
		h: f.height - f.inset * 2,
	});
	const fit = $derived(Math.min(win.w / 620, win.h / 500, 1.15));
</script>

<!-- persistent: the container claims its Game.svelte template slot at game start and keeps it —
     a lazy (re)mount joins the stage LAST, above layers that must cover it (z-order trap).
     FadeContainer sets visible=false at alpha 0, so the idle intro neither renders nor eats
     presses; content has no mount-armed logic, it re-renders from mode/host/totalFs. -->
<FadeContainer persistent {show}>
	<!-- no dim backdrop: the closed steel door IS the backdrop (Corey 2026-08-30) -->
	<MainContainer>
		<Container x={win.x + win.w / 2} y={win.y + win.h / 2} scale={fit}>
			<Sprite key={BONUS_MODE_HEADER[mode]} anchor={0.5} y={-195} scale={0.5} />
			{#each hosts as name, i (name)}
				<Sprite
					anchor={0.5}
					x={(i - (hosts.length - 1) / 2) * 175}
					y={-68}
					width={142}
					height={142}
					key="{name}Headshot"
				/>
			{/each}
			<!-- keyed: a PIXI.Text updated while its container is invisible keeps its old glyphs
			     (ModePlaque precedent) — the persistent mount means these update pre-show -->
			{#key totalFs}
				<GameText y={32} text={`${totalFs} FREE SPINS`} preset="gold" size={40} />
			{/key}
			{#key mode}
				<GameText
					y={64}
					anchor={{ x: 0.5, y: 0 }}
					text={MODE_DESC[mode].join('\n\n')}
					preset="silver"
					size={17}
					extra={{ wordWrap: true, wordWrapWidth: 540, lineHeight: 22, align: 'center' }}
				/>
			{/key}
		</Container>
	</MainContainer>
	<PressToContinue showText onpress={() => oncomplete()} />
</FadeContainer>
