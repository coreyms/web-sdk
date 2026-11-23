// THE REPLAY GUARD (2026-11-23; game/replayFault.ts has the rule and why). Called once as the game mounts
// (components/Game.svelte), which is after the shared Authenticate has asked /bet/replay and stored whatever came back.
// A replay that cannot play shows the game's own error card in its replay words (ui/NoticeModal.svelte REPLAY_FAILED:
// "REPLAY NOT AVAILABLE", RELOAD) and nothing else: the round is let go, so the replay card never opens on zeros,
// START REPLAY and the Spin key's REPLAY have nothing to start, and no round is held.
// What the card's small line reads: the RGS's own code where its body carried one (ERR_VAL); else the line a reply the
// game could not read already has (BAD RESPONSE: a SyntaxError is what the fetcher throws for one).
import { stateBet, stateModal, stateUrlDerived } from 'state-shared';

import { betModeMeta } from './betModeMeta';
import { replayFault, type ReplayFault } from './replayFault';

/** the fault this replay was refused for, or null (DEV: the probe reads it, tools/replay_probe.mjs) */
export const replayGuard = { fault: null as ReplayFault };

export const guardReplay = () => {
	if (!stateUrlDerived.replay()) return;
	// (a fetch that failed outright already put the error card up: shared Authenticate)
	if (stateModal.modal?.name === 'error') return;
	const round = stateBet.betToResume as unknown;
	const mode = (stateUrlDerived.mode() || '').toUpperCase();
	const fault = replayFault(round, betModeMeta[mode] !== undefined);
	replayGuard.fault = fault;
	if (!fault) return;
	console.error('[rgs] replay not available:', fault);
	const body = (round ?? {}) as { error?: unknown; message?: unknown };
	stateBet.betToResume = null;
	// @ts-ignore the SDK's modal union types `error` loosely; the card reads a code or the error's kind from it
	stateModal.modal = { name: 'error', error: fault === 'error' ? { error: body.error, message: body.message } : new SyntaxError(`replay: ${fault}`) };
};
