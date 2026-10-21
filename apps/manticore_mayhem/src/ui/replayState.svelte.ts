// Replay playback phase, shared between the replay card (ui/ReplayModal.svelte) and the spin
// button (ui/SquareSpin.svelte): the card starts the first playback; afterwards the spin button —
// a static REPLAY banner while the round runs — re-arms and replays the same round on press, the
// way Stake's own replay window behaves (Corey 2026-09-02).
export const replayState = $state({
	phase: 'ready' as 'ready' | 'playing' | 'done',
	start: null as null | (() => void),
	/** THE REPLAY'S BET LINE (harsh review 2026-10-20 must-fix 4, submission checklist "UI clearly displays bet cost and
	 *  applied multiplier"; Corey 2026-10-21 "We should keep this then for the replay", "If the mode was not Base Games,
	 *  put Base Amount where the balance is", base game: "that'd be redundant so only show it on the right of the hub").
	 *  Set by the replay card from the replay's own parameters (its amount and the mode's cost): the HUD's right readout
	 *  (label over the round's total cost) and, for any mode but the base game, BASE AMOUNT in the balance's place. */
	hud: null as null | { label: string; total: string; base: string; isBase: boolean },
});
