// Feature-menu cards on black glass (the Angry Mantis "Chow Line" anatomy, re-skinned Persian):
// every option shares one shape — name pill, one-line pitch, volatility bar, price, CTA. Only the
// mode colour changes. Cost multipliers come from betModeMeta / config so the modal can never
// disagree with the math.
//
// The menu's NAME is FEATURE_MENU_NAME in game/constants.ts (placeholder BAZAAR) — one constant,
// so Corey's final pick is one edit.
import config from '../game/config';

export type BonusCardSpec = {
	mode: 'ANTE' | 'SUPER_ANTE' | 'BONUS' | 'SUPER' | 'EPIC' | 'MYSTERY';
	/** name-pill copy — literal so it reads instantly */
	label: string;
	/** one-line pitch under the pill */
	pitch: string;
	cta: string;
	/** the two ante modes are toggles armed straight from the card; the buys confirm first */
	toggle: boolean;
	/** the mode colour: pill, bar, button */
	accent: string;
	/** volatility bar, 1..4 segments */
	volatility: 1 | 2 | 3 | 4;
};

export const BONUS_CARDS: BonusCardSpec[] = [
	{
		mode: 'ANTE',
		label: 'ANTE',
		pitch: 'Free Spins and Super Free Spins land about five times as often as in the base game.',
		cta: 'ACTIVATE',
		toggle: true,
		accent: '#e0b64a',
		volatility: 2,
	},
	{
		mode: 'SUPER_ANTE',
		label: 'SUPER ANTE',
		pitch: 'No regular Free Spins at all. Only Super and Epic, and four standards upgrade to a Super.',
		cta: 'ACTIVATE',
		toggle: true,
		accent: '#e08a3c',
		volatility: 3,
	},
	{
		mode: 'BONUS',
		label: 'FREE SPINS',
		pitch: `${config.freeSpins.bonus} spins. Multiplier tiles persist all round and double up to 64x.`,
		cta: 'ACTIVATE',
		toggle: false,
		accent: '#2eb0a8',
		volatility: 2,
	},
	{
		mode: 'SUPER',
		label: 'SUPER',
		pitch: `${config.freeSpins.super} spins on the 128x ladder. The roar clears the lows and a Super Sting is possible.`,
		cta: 'ACTIVATE',
		toggle: false,
		accent: '#7fb6ff',
		volatility: 3,
	},
	{
		mode: 'EPIC',
		label: 'EPIC',
		pitch: `${config.freeSpins.epic} spins, Super Stings are common, and every round returns at least ${config.epicMinWin}x.`,
		cta: 'ACTIVATE',
		toggle: false,
		accent: '#ff6a4a',
		volatility: 4,
	},
	{
		mode: 'MYSTERY',
		label: 'MYSTERY',
		pitch: `${config.mystery.nothing * 100}% nothing, ${config.mystery.super * 100}% Super, ${config.mystery.epic * 100}% Epic (never under ${config.mysteryEpicMinWin}x). Never a regular Free Spins round.`,
		cta: 'ACTIVATE',
		toggle: false,
		accent: '#b07fe0',
		volatility: 4,
	},
];
