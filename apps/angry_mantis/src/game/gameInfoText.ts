import config from './config';
import { soc } from './social';

// Verbatim Stake Engine template (docs: approval-guidelines/general-disclaimer).
export const DISCLAIMER =
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.';

const MODE_NAMES: Record<string, string> = { base: 'Base Game', ante: 'Ante', bonus: 'Free Spins', super: 'Super Free Spins', feast: 'Mantis Feast' };
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const MODE_RTP_LINE = Object.entries(config.betModes)
	.map(([key, m]) => `${MODE_NAMES[key] ?? key.toUpperCase()} ${pct(m.rtp)}`)
	.join(', ');

export const RULES_SECTIONS = [
	{
		title: 'HOW TO PLAY',
		paragraphs: [
			soc(
				'Choose a bet and press SPIN (or the spacebar). Wins are formed by matching symbols on adjacent reels from left to right, in any row — 1,024 ways to win. Only the highest win per symbol is paid.',
				'Choose a play amount and press SPIN (or the spacebar). Wins are formed by matching symbols on adjacent reels from left to right, in any row — 1,024 ways to win. Only the highest win per symbol counts.',
			),
			soc(
				'Base game wins are capped at 250x the bet per spin. The total payout of any round is capped at 20,000x the bet.',
				'Base game wins are capped at 250x the play amount per spin. The total win of any round is capped at 20,000x the play amount.',
			),
			// Stake requires the per-mode RTP inside HOW TO PLAY itself (creators' Discord, Corey 2026-09-02),
			// not only in the GAME MODES / RTP sections
			`Return to player (RTP) by game mode: ${MODE_RTP_LINE}. Max win in every mode: ${config.maxWin.toLocaleString()}x.`,
		],
	},
	{
		title: 'FREE SPINS',
		paragraphs: [
			`3 Marky scatters award ${config.freeSpins.free} Free Spins hosted by Marty. 4 scatters award ${config.freeSpins.super} Super Free Spins hosted by Marky. 5 scatters award ${config.freeSpins.feast} Mantis Feast spins with both mantises.`,
			soc(
				'When a session starts the host takes an opening bite (Mantis Feast: both mantises bite). Each bite eats the lowest-paying symbol still on the menu; that symbol is removed from the reels for the rest of the session, so the remaining symbols land more often and wins escalate.',
				'When a session starts the host takes an opening bite (Mantis Feast: both mantises bite). Each bite eats the lowest-value symbol still on the menu; that symbol is removed from the reels for the rest of the session, so the remaining symbols land more often and wins escalate.',
			),
			soc(
				'Every Dinner Leaf that lands during free spins is another Mantis Strike. If all eight paying symbols are eaten, the round pays the 20,000x max win immediately and the session ends. The cap is also reached whenever wins in a session add up to 20,000x the bet; either way the round ends and the cap is paid.',
				'Every Dinner Leaf that lands during free spins is another Mantis Strike. If all eight menu symbols are eaten, the round wins the 20,000x max win immediately and the session ends. The cap is also reached whenever wins in a session add up to 20,000x the play amount; either way the round ends and the cap is won.',
			),
			`Each Marky scatter in free spins awards +1 extra spin, up to +${config.freeSpins.maxRetrigger} per session. Once the maximum extra spins have been awarded, Marky scatters stop appearing for the rest of the session.`,
		],
	},
	{
		title: soc('ANTE BET', 'ANTE MODE'),
		paragraphs: [
			soc(
				'Ante Bet costs 2x the bet. A Marky scatter is locked onto reel 1 for every spin, so only two more scatters are needed to trigger a feature.',
				'Ante Mode doubles the play amount. A Marky scatter is locked onto reel 1 for every spin, so only two more scatters are needed to trigger a feature.',
			),
		],
	},
	{
		title: soc('BONUS BUY', 'FEATURE MODES'),
		paragraphs: [
			soc(
				`Free Spins can be bought for ${config.betModes.bonus.cost}x the bet, Super Free Spins for ${config.betModes.super.cost}x and Mantis Feast for ${config.betModes.feast.cost.toLocaleString()}x. Bought features play exactly like naturally triggered ones.`,
				`Free Spins can be played directly for ${config.betModes.bonus.cost}x the play amount, Super Free Spins for ${config.betModes.super.cost}x and Mantis Feast for ${config.betModes.feast.cost.toLocaleString()}x. Instantly triggered features play exactly like naturally triggered ones.`,
			),
		],
	},
	{
		title: 'SETTINGS',
		paragraphs: [
			'Autoplay requires confirmation before it starts and can be stopped at any time. Sound can be turned off in the settings menu. Spacebar spins.',
		],
	},
];
