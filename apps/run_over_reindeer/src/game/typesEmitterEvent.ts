import type { EmitterEventBoard } from '../components/Board.svelte';
import type { EmitterEventSound } from '../components/Sound.svelte';
import type { EmitterEventReplay } from '../ui/ReplayModal.svelte';

export type EmitterEventGame = EmitterEventBoard | EmitterEventSound | EmitterEventReplay;
