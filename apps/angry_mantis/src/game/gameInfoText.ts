import config from './config';

// Verbatim Stake Engine template (docs: approval-guidelines/general-disclaimer).
export const DISCLAIMER =
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.';

export const RULES_SECTIONS = [
	{
		title: 'HOW TO PLAY',
		paragraphs: [
			'Choose a bet and press SPIN (or the spacebar). Wins are formed by matching symbols on adjacent reels from left to right, in any row — 1,024 ways to win. Only the highest win per symbol is paid.',
			'Base game wins are capped at 250x the bet per spin. The total payout of any round is capped at 20,000x the bet.',
		],
	},
	{
		title: 'FREE SPINS',
		paragraphs: [
			`3 Marky scatters award ${config.freeSpins.free} Free Spins hosted by Marty. 4 scatters award ${config.freeSpins.super} Super Free Spins hosted by Marky. 5 scatters award ${config.freeSpins.feast} Mantis Feast spins with both mantises.`,
			'When a session starts the host takes an opening bite (Mantis Feast: both mantises bite). Each bite eats the lowest-paying symbol still on the menu; that symbol is removed from the reels for the rest of the session, so the remaining symbols land more often and wins escalate.',
			'Every Glowing Leaf that lands during free spins is another Mantis Strike. If all eight paying symbols are eaten, the round pays the 20,000x max win immediately and the session ends.',
			`Each Marky scatter in free spins awards +1 extra spin, up to +${config.freeSpins.maxRetrigger} per session. Once the maximum extra spins have been awarded, Marky scatters stop appearing for the rest of the session.`,
			'Mantis Feast sessions pay a minimum of 300x the bet.',
		],
	},
	{
		title: 'ANTE BET',
		paragraphs: [
			'Ante Bet costs 2x the bet. A Marky scatter is locked onto reel 1 for every spin, so only two more scatters are needed to trigger a feature.',
		],
	},
	{
		title: 'BONUS BUY',
		paragraphs: [
			`Free Spins can be bought for ${config.betModes.bonus.cost}x the bet, Super Free Spins for ${config.betModes.super.cost}x and Mantis Feast for ${config.betModes.feast.cost.toLocaleString()}x. Bought features play exactly like naturally triggered ones.`,
		],
	},
	{
		title: 'SETTINGS',
		paragraphs: [
			'Autoplay requires confirmation before it starts and can be stopped at any time. Sound can be turned off in the settings menu. Spacebar spins.',
		],
	},
];
