// THE RESUME CARD'S CHOICE (2026-11-18, a stock rule for every game; Corey: "Skip the landing screen, it should
// automatically give a card that gives players the option to resume Skip to Result, or Play Round. This should exist for
// both games."). A load with an unfinished round (authenticate's round is active, never in a replay) shows
// ui/ResumeCard.svelte in place of the landing screen; its press is the first user gesture (the sound starts with it) and
// says how the round is resumed: Play Round replays it as before, Skip to Result plays its remaining events with every
// wait collapsed (stateGame skipping, the SKIP TO RESULT path) and shows the final board and total. The round is settled
// by its one end-round either way (the game actor, as for any round). components/ResumeBet.svelte reads it.
export const resumeChoice = {
	/** the card was shown for this load */
	shown: false,
	/** null until a choice is pressed */
	choice: null as null | 'play' | 'skip',
	chosenAt: -1,
};

// NOTHING LEFT TO PRESENT (2026-11-18, the rule for both games): an active BASE round that pays nothing and triggers no
// feature is finished. The real RGS closes a 0x round at its play (no end-round is ever sent for it), but a mock or staging
// RGS can still report it active until the next play; a reload then must not offer UNFINISHED ROUND for a losing spin. Such
// a round is marked inactive here, before anything reads it: the normal landing screen, the last board snapped as after
// any finished round, Spin free, no end-round. A feature round (more than one reveal) is still resumed, even at 0x.
// Returns true when it marked one (the DEV hook reports it)
export const settleDeadSpin = (stateBet: { betToResume: any }, isFeature: (bet: any) => boolean): boolean => {
	const bet = stateBet.betToResume;
	if (!bet || !bet.active) return false;
	if (Number(bet.payoutMultiplier) > 0) return false;
	if (!Array.isArray(bet.state) || isFeature(bet)) return false;
	stateBet.betToResume = { ...bet, active: false };
	return true;
};
