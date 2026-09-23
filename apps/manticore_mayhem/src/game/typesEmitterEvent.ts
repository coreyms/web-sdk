import type { EmitterEventBoard } from '../components/Board.svelte';
import type { EmitterEventSpinWin } from '../components/SpinWin.svelte';
import type { EmitterEventModePlaque } from '../components/ModePlaque.svelte';
import type { EmitterEventWin } from '../components/Win.svelte';
import type { EmitterEventFreeSpinOutro } from '../components/FreeSpinOutro.svelte';
import type { EmitterEventSound } from '../components/Sound.svelte';
import type { EmitterEventTransition } from '../components/Transition.svelte';
import type { EmitterEventReplay } from '../ui/ReplayModal.svelte';

export type EmitterEventGame =
	| EmitterEventBoard
	| EmitterEventSpinWin
	| EmitterEventModePlaque
	| EmitterEventWin
	| EmitterEventFreeSpinOutro
	| EmitterEventSound
	| EmitterEventTransition
	| EmitterEventReplay;
