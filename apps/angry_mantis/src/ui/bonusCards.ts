import { stamp } from '../game/assets';
// Card art/tones for the bonus-buy modal (from the design's BONUS_OPTIONS). Cost multipliers come from
// betModeMeta / config so the modal can never disagree with the math.
import config from '../game/config';
import { soc } from '../game/social';

export type BonusCardSpec = {
	mode: 'ANTE' | 'BONUS' | 'SUPER' | 'FEAST';
	label: string;
	image: string;
	description: string;
	/** one-sentence "how it works" line (sentence case, shown under the tagline) */
	detail: string;
	cta: string;
	toggle: boolean;
	tone: { tab: string; body: string; accent: string; accent2?: string; dual?: boolean };
};

export const BONUS_CARDS: BonusCardSpec[] = [
	{
		mode: 'ANTE',
		detail: soc(
			'Costs 2× the bet — with Marky locked on reel 1, only two more scatters are needed to trigger a feature.',
			'Doubles the play amount — with Marky locked on reel 1, only two more scatters are needed to trigger a feature.',
		),
		label: 'ANTE',
		image: stamp('/assets/ui/label-ante.webp'),
		description: 'MARKY LOCKED ON REEL 1 EVERY SPIN',
		cta: 'ACTIVATE',
		toggle: true,
		tone: { tab: '#2a1f12', body: '#16100a', accent: '#e8b04a' },
	},
	{
		mode: 'BONUS',
		detail: soc(
			'Every Dinner Leaf is a Mantis Strike: Marty eats the lowest-paying symbol left and it leaves the reels, so wins escalate.',
			'Every Dinner Leaf is a Mantis Strike: Marty eats the lowest-value symbol left and it leaves the reels, so wins escalate.',
		),
		label: 'BONUS',
		image: stamp('/assets/ui/label-bonus.webp'),
		description: `${config.freeSpins.free} FREE SPINS, MARTY EATS SYMBOLS`,
		cta: 'LOAD',
		toggle: false,
		tone: { tab: '#142a10', body: '#08160a', accent: '#9CD92F' },
	},
	{
		mode: 'SUPER',
		detail: 'Two extra spins on leaf-richer reels — Marky strikes more often, clearing the menu faster.',
		label: 'SUPER',
		image: stamp('/assets/ui/label-super.webp'),
		description: `${config.freeSpins.super} SPINS, MARKY FEEDS HARDER`,
		cta: 'LOAD',
		toggle: false,
		tone: { tab: '#2e0e0a', body: '#160604', accent: '#C53C24' },
	},
	{
		mode: 'FEAST',
		detail: 'Both mantises bite at the start and strike together — eat all eight symbols for the 20,000× max win.',
		label: 'FEAST',
		image: stamp('/assets/ui/label-feast.webp'),
		description: 'MARTY & MARKY, MAXIMUM HUNGER',
		cta: 'LOAD',
		toggle: false,
		tone: { tab: '#2e0e0a', body: '#091a0c', accent: '#C53C24', accent2: '#9CD92F', dual: true },
	},
];
