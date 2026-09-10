// Chow Line cards on black glass (Corey's pick, 2026-09-09): every option shares one anatomy —
// name pill → one-line pitch → volatility bar → price → CTA. Only the mode colour changes. No
// header art (the mantis heads and the scatter tile came off the same day). Cost multipliers come
// from betModeMeta / config so the modal can never disagree with the math.
import config from '../game/config';

export type BonusCardSpec = {
	mode: 'ANTE' | 'BONUS' | 'SUPER' | 'MYSTERY';
	/** name-pill copy — literal so it reads instantly */
	label: string;
	/** one-line pitch under the pill */
	pitch: string;
	cta: string;
	/** ante is a toggle armed straight from the card; the others confirm first */
	toggle: boolean;
	/** the mode colour: pill, bar, button (the Game Info palette, one colour per mode) */
	accent: string;
	/** volatility bar, 1..4 segments */
	volatility: 1 | 2 | 3 | 4;
};

export const BONUS_CARDS: BonusCardSpec[] = [
	{
		mode: 'ANTE',
		label: 'ANTE',
		pitch: 'Marky locked on reel 1 every spin, so only two more scatters are needed to trigger a feature.',
		cta: 'ACTIVATE',
		toggle: true,
		accent: '#ffdc4a',
		volatility: 3,
	},
	{
		mode: 'BONUS',
		label: 'BONUS',
		pitch: `${config.freeSpins.free} free spins. Every Service Bell rings for a Mantis Strike: Marty eats the lowest symbol and it never returns.`,
		cta: 'ACTIVATE',
		toggle: false,
		accent: '#9cd92f',
		volatility: 2,
	},
	{
		mode: 'SUPER',
		label: 'SUPER',
		pitch: `${config.freeSpins.super} spins on bell-richer reels, so Marky strikes more often and clears the menu faster.`,
		cta: 'ACTIVATE',
		toggle: false,
		accent: '#ff8a70',
		volatility: 3,
	},
	{
		mode: 'MYSTERY',
		label: 'MYSTERY',
		pitch: `One spin: ${config.mystery.super * 100}% Super Free Spins, ${config.mystery.feast * 100}% Mantis Feast (never under ${config.feastMinWin}x), ${config.mystery.nothing * 100}% empty tray.`,
		cta: 'ACTIVATE',
		toggle: false,
		accent: '#7fb6ff',
		volatility: 4,
	},
];
