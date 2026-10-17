// THE PORTRAIT PHONE OPTIONS (branch portrait-glow-r1, for Corey to pick by looking): which creature dock and which logo
// place a portrait phone draws. Defaults are the shipped look (constants CREATURE.portraitDock.default,
// LOGO.portraitPhoneEdge.default); the DEV switches `__manticore.creaturePlace` (components/Background.svelte) and
// `__manticore.logoPlace` (components/Logo.svelte) turn them. Reactive, so the canvas and the HTML chrome follow at once.
import { CREATURE, LOGO, type CreatureDockKey } from './constants';

export const portraitOptions = $state({
	creature: CREATURE.portraitDock.default as CreatureDockKey,
	logo: LOGO.portraitPhoneEdge.default as 'current' | 'edge',
});
