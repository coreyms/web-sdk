// WHICH STRIKE OF ITS SPIN (the roaming reindeer, constants STRIKE.roam; game/bookEventHandlerMap.ts strike): a spin is
// the book's events from one reveal to the next (a base game spin, or each free spin of a bonus round alike). The first
// strike of a spin is the roaming reindeer's; a new one walks in after the last. Presentation only.
export const strikePlace = (events: readonly { type: string }[], at: number): { first: boolean; last: boolean } => {
	let first = true;
	for (let i = at - 1; i >= 0 && events[i].type !== 'reveal'; i--) if (events[i].type === 'strike') first = false;
	let last = true;
	for (let i = at + 1; i < events.length && events[i].type !== 'reveal'; i++) if (events[i].type === 'strike') last = false;
	return { first, last };
};
