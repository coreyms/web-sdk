import config from './config';
import { modeCost } from './betModeMeta';
import { soc } from './social';
import { FEATURE_MENU_NAME } from './constants';

// Verbatim Stake Engine template (docs: approval-guidelines/general-disclaimer).
export const DISCLAIMER =
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.';

// Final rules copy (2026-09-23), written against the shipped math: math-sdk/games/manticore_mayhem
// readme.txt "Rule pass 2" and library/configs. Numbers come from config.ts (which mirrors
// game_config.py) and prices from the RGS. The few game_config.py constants that config.ts does not
// carry are pinned here, each with its source name, so a math change has one place to look.
const STING_MAX_PER_SPIN = 5; // game_config.STING_MAX_PER_SPIN
const SWIPE_MAX_PER_SPIN = 'twice'; // game_config.SWIPE_MAX_PER_SPIN = 2
const MYSTERY_SCATTERS = 3; // game_config.MYSTERY_SCATTER_REELS (0, 1, 2): one per column
const MYSTERY_STINGS = { super: 2, epic: 3 }; // game_config.MYSTERY_STING_COUNT
// Feature rates against the Base Game (readme "FEATURE RATES AND MEANS AS SHIPPED"):
// Ante 1 in 60 / 400 / 2,400 vs base 1 in 300 / 2,000 / 12,000 is 5x on every tier;
// Super Ante Super 1 in 39 (51x base) and Epic 1 in 262 (46x base).
const ANTE_RATE = 'about five times';
const SUPER_ANTE_SUPER_RATE = 'about 50 times';
const SUPER_ANTE_EPIC_RATE = 'about 45 times';

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
const share = (x: number) => `${Math.round(x * 100)}%`;
const list = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

const MODE_RTP_LINE = Object.entries(config.betModes)
	.map(([key, m]) => `${MODE_NAMES[key] ?? key.toUpperCase()} ${pct(m.rtp)}`)
	.join(', ');
const RTP = pct(config.rtp);
const MAX_WIN = config.maxWin.toLocaleString();

// symbol names are Corey's open decision; read them, never write them into the prose
const SCATTER = config.symbols.S.name;
const SCATTERS = `${SCATTER}s`;
const WILD = config.symbols.W.name;
const LOW_NAMES = list(config.lowSymbols.map((k) => config.symbols[k].name));
const BANDS = list(config.paytableBands.map((b) => b.label));
// rows in the math are 0-7 top-down; players count from 1
const SWIPE_ROWS = list(config.swipeRows.map((r) => String(r + 1)));
const CAP_LOW = config.tileCap.bonus;
const CAP_HIGH = config.tileCap.super;

// `modalSection` is the GameInfoModal section id each block belongs with.
// A function, not a constant: the prices come from the authenticate response, which has only
// landed by the time the info modal is opened.
export const rulesSections = () => [
	{
		modalSection: 'clusters',
		title: 'HOW TO PLAY',
		paragraphs: [
			soc(
				`Choose a bet and press SPIN (or the spacebar). The board is ${config.numReels} columns by ${config.numRows[0]} rows. ${config.minCluster} or more matching symbols touching each other left, right, up or down form a cluster and pay. Diagonals do not count and there are no paylines.`,
				`Choose a play amount and press SPIN (or the spacebar). The board is ${config.numReels} columns by ${config.numRows[0]} rows. ${config.minCluster} or more matching symbols touching each other left, right, up or down form a cluster and win. Diagonals do not count and there are no lines.`,
			),
			soc(
				'Every winning cluster is removed, the symbols above it fall and new symbols drop in from the top. The board keeps paying and refilling until a spin has no clusters left. All wins of a spin are added together.',
				'Every winning cluster is removed, the symbols above it fall and new symbols drop in from the top. The board keeps winning and refilling until a spin has no clusters left. All wins of a spin are added together.',
			),
			`The ${WILD} is wild. It stands in for every symbol except the ${SCATTER} and has no value of its own. A wild can be part of two clusters at once and counts in both.`,
			soc(
				`All wins and prices in these rules are multiples of the bet. The total payout of any round is capped at ${MAX_WIN}x the bet.`,
				`All wins in these rules are multiples of the play amount. The total win of any round is capped at ${MAX_WIN}x the play amount.`,
			),
			// Stake wants the per-mode RTP inside HOW TO PLAY itself (creators' Discord, Corey 2026-09-02)
			`Return to player (RTP) by game mode: ${MODE_RTP_LINE}. Max win in every mode: ${MAX_WIN}x.`,
		],
	},
	{
		modalSection: 'paytable',
		title: soc('PAYTABLE', 'SYMBOLS'),
		paragraphs: [
			soc(
				`Each symbol pays by cluster size, in five bands: ${BANDS}. The paytable shows what each band pays at the current bet.`,
				`Each symbol wins by cluster size, in five bands: ${BANDS}. The Symbols table shows each band's value as a multiple of the play amount.`,
			),
			soc(
				'A cluster pays its table value multiplied by the sum of the multiplier tiles under it. A cluster with no tiles under it pays its table value once. For example, a cluster sitting on tiles of 2x, 4x and 8x pays its table value x14.',
				'A cluster wins its table value multiplied by the sum of the multiplier tiles under it. A cluster with no tiles under it wins its table value once. For example, a cluster sitting on tiles of 2x, 4x and 8x wins its table value x14.',
			),
			`The ${SCATTER} is the scatter. It has no value of its own. It awards the features.`,
		],
	},
	{
		modalSection: 'tiles',
		title: 'MULTIPLIER TILES',
		paragraphs: [
			`Every winning cluster lights the cells under it. A cold cell becomes a ${config.tileSeed}x multiplier tile and a lit cell doubles: 2x, 4x, 8x and on up the ladder. This happens on every winning cluster, in every mode.`,
			soc(
				'A cluster uses the tiles as they stand when it lands. The cells it covers step up after it pays. A wild shared by two clusters steps up once.',
				'A cluster uses the tiles as they stand when it lands. The cells it covers step up after it wins. A wild shared by two clusters steps up once.',
			),
			`The ladder stops at ${CAP_LOW}x in the Base Game, Ante, Super Ante and Free Spins, and at ${CAP_HIGH}x in Super Free Spins and Epic Free Spins.`,
			'Tiles reset at the start of every spin in the Base Game, Ante and Super Ante.',
			'When a spin triggers a feature, the tiles it lit stay on the board and carry into the feature. In Free Spins, Super Free Spins and Epic Free Spins the tiles then persist for every spin of the round.',
		],
	},
	{
		modalSection: 'tiles',
		title: 'THE MANTICORE',
		paragraphs: [
			`SWIPE: when a spin runs out of clusters, the Manticore's paw may clear rows ${SWIPE_ROWS} (counted from the top), up to ${SWIPE_MAX_PER_SPIN} per spin. Every cell it clears lights up if it was cold and doubles if it was lit, in every mode. ${SCATTERS} are never cleared. The board refills and play carries on.`,
			`STING: before the board is evaluated, the Manticore's tail may strike up to ${STING_MAX_PER_SPIN} times, one sting after another. A NORMAL STING turns one cell wild. A BIG STING turns a cross of five cells wild. A SUPER STING turns a 3x3 block of nine cells wild.`,
			`A spin has at most one big or super sting, and it is always the last sting of that spin. A big or super sting always completes at least one winning cluster. A normal sting has no such guarantee. No sting ever lands on a ${SCATTER}.`,
			'Normal stings can land in every spin except the Mystery spin. Big stings land only in Free Spins, Super Free Spins and Epic Free Spins. Super stings land only in Super Free Spins and Epic Free Spins.',
			`ROAR: in Super Free Spins and Epic Free Spins only, the Manticore may roar before the board is evaluated. Every low symbol (${LOW_NAMES}) is blown off the board and replaced. The multiplier tiles under them stay. A roar always comes before any stings.`,
			soc(
				`On some naturally triggered features in the Base Game, Ante and Super Ante, the board lands with one or more ${SCATTERS} hidden and the Manticore stings them in. Nothing is paid until the stings are done, and the stings do not change the result: those ${SCATTERS} were part of the spin all along. This never happens on a feature bought from the ${FEATURE_MENU_NAME} menu.`,
				`On some naturally triggered features in the Base Game, Ante and Super Ante, the board lands with one or more ${SCATTERS} hidden and the Manticore stings them in. Nothing is counted until the stings are done, and the stings do not change the result: those ${SCATTERS} were part of the spin all along. This never happens on a feature instantly triggered from the ${FEATURE_MENU_NAME} menu.`,
			),
		],
	},
	{
		modalSection: 'modes',
		title: 'FREE SPINS',
		paragraphs: [
			`${SCATTERS} trigger the features. 4 award ${config.freeSpins.bonus} Free Spins, 5 award ${config.freeSpins.super} Super Free Spins and 6 or more award ${config.freeSpins.epic} Epic Free Spins. They can land on the first board or drop in during cascades.`,
			`Only one ${SCATTER} can sit in a column at a time. In Super Ante, 4 ${SCATTERS} award Super Free Spins instead of Free Spins.`,
			`There are no retriggers. ${SCATTERS} do not land during a feature.`,
			'During a feature, Skip to Result ends the presentation and shows the final total. The outcome is unchanged.',
			`The tiles lit by the triggering spin carry into the feature and persist for every spin of the round. In Super Free Spins and Epic Free Spins the ladder runs to ${CAP_HIGH}x from the first free spin.`,
			soc(
				`EPIC FLOOR: an Epic Free Spins round triggered by ${SCATTERS} or bought directly always pays at least ${config.epicMinWin}x the bet from its free spins. A Mystery Epic has its own floor (see MYSTERY).`,
				`EPIC FLOOR: an Epic Free Spins round triggered by ${SCATTERS} or instantly triggered always wins at least ${config.epicMinWin}x the play amount from its free spins. A Mystery Epic has its own floor (see MYSTERY).`,
			),
		],
	},
	{
		modalSection: 'modes',
		title: soc('ANTE BET', 'ANTE MODE'),
		paragraphs: [
			soc(
				`Ante Bet costs ${modeCost('ANTE')}x the bet. Free Spins, Super Free Spins and Epic Free Spins each land ${ANTE_RATE} as often as in the Base Game. Everything else plays as in the Base Game.`,
				`Ante Mode is played for ${modeCost('ANTE')}x the play amount. Free Spins, Super Free Spins and Epic Free Spins each land ${ANTE_RATE} as often as in the Base Game. Everything else plays as in the Base Game.`,
			),
			soc(
				`Super Ante Bet costs ${modeCost('SUPER_ANTE')}x the bet. Regular Free Spins cannot trigger: 4 ${SCATTERS} award Super Free Spins instead. Super Free Spins land ${SUPER_ANTE_SUPER_RATE} as often as in the Base Game and Epic Free Spins ${SUPER_ANTE_EPIC_RATE} as often.`,
				`Super Ante Mode is played for ${modeCost('SUPER_ANTE')}x the play amount. Regular Free Spins cannot trigger: 4 ${SCATTERS} award Super Free Spins instead. Super Free Spins land ${SUPER_ANTE_SUPER_RATE} as often as in the Base Game and Epic Free Spins ${SUPER_ANTE_EPIC_RATE} as often.`,
			),
			`Both are activated from the ${FEATURE_MENU_NAME} menu and stay on until you switch them off.`,
		],
	},
	{
		modalSection: 'modes',
		title: soc('BONUS BUY', 'FEATURE MODES'),
		paragraphs: [
			soc(
				`The ${FEATURE_MENU_NAME} menu sells each feature directly: Free Spins for ${modeCost('BONUS')}x the bet, Super Free Spins for ${modeCost('SUPER')}x, Epic Free Spins for ${modeCost('EPIC')}x and a Mystery for ${modeCost('MYSTERY')}x.`,
				`Each feature can be instantly triggered from the ${FEATURE_MENU_NAME} menu: Free Spins for ${modeCost('BONUS')}x the play amount, Super Free Spins for ${modeCost('SUPER')}x, Epic Free Spins for ${modeCost('EPIC')}x and a Mystery for ${modeCost('MYSTERY')}x.`,
			),
			soc(
				`A bought feature starts with a spin that lands its ${SCATTERS}. That spin's clusters pay and the tiles it lights carry into the feature, exactly as on a natural trigger.`,
				`An instantly triggered feature starts with a spin that lands its ${SCATTERS}. That spin's clusters win and the tiles it lights carry into the feature, exactly as on a natural trigger.`,
			),
			soc(
				`Bought features follow the same rules as naturally triggered ones, but each mode is its own game: the odds of each outcome and the average win per round differ between a bought feature and a natural one, and every mode returns ${RTP} of what is bet in it.`,
				`Instantly triggered features follow the same rules as naturally triggered ones, but each mode is its own game: the odds of each outcome and the average win per round differ between an instantly triggered feature and a natural one, and every mode returns ${RTP} of what is played in it.`,
			),
		],
	},
	{
		modalSection: 'mystery',
		title: 'MYSTERY',
		paragraphs: [
			soc(
				`A Mystery costs ${modeCost('MYSTERY')}x the bet and is a real spin. ${MYSTERY_SCATTERS} ${SCATTERS} always land, one in each of the first ${MYSTERY_SCATTERS} columns. The Manticore then stings in ${MYSTERY_STINGS.super} more for Super Free Spins, ${MYSTERY_STINGS.epic} more for Epic Free Spins, or none.`,
				`A Mystery is played for ${modeCost('MYSTERY')}x the play amount and is a real spin. ${MYSTERY_SCATTERS} ${SCATTERS} always land, one in each of the first ${MYSTERY_SCATTERS} columns. The Manticore then stings in ${MYSTERY_STINGS.super} more for Super Free Spins, ${MYSTERY_STINGS.epic} more for Epic Free Spins, or none.`,
			),
			`Exactly ${share(config.mystery.nothing)} of Mysteries award no feature, ${share(config.mystery.super)} award Super Free Spins and ${share(config.mystery.epic)} award Epic Free Spins. A Mystery never awards regular Free Spins. These shares are fixed in the published math.`,
			soc(
				"A Mystery that awards no feature still plays its spin, and its clusters pay as normal, so a miss can still pay. When a feature is awarded, the spin's wins count toward the round and its tiles carry into the feature.",
				"A Mystery that awards no feature still plays its spin, and its clusters win as normal, so a miss can still win. When a feature is awarded, the spin's wins count toward the round and its tiles carry into the feature.",
			),
			`No wild stings land on the Mystery spin, and no further ${SCATTERS} can drop in during its cascades. The swipe can still fire.`,
			soc(
				`A Mystery that awards Epic Free Spins always pays at least ${config.mysteryEpicMinWin}x the bet for the whole round, the Mystery spin included.`,
				`A Mystery that awards Epic Free Spins always wins at least ${config.mysteryEpicMinWin}x the play amount for the whole round, the Mystery spin included.`,
			),
		],
	},
	{
		modalSection: 'modes',
		title: 'GAME MODES',
		paragraphs: Object.keys(config.betModes).map((key) =>
			soc(
				`${MODE_NAMES[key] ?? key}: costs ${modeCost(key)}x the bet. RTP ${pct(config.betModes[key as keyof typeof config.betModes].rtp)}. Max win ${MAX_WIN}x the bet.`,
				`${MODE_NAMES[key] ?? key}: played for ${modeCost(key)}x the play amount. RTP ${pct(config.betModes[key as keyof typeof config.betModes].rtp)}. Max win ${MAX_WIN}x the play amount.`,
			),
		),
	},
	{
		modalSection: 'maxwin',
		title: 'MAX WIN',
		paragraphs: [
			soc(
				`The maximum win is ${MAX_WIN}x the bet in every mode. The moment a round's total reaches it, the round ends and ${MAX_WIN}x is paid. Any free spins left in that round are not played.`,
				`The maximum win is ${MAX_WIN}x the play amount in every mode. The moment a round's total reaches it, the round ends and ${MAX_WIN}x is won. Any free spins left in that round are not played.`,
			),
		],
	},
	{
		modalSection: 'rtp',
		title: 'RTP',
		paragraphs: [
			`Every game mode has a theoretical return to player of ${RTP}. RTP is calculated over a very large number of rounds. A single session can return much more or much less.`,
		],
	},
	{
		modalSection: 'rules',
		title: 'SETTINGS',
		paragraphs: [
			'Autoplay requires confirmation before it starts and can be stopped at any time. Sound can be turned off in the settings menu. Spacebar spins.',
		],
	},
	{
		modalSection: 'version',
		title: 'VERSION',
		paragraphs: [`Game version ${__APP_VERSION__}. Math version ${config.mathVersion}.`],
	},
];
