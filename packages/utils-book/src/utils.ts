import { PUBLIC_CHROMATIC } from 'envs';
import { stateUrlDerived } from 'state-shared';
import { requestEndEvent } from 'rgs-requests';

import type { BaseBookEvent } from './types';

export function recordBookEvent<TBookEvent extends BaseBookEvent>({
	bookEvent,
}: {
	bookEvent: TBookEvent;
}) {
	if (PUBLIC_CHROMATIC || stateUrlDerived.replay()) {
		console.log('mock request end-event:', { index: bookEvent.index, type: bookEvent.type });
		return;
	}

	try {
		// Fire-and-forget: end-event is a progress marker the RGS uses to resume an interrupted
		// round, so playback must never wait on it. The promise is deliberately not awaited, which
		// means the try/catch below only covers a synchronous throw — without a .catch() a failed
		// request surfaces as an unhandled rejection. A warning is the right level: the round's
		// money is settled by end-round, not by this call.
		requestEndEvent({
			eventIndex: bookEvent.index,
			rgsUrl: stateUrlDerived.rgsUrl(),
			sessionID: stateUrlDerived.sessionID(),
		}).catch((error) => {
			console.warn('end-event request failed:', { index: bookEvent.index, type: bookEvent.type }, error);
		});
	} catch (error) {
		console.error(error);
	}
}

export function checkIsMultipleRevealEvents<TBookEvent extends BaseBookEvent>({
	bookEvents,
}: {
	bookEvents: TBookEvent[];
}) {
	const revealEventCount = bookEvents.filter((bookEvent) => bookEvent.type === 'reveal').length;
	const isMultipleReveals = revealEventCount > 1;
	return isMultipleReveals;
}
