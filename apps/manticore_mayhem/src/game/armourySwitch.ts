// THE ARMOURY'S SWITCH (spec feedback/armoury_build_r1 section 9, commits 4 to 9). `?armoury=1` mounts the new feature
// menu (ui/armoury/Armoury.svelte) where it has a layout built, and with a mode on the HUD's feature button OPENS the
// menu on that mode (owner 2026-10-13 22:18, answer 1) instead of switching the mode off.
// It works where the measurement tools do (game/staging.ts STAGING_TOOLS): the dev server, and a staging build made
// with PUBLIC_STAGING=1 (owner 2026-10-14 10:58: the new menu may be tried on staging). In a production build
// STAGING_TOOLS is a constant false, so this is a constant false too, the bundler drops the URL read, and
// scripts/check-production-bundle.mjs fails a build in which an `armoury` parameter read survives.
// Without the flag, and always in production, the game is exactly as before: the old menu (ui/BonusBuyModal.svelte)
// and the old button. Deleted in the switch-over commit (10).
import { STAGING_TOOLS } from './staging';

export const ARMOURY_SWITCH: boolean =
	STAGING_TOOLS && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('armoury') === '1';
