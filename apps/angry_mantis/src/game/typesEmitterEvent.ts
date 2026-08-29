import type { EmitterEventBoard } from '../components/Board.svelte';
import type { EmitterEventBoardFrame } from '../components/BoardFrame.svelte';
import type { EmitterEventBonusIntro } from '../components/BonusIntro.svelte';
import type { EmitterEventFreeSpinCounter } from '../components/FreeSpinCounter.svelte';
import type { EmitterEventFreeSpinOutro } from '../components/FreeSpinOutro.svelte';
import type { EmitterEventWin } from '../components/Win.svelte';
import type { EmitterEventComboWin } from '../components/ComboWin.svelte';
import type { EmitterEventSound } from '../components/Sound.svelte';
import type { EmitterEventTransition } from '../components/Transition.svelte';
import type { EmitterEventMantis } from '../components/Mantis.svelte';
import type { EmitterEventPoolHud } from '../components/PoolHud.svelte';
import type { EmitterEventRetrigger } from '../components/RetriggerBanner.svelte';
import type { EmitterEventMaxWinCinematic } from '../components/MaxWinCinematic.svelte';
import type { EmitterEventSessionSummary } from '../components/SessionSummary.svelte';
import type { EmitterEventReplay } from '../components/ReplayOverlay.svelte';
import type { EmitterEventMartyArt } from '../components/MartyArt.svelte';

export type EmitterEventGame =
	| EmitterEventBoard
	| EmitterEventBoardFrame
	| EmitterEventWin
	| EmitterEventComboWin
	| EmitterEventBonusIntro
	| EmitterEventFreeSpinCounter
	| EmitterEventFreeSpinOutro
	| EmitterEventSound
	| EmitterEventTransition
	| EmitterEventMantis
	| EmitterEventPoolHud
	| EmitterEventRetrigger
	| EmitterEventMaxWinCinematic
	| EmitterEventSessionSummary
	| EmitterEventReplay
	| EmitterEventMartyArt;
