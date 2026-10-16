import type { EmitterEventBoard } from '../components/Board.svelte';
import type { EmitterEventSpinWin } from '../components/BoardPlaque.svelte';
import type { EmitterEventModePlaque } from '../components/ModePlaque.svelte';
import type { EmitterEventWin } from '../components/Win.svelte';
import type { EmitterEventFreeSpinOutro } from '../components/FreeSpinOutro.svelte';
import type { EmitterEventMaxWinCinematic } from '../components/MaxWinCinematic.svelte';
import type { EmitterEventSound } from '../components/Sound.svelte';
import type { EmitterEventTransition } from '../components/Transition.svelte';
import type { EmitterEventReplay } from '../ui/ReplayModal.svelte';
import type { EmitterEventPlaque } from '../components/StingerPlaque.svelte';

export type EmitterEventGame =
	| EmitterEventBoard
	| EmitterEventSpinWin
	| EmitterEventModePlaque
	| EmitterEventWin
	| EmitterEventFreeSpinOutro
	| EmitterEventMaxWinCinematic
	| EmitterEventSound
	| EmitterEventTransition
	| EmitterEventReplay
	| EmitterEventPlaque;
