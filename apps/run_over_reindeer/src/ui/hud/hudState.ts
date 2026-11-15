// What the three chromes show in their readouts, in one place (reads only; every rule is controls.svelte.ts's).
import { stateBet } from 'state-shared';
import { modeShortLabel } from '../../game/betModeMeta';
import { getContext } from '../../game/context';
import type { Controls } from '../controls.svelte';
import { replayState } from '../replayState.svelte';
import { HUD_CONFIG } from '../hudTheme';

export const createHudState = (controls: Controls) => {
	const context = getContext();
	/** 1 an Ante level, 2 the top Ante level (HUD_CONFIG.topAnteKey, ANTE_10 here; Manticore: Super Ante), 0 neither
	 *  (the accent thread on the glass, the amount's accent) */
	const anteLevel = (): 0 | 1 | 2 => (controls.anteActive() ? (stateBet.activeBetModeKey.toUpperCase() === HUD_CONFIG.topAnteKey ? 2 : 1) : 0);
	/** a mode is on: an Ante level, or a bought feature armed on the Spin */
	const modeOn = () => controls.anteActive() || controls.armedBuy() !== null;
	/** THE AMOUNT'S WORD (Drop 6): the mode's name while an Ante level is on (Corey's mockup: "the amount shows the
	 *  mode's cost under the mode's name"); otherwise controls.betLabel() as before (SPIN / PLAY, or an armed buy's name).
	 *  The number is controls.betText(), the full price of the next press, in every case. */
	const amtLabel = () => (controls.anteActive() ? modeShortLabel(stateBet.activeBetModeKey) : controls.betLabel());
	/** a replayed round's readouts (ui/replayState.svelte.ts hud), never the live bet */
	const replay = () => (controls.isReplay() ? replayState.hud : null);
	/** FREE SPINS before WIN while a feature plays: the running total is the feature's */
	const winPre = () => (controls.freeSpin() !== null ? 'FREE SPINS' : '');
	/** WIN warms from below once there is a win; a step brighter while the big win presentation is up */
	const winLit = () => controls.hasWin();
	const winBig = () => controls.hasWin() && context.stateGame.winShowing;
	return { anteLevel, modeOn, amtLabel, replay, winPre, winLit, winBig };
};
export type HudState = ReturnType<typeof createHudState>;
