import config from './config';
import { modeCost } from './betModeMeta';
import { soc } from './social';
import { FEATURE_MENU_NAME } from './constants';

// Verbatim Stake Engine template (docs: approval-guidelines/general-disclaimer).
export const DISCLAIMER =
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.';

// ================================================================================================
// DRAFT COPY — milestone 1.
// The STRUCTURE is right and every number is read from the published math (config.ts mirrors
// game_config.py, prices come from the RGS). The WORDING has not been through Corey or a Stake
// review yet: each section is flagged so nothing here is mistaken for approved text.
// ================================================================================================
const DRAFT = '[DRAFT] ';

const MODE_NAMES: Record<string, string> = {
	base: 'Base Game',
	ante: 'Ante',
	super_ante: 'Super Ante',
	bonus: 'Free Spins',
	super: 'Super Free Spins',
	epic: 'Epic Free Spins',
	mystery: 'Mystery',
};
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const MODE_RTP_LINE = Object.entries(config.betModes)
	.map(([key, m]) => `${MODE_NAMES[key] ?? key.toUpperCase()} ${pct(m.rtp)}`)
	.join(', ');

// A function, not a constant: the buy prices come from the authenticate response, which has only
// landed by the time the info modal is opened.
export const rulesSections = () => [
	{
		title: 'HOW TO PLAY',
		paragraphs: [
			DRAFT +
				soc(
					`Choose a bet and press SPIN (or the spacebar). ${config.minCluster} or more matching symbols touching each other left, right, up or down form a cluster and pay. Only whole clusters pay; a symbol belongs to one cluster at a time.`,
					`Choose a play amount and press SPIN (or the spacebar). ${config.minCluster} or more matching symbols touching each other left, right, up or down form a cluster and pay. Only whole clusters pay; a symbol belongs to one cluster at a time.`,
				),
			DRAFT +
				'Winning clusters are removed and the board refills from above. The board keeps paying and refilling until a spin has no clusters left.',
			DRAFT +
				soc(
					`The total payout of any round is capped at ${config.maxWin.toLocaleString()}x the bet.`,
					`The total win of any round is capped at ${config.maxWin.toLocaleString()}x the play amount.`,
				),
			`Return to player (RTP) by game mode: ${MODE_RTP_LINE}. Max win in every mode: ${config.maxWin.toLocaleString()}x.`,
		],
	},
	{
		title: 'MULTIPLIER TILES',
		paragraphs: [
			DRAFT +
				'Every winning cluster lights the cells under it. A cold cell lights up as a 2x multiplier tile, and a cell that is already lit doubles: 2x, 4x, 8x and on up the ladder. This happens on every winning cluster, in every mode.',
			DRAFT +
				'The multiplier tiles under a winning cluster are ADDED TOGETHER, and the cluster pays its table value multiplied by that sum. A cluster with no tiles under it pays its table value once.',
			DRAFT +
				"The manticore's swipe works the same way: every cell the paw clears lights up if it was cold and doubles if it was already lit, in every mode.",
			DRAFT +
				`Tiles reset every spin in the Base Game, Ante and Super Ante. When a spin awards a feature, the tiles it lit stay on the board and carry into the feature, where they persist for the whole round. The ladder stops at ${config.tileCap.bonus}x in the Base Game, Ante, Super Ante and Free Spins, and at ${config.tileCap.super}x in Super Free Spins and Epic Free Spins.`,
		],
	},
	{
		title: 'THE MANTICORE',
		paragraphs: [
			DRAFT +
				`SWIPE: when a spin runs out of clusters, the manticore's paw may clear rows ${config.swipeRows.join(', ')} of the board and double the multiplier tiles in them before the board refills. Play then carries on from the new board.`,
			DRAFT +
				'STING: the tail strikes the board before it is evaluated, up to five times in one spin. A NORMAL STING turns one cell wild. A BIG STING turns a cross of five cells wild, and a SUPER STING turns a block of nine wild. A big or super sting is always the last sting of the spin and always completes at least one winning cluster. Big stings can land in Free Spins, Super Free Spins and Epic Free Spins; super stings only in Super Free Spins and Epic Free Spins.',
			DRAFT +
				'The tail can also sting War Standards onto a board that has come to rest, to complete a feature that the spin was one or more standards short of.',
			DRAFT +
				'ROAR: every low symbol is blown off the board and replaced. Multiplier tiles under them are not affected. Super Free Spins and Epic Free Spins only.',
		],
	},
	{
		title: 'FREE SPINS',
		paragraphs: [
			DRAFT +
				`4 War Standards award ${config.freeSpins.bonus} Free Spins, 5 award ${config.freeSpins.super} Super Free Spins and 6 award ${config.freeSpins.epic} Epic Free Spins. In Super Ante, 4 standards upgrade to a Super.`,
			DRAFT +
				'There are no retriggers and no War Standards land during a feature. Only one War Standard can sit in a column at a time. The multiplier tiles lit by the triggering spin carry into the feature and persist for the whole round.',
			DRAFT +
				soc(
					`Every Epic Free Spins round pays at least ${config.epicMinWin}x the bet.`,
					`Every Epic Free Spins round wins at least ${config.epicMinWin}x the play amount.`,
				),
		],
	},
	{
		title: soc('ANTE BET', 'ANTE MODE'),
		paragraphs: [
			DRAFT +
				soc(
					`Ante Bet costs ${modeCost('ANTE')}x the bet. Free Spins and Super Free Spins land about five times as often as in the base game.`,
					`Ante Mode is played for ${modeCost('ANTE')}x the play amount. Free Spins and Super Free Spins land about five times as often as in the base game.`,
				),
			DRAFT +
				soc(
					`Super Ante Bet costs ${modeCost('SUPER_ANTE')}x the bet. Regular Free Spins cannot trigger at all: only Super Free Spins and Epic Free Spins, and 4 standards upgrade to a Super.`,
					`Super Ante Mode is played for ${modeCost('SUPER_ANTE')}x the play amount. Regular Free Spins cannot trigger at all: only Super Free Spins and Epic Free Spins, and 4 standards upgrade to a Super.`,
				),
		],
	},
	{
		title: soc('BONUS BUY', 'FEATURE MODES'),
		paragraphs: [
			DRAFT +
				soc(
					`The ${FEATURE_MENU_NAME} menu offers Free Spins for ${modeCost('BONUS')}x the bet, Super Free Spins for ${modeCost('SUPER')}x and Epic Free Spins for ${modeCost('EPIC')}x.`,
					`The ${FEATURE_MENU_NAME} menu offers Free Spins for ${modeCost('BONUS')}x the play amount, Super Free Spins for ${modeCost('SUPER')}x and Epic Free Spins for ${modeCost('EPIC')}x.`,
				),
			DRAFT +
				soc(
					`Mystery costs ${modeCost('MYSTERY')}x the bet and never awards a regular Free Spins round: ${config.mystery.nothing * 100}% award nothing at all, ${config.mystery.super * 100}% award Super Free Spins and ${config.mystery.epic * 100}% award Epic Free Spins. A Mystery Epic always pays at least ${config.mysteryEpicMinWin}x the bet.`,
					`Mystery is played for ${modeCost('MYSTERY')}x the play amount and never awards a regular Free Spins round: ${config.mystery.nothing * 100}% award nothing at all, ${config.mystery.super * 100}% award Super Free Spins and ${config.mystery.epic * 100}% award Epic Free Spins. A Mystery Epic always wins at least ${config.mysteryEpicMinWin}x the play amount.`,
				),
			DRAFT +
				'A Mystery is a real spin. Three War Standards always land, one in each of the first three columns, and the last five columns are played out one at a time. The manticore may then sting two more standards onto the board for Super Free Spins, or three more for Epic Free Spins. When it stings none, the spin is still a spin: its clusters are paid and its multiplier tiles count like any other.',
			DRAFT +
				soc(
					'Bought features follow the same rules as naturally triggered ones, but each mode is its own game: the odds of each outcome and the average win per round differ between a bought feature and a natural one, and every mode returns 96.70% of what is bet in it.',
					'Instantly triggered features follow the same rules as naturally triggered ones, but each mode is its own game: the odds of each outcome and the average win per round differ between an instantly triggered feature and a natural one, and every mode returns 96.70% of what is played in it.',
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
