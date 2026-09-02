import { stamp } from '../game/assets';
// Bonus-buy "Meal Tickets" (Corey's Claude Design, 2026-09-02): every option shares one anatomy —
// art slot → name plate → one-line pitch → hunger meter → price stub → CTA. Only the skin is
// per-mode: accent pair, the art in the slot, the leaf-pip count. Cost multipliers come from
// betModeMeta / config so the modal can never disagree with the math.
import config from '../game/config';

export type BonusCardSpec = {
	mode: 'ANTE' | 'BONUS' | 'SUPER' | 'FEAST';
	/** name-plate copy — literal so it reads instantly */
	label: string;
	/** one-line pitch under the plate */
	pitch: string;
	cta: string;
	/** ante is a toggle armed straight from the card; the others confirm first */
	toggle: boolean;
	accent: string;
	accentDark: string;
	/** art in the slot above the ticket (breaks out of the top) */
	art: string;
	/** second head tucked behind the first (feast) */
	artB?: string;
	/** px the main art shifts right to make room for artB */
	shift: number;
	/** hunger meter = volatility, 1..4 leaf pips */
	hunger: 1 | 2 | 3 | 4;
	/** desktop ticket tilt, degrees */
	tilt: number;
	/** filter under the art */
	artShadow: string;
};

const HEAD_SHADOW = 'drop-shadow(0 12px 12px rgba(0,0,0,.6))';

export const BONUS_CARDS: BonusCardSpec[] = [
	{
		mode: 'ANTE',
		label: 'ANTE',
		pitch: 'Marky locked on reel 1 every spin — only two more scatters needed to trigger a feature.',
		cta: 'ACTIVATE',
		toggle: true,
		accent: '#f2c14e',
		accentDark: '#c98d13',
		art: stamp('/assets/ui/scatter-marky.webp'),
		shift: 0,
		hunger: 1,
		tilt: -2,
		artShadow: 'drop-shadow(0 16px 14px rgba(0,0,0,.75)) drop-shadow(0 0 18px rgba(242,193,78,.35))',
	},
	{
		mode: 'BONUS',
		label: 'BONUS',
		pitch: `${config.freeSpins.free} free spins. Every Dinner Leaf is a Mantis Strike — Marty eats the lowest symbol and it never returns.`,
		cta: 'ACTIVATE',
		toggle: false,
		accent: '#9bd62b',
		accentDark: '#5f9a12',
		art: stamp('/assets/characters/marty-headshot.webp'),
		shift: 0,
		hunger: 2,
		tilt: 1.5,
		artShadow: HEAD_SHADOW,
	},
	{
		mode: 'SUPER',
		label: 'SUPER',
		pitch: `${config.freeSpins.super} spins on leaf-richer reels — Marky strikes more often, clearing the menu faster.`,
		cta: 'ACTIVATE',
		toggle: false,
		accent: '#f0552e',
		accentDark: '#b8311a',
		art: stamp('/assets/characters/marky-headshot.webp'),
		shift: 0,
		hunger: 3,
		tilt: -1,
		artShadow: HEAD_SHADOW,
	},
	{
		mode: 'FEAST',
		label: 'FEAST',
		pitch: `${config.freeSpins.feast} free spins. Marty and Marky feast together, two symbols eaten at start. Eat eight symbols for Max Win.`,
		cta: 'ACTIVATE',
		toggle: false,
		accent: '#f2c14e',
		accentDark: '#c98d13',
		art: stamp('/assets/characters/marty-headshot.webp'),
		artB: stamp('/assets/characters/marky-headshot.webp'),
		shift: 34,
		hunger: 4,
		tilt: 2,
		artShadow: HEAD_SHADOW,
	},
];

/** leaf-pip colour — the same green on every ticket (the meter reads as one scale) */
export const HUNGER_LEAF = '#8ab52a';
