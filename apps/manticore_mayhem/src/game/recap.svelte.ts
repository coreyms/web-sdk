// THE RECAP (1.0.04; images/plaque_r6_storyboard STORYBOARD.md section 6, Corey 2026-10-20: the recap is in 1.0.04, "Build
// on 1.0.04"). What the recap box (components/SpinRecap.svelte) shows, kept as the book is played: the last spin's
// clears per cascade, and after a feature every free spin with its clears. Every figure is the BOOK's as received (the
// presented cluster: its size n, symbol s, base pay p, tile sum m and win w; on a capped step what the crossing cluster
// pays, as the plaque shows it); the frontend computes nothing. Replay plays the book through the same handlers, so the
// records build the same; a resumed feature rebuilds its spins from createBonusSnapshot's events.
//
// The handler (game/bookEventHandlerMap.ts) writes: recapReveal at each reveal, recapCascade at each cascade's presented
// clusters, recapFeatureStart at bonusStart, recapFeatureEnd at freeSpinEnd (the offer goes up), recapRebuild on a resume.
// The plaque (components/BoardPlaque.svelte) draws the offer and takes the tap; the box reads `recap`.
import { stateBet, stateBetDerived, stateModal, stateUi } from 'state-shared';

import { stateXstateDerived } from './stateXstate';
import { stateLayout } from './stateLayout';
import { stateGame as sg } from './stateGame.svelte';
import { maxWinState } from './maxWin.svelte';
import { armouryView } from '../ui/armoury/armouryView.svelte';
import type { BookEvent } from './typesBookEvent';

export type RecapClear = { n: number; s: string; p: number; m: number; w: number };
export type RecapSpin = { cascades: RecapClear[][]; total: number };
export type RecapFeature = { mode: string; spins: RecapSpin[]; total: number | null };

export const recap = $state({
	/** the last spin played (base or free), null before the first */
	last: null as RecapSpin | null,
	/** the feature being played or just ended, null outside one */
	feature: null as RecapFeature | null,
	/** the plaque offers the feature recap (after a feature's wrap-up, until the next spin) */
	offer: false,
	/** the box on show: 'last', 'feature' or null */
	open: null as 'last' | 'feature' | null,
});

/** a reveal: a new spin record (the feature's next spin, or a base spin: then the last feature and its offer are over) */
export const recapReveal = (gameType: string) => {
	const spin: RecapSpin = { cascades: [], total: 0 };
	if (gameType === 'freegame' && recap.feature) {
		// ONE record: the feature's list keeps it and `last` points at the same (state) object, so a cascade written
		// through `last` is the feature's too
		recap.feature.spins.push(spin);
		recap.last = recap.feature.spins[recap.feature.spins.length - 1];
	} else recap.last = spin;
	if (gameType !== 'freegame') {
		recap.feature = null;
		recap.offer = false;
	}
	recap.open = null;
};

/** a cascade's presented clusters (the book's numbers as presented) and the book's spin total after it */
export const recapCascade = (clears: RecapClear[], spinWin: number) => {
	const spin = recap.last;
	if (!spin) return;
	spin.cascades.push(clears.map((c) => ({ ...c })));
	spin.total = spinWin;
};

export const recapFeatureStart = (mode: string) => {
	recap.feature = { mode, spins: [], total: null };
	recap.offer = false;
};

/** the wrap-up: the feature's own total (the book's freeSpinEnd amount); the plaque offers the recap */
export const recapFeatureEnd = (total: number) => {
	if (!recap.feature) return;
	recap.feature.total = total;
	recap.offer = recap.feature.spins.length > 0;
};

/** a resumed feature (createBonusSnapshot): its spins so far, rebuilt from the book's events */
export const recapRebuild = (bookEvents: BookEvent[]) => {
	const start = bookEvents.find((e) => e.type === 'bonusStart');
	if (!start || start.type !== 'bonusStart') return;
	recapFeatureStart(start.bonus);
	// the resumed round replays from its last reveal (utils.ts convertTorResumableBet): that spin is recorded as it replays
	let end = bookEvents.length;
	for (let i = bookEvents.length - 1; i > bookEvents.indexOf(start); i -= 1)
		if (bookEvents[i].type === 'reveal') {
			end = i;
			break;
		}
	for (let i = bookEvents.indexOf(start) + 1; i < end; i += 1) {
		const e = bookEvents[i];
		if (e.type === 'reveal') recapReveal(e.gameType);
		else if (e.type === 'cascade') recapCascade(e.wins.map((w) => ({ n: w.n, s: w.s, p: w.p, m: w.m, w: w.w })), e.spinWin);
	}
};

/** the last spin cleared something (a spin with no clears opens nothing: Corey 2026-10-20) */
export const recapHasClears = () => !!recap.last && recap.last.cascades.some((c) => c.length > 0);

/** THE RECAP'S IDLE (the symbol pay popup's rule, game/boardIdle.ts, but a finished REPLAY round counts: "It must work in
 *  replay"): no round in flight, no autoplay run, no feature, no modal or menu, no press gate, plaque, win screen or max
 *  win screen, not loading, not a held open round, nothing being skipped, the board at rest */
export const recapIdle = (): boolean =>
	stateXstateDerived.isIdle() &&
	!sg.resumeHold &&
	!stateLayout.showLoadingScreen &&
	stateModal.modal == null &&
	!stateUi.menuOpen &&
	!armouryView.shown &&
	!stateBetDerived.hasAutoBetCounter() &&
	!stateBet.isSpaceHold &&
	sg.gameType !== 'freegame' &&
	sg.pressGates === 0 &&
	!sg.winShowing &&
	sg.plaque === null &&
	!sg.skipping &&
	!sg.busy &&
	sg.readouts.length === 0 &&
	maxWinState.phase === 'idle';

/** what a tap on the plaque would open now: the feature recap while it is offered, else the last spin if it cleared
 *  anything, else nothing */
export const recapTarget = (): 'last' | 'feature' | null => (recap.offer && recap.feature ? 'feature' : recapHasClears() ? 'last' : null);

/** the "tap the plaque" explainer line is skipped while autoplay runs or is loaded on the Spin button (Corey 2026-10-20:
 *  "omit that line of text when autospin is active or loaded on top the play button") and while there is nothing to open */
export const recapLineOn = (): boolean => !stateBetDerived.hasAutoBetCounter() && !sg.autoLoadout && recapTarget() !== null;
