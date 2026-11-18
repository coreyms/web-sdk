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
