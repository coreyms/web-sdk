// Feature-menu cards on black glass (the Angry Mantis "Chow Line" anatomy, re-skinned Persian):
// every option shares one shape — name pill, one-line pitch, volatility bar, price, CTA. Only the
// mode colour changes. Cost multipliers come from betModeMeta / config so the modal can never
// disagree with the math.
//
// The menu's NAME is FEATURE_MENU_NAME in game/constants.ts: THE ARMOURY (Corey 2026-10-13; BAZAAR was the
// placeholder). This is the OLD menu, kept as the default until THE ARMOURY replaces it (ui/armoury/, spec
// ~/Desktop/Manticore Mayhem/feedback/armoury_build_r1/SPEC.md commit 10).
//
// THE PITCHES AGREE WITH THE RULES PAGE (game/gameInfoText.ts, approved 2026-10-14) while this menu lives: Ante names
// all three features; Super Ante says what 4 scatters award; the tiles "double up to" their cap; the Epic floor names
// its base and shows the live amount (social: "play amount"); the Mystery Epic's own floor is stated nowhere.
// No em dashes; the social wording never says bet / buy / pay / cost / price.
import config from '../game/config';
import { modeShortLabel } from '../game/betModeMeta';
import { soc } from '../game/social';

const SCATTERS = `${config.symbols.S.name}s`;
const share = (x: number) => Math.round(x * 100);

export type BonusCardSpec = {
	mode: 'ANTE' | 'SUPER_ANTE' | 'BONUS' | 'SUPER' | 'EPIC' | 'MYSTERY';
	/** name-pill copy — literal so it reads instantly */
	label: string;
	/** the pitch under the pill. `amount(x)`: x times the current bet in the session's currency (the Epic floor) */
	pitch: (amount: (x: number) => string) => string;
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
		label: modeShortLabel('ANTE'),
		pitch: () => 'Free Spins, Super Free Spins and Epic Free Spins each land about five times as often as in the Base Game.',
		cta: 'ACTIVATE',
		toggle: true,
		accent: '#e0b64a',
		volatility: 2,
	},
	{
		mode: 'SUPER_ANTE',
		label: modeShortLabel('SUPER_ANTE'),
		pitch: () => `Only Super and Epic Free Spins can trigger: 4 ${SCATTERS} award Super Free Spins instead.`,
		cta: 'ACTIVATE',
		toggle: true,
		accent: '#e08a3c',
		volatility: 3,
	},
	{
		mode: 'BONUS',
		label: modeShortLabel('BONUS'), // BONUS, as on the HUD and the Spin button (was FREE SPINS: Engine self-check [225])
		pitch: () => `${config.freeSpins.bonus} spins. Multiplier Tiles persist all round and double up to ${config.tileCap.bonus}x.`,
		cta: 'ACTIVATE',
		toggle: false,
		accent: '#2eb0a8',
		volatility: 2,
	},
	{
		mode: 'SUPER',
		label: modeShortLabel('SUPER'),
		pitch: () => `${config.freeSpins.super} spins. Tiles persist and double up to ${config.tileCap.super}x. The roar clears the low symbols and a Super Sting is possible.`,
		cta: 'ACTIVATE',
		toggle: false,
		accent: '#7fb6ff',
		volatility: 3,
	},
	{
		mode: 'EPIC',
		label: modeShortLabel('EPIC'),
		pitch: (amount) =>
			soc(
				`${config.freeSpins.epic} spins. Tiles double up to ${config.tileCap.epic}x, Super Stings are common, and every round returns at least ${config.epicMinWin}x your bet (${amount(config.epicMinWin)}).`,
				`${config.freeSpins.epic} spins. Tiles double up to ${config.tileCap.epic}x, Super Stings are common, and every round returns at least ${config.epicMinWin}x your play amount (${amount(config.epicMinWin)}).`,
			),
		cta: 'ACTIVATE',
		toggle: false,
		accent: '#ff6a4a',
		volatility: 4,
	},
	{
		mode: 'MYSTERY',
		label: modeShortLabel('MYSTERY'),
		pitch: () => `${share(config.mystery.nothing)}% no feature, ${share(config.mystery.super)}% Super, ${share(config.mystery.epic)}% Epic. Never a regular Free Spins round.`,
		cta: 'ACTIVATE',
		toggle: false,
		accent: '#b07fe0',
		volatility: 4,
	},
];
