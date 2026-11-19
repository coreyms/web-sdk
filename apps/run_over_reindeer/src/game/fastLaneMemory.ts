// THE FAST LANE REMEMBERS THE LAST TILE (Corey 2026-11-19: "have the fast lane remember which option the player used
// last and open back up to that, for each individual browsing session. Default is right, but if I select super free
// spins, it should open to that next time."). Kept in memory only: it lasts as long as this page does and a fresh load
// starts on the default again (the Ante tile at its lowest level). A mode that is ON or loaded still wins on open: the
// menu shows what is active before it shows what was looked at last (ui/FeatureMenu.svelte).
export type FastLanePick = 'ANTE' | 'BONUS' | 'SUPER';

export const fastLaneMemory: { pick: FastLanePick | null; stop: number | null } = { pick: null, stop: null };
