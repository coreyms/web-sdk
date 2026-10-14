// THE ARMOURY'S SWITCH (spec feedback/armoury_build_r1 section 9). ON BY DEFAULT in every build, dev, staging and
// production (owner 2026-10-14 12:06: "I just want the new armoury to be the default where applicable"): the new feature
// menu (ui/armoury/Armoury.svelte) shows wherever it has a layout built (the desktop layout today; ui/Chrome.svelte
// armouryTakes), and there, with a mode on, the HUD's feature button OPENS the menu on that mode (owner 2026-10-13
// 22:18, answer 1) instead of switching the mode off (ui/controls.svelte.ts bonusPress keys on armouryView.takes).
// Wherever the Armoury has no layout yet (portrait phone, tablet, sideways, the small 16:9 frames) the old menu
// (ui/BonusBuyModal.svelte) and the old button behaviour stay, until part C builds those layouts.
//
// THE ESCAPE HATCH, for comparison: `?armoury=0` turns it off, but ONLY where the measurement tools are
// (game/staging.ts STAGING_TOOLS: the dev server and a PUBLIC_STAGING=1 build). In a production build STAGING_TOOLS is a
// constant false, so this is a constant true, the bundler drops the URL read, and scripts/check-production-bundle.mjs
// fails a build in which an `armoury` parameter read survives (and, with --expect-staging, finds the read in a staging
// build). `?armoury=1` is the default and changes nothing.
// The switch, the old menu's files and this file go in the switch-over (part D), once every layout has the Armoury.
import { STAGING_TOOLS } from './staging';

export const ARMOURY_SWITCH: boolean = !(STAGING_TOOLS && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('armoury') === '0');
