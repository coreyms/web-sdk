// Replay playback phase, shared between the replay card (ui/ReplayModal.svelte) and the spin
// button (ui/SquareSpin.svelte): the card starts the first playback; afterwards the spin button —
// a static REPLAY banner while the round runs — re-arms and replays the same round on press, the
// way Stake's own replay window behaves (Corey 2026-09-02).
export const replayState = $state({
	phase: 'ready' as 'ready' | 'playing' | 'done',
	start: null as null | (() => void),
});
