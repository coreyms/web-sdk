// Card art/tones for the bonus-buy modal (from the design's BONUS_OPTIONS). Cost multipliers come from
// betModeMeta / config so the modal can never disagree with the math.
import config from '../game/config';

export type BonusCardSpec = {
	mode: 'ANTE' | 'BONUS' | 'SUPER' | 'FEAST';
	label: string;
	image: string;
	description: string;
	cta: string;
	toggle: boolean;
	tone: { tab: string; body: string; accent: string; accent2?: string; dual?: boolean };
};

export const BONUS_CARDS: BonusCardSpec[] = [
	{
		mode: 'ANTE',
		label: 'ANTE',
		image: '/assets/ui/label-ante.webp',
		description: 'MARKY LOCKED ON REEL 1 EVERY SPIN',
		cta: 'ACTIVATE',
		toggle: true,
		tone: { tab: '#2a1f12', body: '#16100a', accent: '#e8b04a' },
	},
	{
		mode: 'BONUS',
		label: 'BONUS',
		image: '/assets/ui/label-bonus.webp',
		description: `${config.freeSpins.free} FREE SPINS, MARTY EATS SYMBOLS`,
		cta: 'PLAY',
		toggle: false,
		tone: { tab: '#142a10', body: '#08160a', accent: '#9CD92F' },
	},
	{
		mode: 'SUPER',
		label: 'SUPER',
		image: '/assets/ui/label-super.webp',
		description: `${config.freeSpins.super} SPINS, MARKY FEEDS HARDER`,
		cta: 'PLAY',
		toggle: false,
		tone: { tab: '#2e0e0a', body: '#160604', accent: '#C53C24' },
	},
	{
		mode: 'FEAST',
		label: 'FEAST',
		image: '/assets/ui/label-feast.webp',
		description: 'MARTY & MARKY, MAXIMUM HUNGER',
		cta: 'PLAY',
		toggle: false,
		tone: { tab: '#2e0e0a', body: '#091a0c', accent: '#C53C24', accent2: '#9CD92F', dual: true },
	},
];
