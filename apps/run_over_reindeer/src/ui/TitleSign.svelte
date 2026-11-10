<script lang="ts">
	// THE TITLE, PLACEHOLDER: the game's name set in Overpass Heavy on a green highway guide sign, drawn in CSS.
	// The real title logo is separate art that is not made yet (spec, Type); when it lands it takes this box
	// (game/layoutSpec.ts TITLE) and this component goes.
	//
	// THE SPIN COUNTER (second pass): in a bonus round the same sign reads the round's name and "3 OF 10", the spin
	// in play and the round's length as the book gives them (they grow by 3 on a retrigger). The landing screen
	// passes `title` so it always shows the name.
	import { stateGame } from '../game/stateGame.svelte';

	type Props = { width: number; height: number; lines?: 1 | 2; title?: boolean };
	const { width, height, lines = 2, title = false }: Props = $props();
	const round = $derived(!title && stateGame.gameType === 'freegame' && stateGame.totalFs > 0);
	const top = $derived(round ? (stateGame.bonusMode === 'super' ? 'SUPER SPINS' : 'FREE SPINS') : 'RUN OVER');
	// spinsPlayed counts finished spins: the one in play is the next
	const bottom = $derived(round ? `${Math.min(stateGame.spinsPlayed + 1, stateGame.totalFs)} OF ${stateGame.totalFs}` : 'REINDEER');
	// the type is sized from the box: one line is about 9.2 capitals wide, two lines about 4.9
	const size = $derived(lines === 1 ? Math.min(height * 0.5, width / 10.4) : Math.min(height * 0.33, width / 5.6));
</script>

<div class="sign" class:one={lines === 1} class:round class:super={round && stateGame.bonusMode === 'super'} data-title-sign style:width="{width}px" style:height="{height}px" style:font-size="{size}px" role="img" aria-label={round ? `${top} ${bottom}` : 'Run Over Reindeer'}>
	{#if lines === 1}
		<span>{top} {bottom}</span>
	{:else}
		<span>{top}</span><span>{bottom}</span>
	{/if}
</div>

<style>
	.sign {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.08em;
		background: #0b7a43;
		border: 0.16em solid #ffffff;
		border-radius: 0.5em;
		outline: 0.09em solid #0b7a43;
		box-shadow: 0 0.18em 0 rgba(10, 30, 50, 0.35);
		color: #ffffff;
		font-family: 'Overpass', var(--ui-font);
		font-weight: 900;
		line-height: 1;
		letter-spacing: 0.02em;
		white-space: nowrap;
		pointer-events: none;
		user-select: none;
		-webkit-user-select: none;
	}
	/* a bonus round: a blue sign for Free Spins, a red one for Super (still plain highway sign colors) */
	.sign.round {
		background: #0d4fa8;
		outline-color: #0d4fa8;
	}
	.sign.round.super {
		background: #b3182b;
		outline-color: #b3182b;
	}
	.sign span {
		display: block;
		/* Overpass sits low in its line box: lift the capitals to the optical centre */
		transform: translateY(0.06em);
	}
</style>
