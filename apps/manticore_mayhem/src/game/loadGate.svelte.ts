// THE LOADING GATE's readout (first-minute plan D, constants LOAD_GATE; game/assets.ts GATE_ORDER has the files).
// game/deferredLoad.ts loadGate fills it as the gate's files land; ui/LandingScreen.svelte waits on `settled` (up to the
// cap) and counts `doneBytes` into its loading bar; components/Game.svelte starts the deferred phase and the music's
// side tracks once it has settled. Settled = every file of the gate has landed or failed (a failed one is left to the
// shared loader's last batch, which has the retries and the failure screen): it never waits on a dead download.
import { GATE_BYTES } from './assets';

export const loadGate = $state({
	/** performance.now() the gate's first file was asked for (0: not yet) */
	startedAt: 0,
	/** every file of the gate has landed or failed */
	settled: false,
	/** performance.now() it settled (0: not yet) */
	settledAt: 0,
	/** bytes of the gate's files that have landed (an atlas counts its json and its picture) */
	doneBytes: 0,
	/** the gate's download size, bytes */
	totalBytes: GATE_BYTES,
	files: 0,
	filesDone: 0,
	failed: 0,
});

let resolveSettled: () => void = () => {};
/** resolves when the gate has settled */
export const gateSettled = new Promise<void>((resolve) => (resolveSettled = resolve));

export const markGateSettled = (): void => {
	if (loadGate.settled) return;
	loadGate.settled = true;
	loadGate.settledAt = typeof performance !== 'undefined' ? performance.now() : 1;
	resolveSettled();
};
