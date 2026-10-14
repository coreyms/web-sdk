// THE ARMOURY'S DEV SWITCH (spec feedback/armoury_build_r1 section 9, commits 4 to 9). `?armoury=1` on a DEV build
// mounts the new feature menu (ui/armoury/Armoury.svelte) where it has a layout built, and with a mode on the HUD's
// feature button OPENS the menu on that mode (owner 2026-10-13 22:18, answer 1) instead of switching the mode off.
// Without the flag, and on every production or staging build (import.meta.env.DEV is false there), the game is exactly
// as before: the old menu (ui/BonusBuyModal.svelte) and the old button. Deleted in the switch-over commit (10).
export const ARMOURY_SWITCH: boolean =
	import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('armoury') === '1';
