import config from './config';
import { modeCost, modeShortLabel } from './betModeMeta';
import { soc } from './social';
import { FEATURE_MENU_NAME } from './constants';

// Verbatim Stake Engine template (docs: approval-guidelines/general-disclaimer).
export const DISCLAIMER =
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.';

// THE RULES PAGE'S TEXT (Game Info, ui/GameInfoModal.svelte). Build B2, 2026-10-14: the trimmed page Corey approved
// on 2026-10-13 (Desktop review folder feedback/rules_trim_r1: PROPOSAL.md, CHECK.md, his answers to QUESTIONS.md):
// eight sections, each fact stated once, where a player looks for it; the old "Game Rules" block is gone, its facts
// moved into the sections they belong to. His decisions: the seven cell RTP grid stays; the mode cards keep Enter /
// Spins / Mechanics; of the optional cuts, 1 (the low symbol names in the roar), 4 (the swipe's band odds), 8 ("a
// normal sting has no such guarantee") and 9 (the swipe on a Mystery spin). Cut 2 (drop the worked tile example) was
// on the list too, but he also said "keep the worked tile example and the tile timing rule" (QUESTIONS 12): the
// example stays. The Epic floor names its base and shows the live amount ("200x your bet ($20.00)", social "your play
// amount"); the Mystery Epic's own floor is stated nowhere (menu or rules); the menu is FEATURE_MENU_NAME everywhere,
// and that name carries its article ("in THE ARMOURY", never "the ... menu").
// Layout round 1 (Corey 2026-10-15): the cards' one meta line became three stat tiles (modes.stats), the intro gained
// the line that defines "your bet", and MECHANICS became WHAT'S DIFFERENT, its copy split into bullets at sentence
// boundaries with every sentence unchanged.
//
// COPY RULES: no em or en dash anywhere; social wording (soc second argument) never says bet / buy / bought / pay /
// cost / price: "play amount", "instantly triggered", "win", "value" (tools/manticore/rules_probe.js sweeps both).
// `**word**` marks a keyword set in bold (the page renders it as <strong>, never as HTML).
//
// Numbers come from config.ts (which mirrors game_config.py) and prices from the RGS (modeCost). The few
// game_config.py constants that config.ts does not carry are pinned here, each with its source name.
const STING_MAX_PER_SPIN = 5; // game_config.STING_MAX_PER_SPIN
const SWIPE_MAX_PER_SPIN = 'twice'; // game_config.SWIPE_MAX_PER_SPIN = 2
const MYSTERY_SCATTERS = 3; // game_config.MYSTERY_SCATTER_REELS (0, 1, 2): one per column
const MYSTERY_STINGS = { super: 2, epic: 3 }; // game_config.MYSTERY_STING_COUNT
// Feature rates against the Base Game, measured on the 2026.10.16 books (feedback/math_reshape_r1/data/
// today_vs_new_real_books.md): base Free Spins / Super / Epic 1 in 363 / 2,432 / 13,911; Ante 1 in 64 / 379 / 2,372,
// which is 5.7x / 6.4x / 5.9x the base rate, so about six times on every tier; Super Ante Super 1 in 40 (60.8x base)
// and Epic 1 in 259 (53.7x base). (2026.10.15: Ante 5x, Super Ante 51x / 46x.)
const ANTE_RATE = 'about six times';
const SUPER_ANTE_SUPER_RATE = 'about 60 times';
const SUPER_ANTE_EPIC_RATE = 'about 55 times';
// THE FEATURE FLOORS (math 2026.10.16): the free spins of a Free Spins round total at least config.freeSpinsMinWin and of
// a Super round at least config.superMinWin, whatever started it (scatters, a buy, a Mystery: lowest live totals 10.0x
// and 25.0x on the books); the Epic as before. Each names its base and shows the live amount, like the Epic floor
const FS_FLOOR = config.freeSpinsMinWin;
const SUPER_FLOOR = config.superMinWin;

export const MODE_NAMES: Record<string, string> = {
	base: 'Base Game',
	ante: 'Ante',
	super_ante: 'Super Ante',
	bonus: 'Free Spins',
	super: 'Super Free Spins',
	epic: 'Epic Free Spins',
	mystery: 'Mystery',
};
export const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const share = (x: number) => `${Math.round(x * 100)}%`;

const MODE_RTP_LINE = Object.entries(config.betModes)
	.map(([key, m]) => `${MODE_NAMES[key] ?? key.toUpperCase()} ${pct(m.rtp)}`)
	.join(', ');
const RTP = pct(config.rtp);
const MAX_WIN = config.maxWin.toLocaleString();

// symbol names (Corey 2026-10-12: the wild is "Wild", the scatter "War Standard Scatter", the tiles "Multiplier Tiles");
// read them from config.ts, never write them into the prose
const SCATTER = config.symbols.S.name;
const SCATTERS = `${SCATTER}s`;
const WILD = config.symbols.W.name;
// the paw clears a band of adjacent rows; which rows is drawn per swipe (2026-10-06)
const SWIPE_BAND = { 1: 'one', 2: 'two', 3: 'three', 4: 'four' }[config.swipeBandRows] ?? String(config.swipeBandRows);
const CAP_LOW = config.tileCap.bonus;
const CAP_HIGH = config.tileCap.super;
const MENU = FEATURE_MENU_NAME;

/** one guide row's text, keyed by the row id GameInfoModal draws its icon for */
export type GuideId = 'spin' | 'turbo' | 'autoplay' | 'feature' | 'menu' | 'readouts' | 'keyboard' | 'skip' | 'screens';
/** THE OPERATOR'S SWITCHES the rules page follows (2026-10-15, approval review minor; front-end-communication.md:22):
 *  authenticate's jurisdiction block (stateConfig.jurisdiction), the same flags the controls read (ui/controls.svelte.ts,
 *  ui/Chrome*.svelte, stateGame skipAllowed). A control the operator turns off is neither drawn nor described: its UI
 *  guide row goes (guideRowShown) and no other sentence names it. */
export type RulesFlags = {
	disabledAutoplay?: boolean;
	disabledTurbo?: boolean;
	disabledSuperTurbo?: boolean;
	disabledSlamstop?: boolean;
	disabledSpacebar?: boolean;
	disabledBuyFeature?: boolean;
};
/** the UI guide's rows under the operator's switches: no Turbo row under disabledTurbo, no Autoplay row under
 *  disabledAutoplay, no feature menu row under disabledBuyFeature (their buttons are not drawn: ui/Chrome*.svelte), (Skip
 *  to Result keeps the SKIP button's own rule, stateGame skipAllowed: ui/GameInfoModal.svelte asks it). The Keyboard row stays under disabledSpacebar (Escape still closes a window); its text drops the Space bar */
export const guideRowShown = (id: GuideId, j: RulesFlags): boolean => {
	if (id === 'turbo') return !j.disabledTurbo;
	if (id === 'autoplay') return !j.disabledAutoplay;
	if (id === 'feature') return !j.disabledBuyFeature;
	return true;
};
/** "A and B" / "A" / "" */
const andList = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : (xs[0] ?? ''));

/**
 * Every string of the rules page. A function, not a constant: the prices come from the authenticate response
 * (landed by the time Game Info opens), and the Epic floor shows its live amount at the current bet.
 * `amount(x)`: x times the current bet in the session's currency (numberToCurrencyString; SC / GC in social).
 */
export const gameInfoText = (amount: (x: number) => string, j: RulesFlags = {}) => ({
	paytable: {
		intro: soc(
			"Each symbol pays by **cluster size**, in five bands. The table shows what each band pays at the current bet. A cluster's pay is multiplied by the **sum** of the Multiplier Tiles under it.",
			"Each symbol wins by **cluster size**, in five bands. The table shows each band's value as a multiple of the play amount. A cluster's win is multiplied by the **sum** of the Multiplier Tiles under it.",
		),
		specials: 'Special Symbols',
		wild: `Stands in for every symbol except the ${SCATTER} and has no value of its own. A ${WILD} can be part of two clusters at once and counts in both.`,
		scatter: `4 anywhere award ${config.freeSpins.bonus} Free Spins, 5 award ${config.freeSpins.super} Super Free Spins and 6 or more award ${config.freeSpins.epic} Epic Free Spins. In Super Ante, 4 award Super Free Spins instead. They can land on the first board or drop in during cascades, and only one can sit in a column at a time. No retriggers: none land during a feature. It has no value of its own.`,
	},
	guide: {
		intro: 'Controls are the same on desktop and phone. On portrait phones they sit under the reels.',
		rows: {
			// every sentence that names a control the operator can switch off is said only where it is on (RulesFlags).
			// STOP lands the result at once only with the slam stop AND turbo allowed (under disabledTurbo the press
			// lands nothing sooner: ui/controls.svelte.ts stopButtonClick)
			spin: {
				name: 'Spin',
				text: [
					'Plays one round at the SPIN amount.',
					!j.disabledSlamstop && !j.disabledTurbo ? 'While the reels drop it turns into **STOP**, which lands the result at once.' : '',
					((x) => (x ? `With ${x} loaded, it shows what the next press starts.` : ''))(
						[!j.disabledAutoplay ? 'Autoplay' : '', !j.disabledBuyFeature ? 'a feature' : ''].filter(Boolean).join(' or '),
					),
				]
					.filter(Boolean)
					.join(' '),
			},
			// disabledSuperTurbo: no Instant level (ui/controls.svelte.ts maxTurboLevel)
			turbo: {
				name: 'Turbo',
				text: j.disabledSuperTurbo
					? 'Switches between Off and Turbo. Turbo shortens the reel drop and the win presentation. Turbo and sound settings are remembered on this device.'
					: 'Cycles through Off, Turbo and Instant. Turbo shortens the reel drop and the win presentation. Instant (lightning icon) lands each result at once. Turbo and sound settings are remembered on this device.',
			},
			autoplay: {
				name: 'Autoplay',
				text: 'Opens the Autoplay ticket: the number of spins, plus an **ADVANCED** fold with a stop-on-loss limit, a stop-on-single-win limit, **Stop on Free Games** (autoplay ends when a feature triggers; the feature still plays out) and **Autoplay Bonuses** (feature screens continue on their own). **LOAD** parks the run on the Spin button. Spin starts it, and Spin again stops it at any time. During a run the Spin button is green with the spins left and this button is red with an X.',
			},
			feature: {
				name: soc('Bonus Buy', 'Feature Menu'),
				text: soc(
					`Opens ${MENU}: switch Ante Bet or Super Ante Bet on, or buy Free Spins, Super Free Spins, Epic Free Spins or a Mystery directly. A loaded feature is shown by its short name on the Spin button and on this button. Tap this button again to cancel it.`,
					`Opens ${MENU}: switch Ante Mode or Super Ante Mode on, or trigger Free Spins, Super Free Spins, Epic Free Spins or a Mystery instantly. A loaded feature is shown by its short name on the Spin button and on this button. Tap this button again to cancel it.`,
				),
			},
			menu: { name: 'Menu', text: 'Game Info (this screen), plus music and sound-effect volume sliders, each with a mute button. All sound can be turned off.' },
			readouts: {
				name: 'Readouts',
				text: soc(
					'**BALANCE** is your current balance. **WIN** is the running total of the round. **SPIN** is the full cost of one press in the active mode (base bet × the mode multiplier). − and + step through the bet menu. Tap the readout for the full bet picker. The plaque on the reel frame names the active mode and its price.',
					'**BALANCE** is your current balance. **WIN** is the running total of the round. **SPIN** is the full play amount of one press in the active mode (base amount × the mode multiplier). − and + step through the play amount menu. Tap the readout for the full picker. The plaque on the reel frame names the active mode and its play amount.',
				),
			},
			// disabledSpacebar: the Space bar plays nothing (ui/Chrome.svelte), so only Escape is left
			keyboard: {
				name: 'Keyboard',
				text: [
					j.disabledSpacebar
						? ''
						: ((x) => (x ? `Space bar plays a round. Hold it to keep playing (${x} ${x.includes(' and ') ? 'are' : 'is'} locked while it is held).` : 'Space bar plays a round. Hold it to keep playing.'))(
								andList([!j.disabledTurbo ? 'Turbo' : '', !j.disabledAutoplay ? 'Autoplay' : ''].filter(Boolean)),
							),
					'Escape closes any open window.',
				]
					.filter(Boolean)
					.join(' '),
			},
			// wording unchanged on purpose (an open question with Corey, 2026-10-14). The row is left out where the operator
			// disables the slam stop or turbo (stateGame skipAllowed; GameInfoModal filters it)
			skip: {
				name: 'Skip to Result',
				text: 'Shown during Free Spins, Super Free Spins and Epic Free Spins once the first free spin has started. Pressing it asks "Skip to result?". Yes ends the presentation of the remaining spins and shows the final total of the round. No closes the question and the spins play on. It never changes the result.',
			},
			// Autoplay Bonuses is a setting of the Autoplay ticket: not named under disabledAutoplay
			screens: {
				name: 'Feature screens',
				text: j.disabledAutoplay ? 'Feature intros and wrap-ups wait for a press anywhere.' : 'Feature intros and wrap-ups wait for a press anywhere. With **Autoplay Bonuses** on, they continue on their own.',
			},
		} satisfies Record<GuideId, { name: string; text: string }>,
	},
	howTo: [
		soc(
			`Choose a bet and press **SPIN**${j.disabledSpacebar ? '' : ' (or the space bar)'}. The board is ${config.numReels} columns by ${config.numRows[0]} rows. **${config.minCluster} or more** matching symbols touching each other left, right, up or down form a **cluster** and pay. Diagonals do not count. Position on the board does not matter and there are no paylines.`,
			`Choose a play amount and press **SPIN**${j.disabledSpacebar ? '' : ' (or the space bar)'}. The board is ${config.numReels} columns by ${config.numRows[0]} rows. **${config.minCluster} or more** matching symbols touching each other left, right, up or down form a **cluster** and win. Diagonals do not count. Position on the board does not matter and there are no lines.`,
		),
		'Every winning cluster is removed, the symbols above it fall and new symbols drop in from the top. This repeats until a spin has no clusters left. All wins of a spin are added together.',
		soc('All wins and prices in these rules are multiples of the bet.', 'All wins in these rules are multiples of the play amount.'),
		// Stake wants the per-mode RTP inside HOW TO PLAY itself (creators' Discord, Corey 2026-09-02)
		`Return to player (RTP) by game mode: ${MODE_RTP_LINE}. Max win in every mode: ${MAX_WIN}x.`,
	],
	modes: {
		intro: [
			soc(
				`Seven modes. Base, Ante and Super Ante are bet-by-bet. The features are entered by ${SCATTERS}, a direct bonus buy, or a Mystery.`,
				`Seven modes. Base, Ante and Super Ante run spin by spin. The features are entered by ${SCATTERS}, triggered instantly from ${MENU}, or served by a Mystery.`,
			),
			// the menu cards, the HUD label and the Spin button carry the SHORT names (betModeMeta.ts modeShortLabel)
			`In ${MENU}, on the Spin button and on the readout beside it, the features carry short names: ${modeShortLabel('BONUS')} is Free Spins, ${modeShortLabel('SUPER')} is Super Free Spins, ${modeShortLabel('EPIC')} is Epic Free Spins and ${modeShortLabel('MYSTERY')} is the Mystery.`,
			soc(
				`A bought feature starts with a spin that lands its ${SCATTERS}. That spin's clusters pay and the tiles it lights carry into the feature, exactly as on a natural trigger.`,
				`An instantly triggered feature starts with a spin that lands its ${SCATTERS}. That spin's clusters win and the tiles it lights carry into the feature, exactly as on a natural trigger.`,
			),
			soc(
				`Bought features follow the same rules as naturally triggered ones, but each mode is its own game: the odds of each outcome and the average win per round differ between a bought feature and a natural one, and every mode returns ${RTP} of what is bet in it.`,
				`Instantly triggered features follow the same rules as naturally triggered ones, but each mode is its own game: the odds of each outcome and the average win per round differ between an instantly triggered feature and a natural one, and every mode returns ${RTP} of what is played in it.`,
			),
			// what "your bet" on the cards means (Corey 2026-10-15): the amount the HUD's + and − set (StepButton draws the
			// true minus sign, U+2212, as here)
			soc(
				"Your bet is the amount you set with + and −. Every mode's cost is a multiple of it.",
				"Your play amount is the amount you set with + and −. Every mode's round is a multiple of it.",
			),
		],
		/** the three stat tiles of a mode card (Corey 2026-10-15): price, RTP, max win. The max win reads the same on both
		 *  sites: `MAX WIN 10,000×`, with `(3,333.3× THIS MODE)` under it on every mode that costs more than 1x */
		stats: {
			price: soc('COST', 'EACH ROUND'),
			priceUnit: soc('YOUR BET', 'YOUR PLAY AMOUNT'),
			rtp: 'RTP',
			maxWin: 'MAX WIN',
			thisMode: 'THIS MODE',
		},
		/** the card body's labels (drawn in capitals) */
		labels: { enter: 'How to enter', spins: 'Spins', mech: "What's different" },
		/** the seven cards' fields, keyed by config.betModes key. `mech` is the WHAT'S DIFFERENT bullets: the approved
		 *  mechanics copy split at its sentence boundaries, every sentence word for word (Corey 2026-10-15) */
		cards: {
			base: { enter: 'Default play.', spins: 'One spin per play.', mech: ['Multiplier Tiles reset every spin.', `${SCATTERS} trigger the features.`] },
			ante: {
				enter: `Switch on in ${MENU}; stays on until switched off.`,
				spins: 'One spin per play.',
				mech: [`Free Spins, Super Free Spins and Epic Free Spins each land ${ANTE_RATE} as often as in the Base Game.`, soc('The pays and every rule are the same as in the Base Game.', 'Symbol wins and every rule are the same as in the Base Game.')],
			},
			super_ante: {
				enter: `Switch on in ${MENU}; stays on until switched off.`,
				spins: 'One spin per play.',
				mech: [
					`Regular Free Spins cannot trigger: 4 ${SCATTERS} award Super Free Spins instead.`,
					`Super Free Spins land ${SUPER_ANTE_SUPER_RATE} as often as in the Base Game and Epic Free Spins ${SUPER_ANTE_EPIC_RATE} as often.`,
				],
			},
			bonus: {
				enter: soc(`Land 4 ${SCATTERS}, or buy directly.`, `Land 4 ${SCATTERS}, or trigger it instantly from ${MENU}.`),
				spins: `${config.freeSpins.bonus} free spins.`,
				// THE UPGRADE (2026-10-15, approval review minor): a bought round's trigger spin can land 5 or 6+ scatters
				// and so become Super or Epic Free Spins (1 in 105.6 / 1 in 35,904; a bought Super: Epic 1 in 1,108). No odds
				// are stated; the cards' spin count and cap are the round's as bought.
				mech: [
					`Multiplier Tiles **persist** for the whole round and double up to ${config.tileCap.bonus}×.`,
					soc(
						`**Free Spins floor:** a Free Spins round always pays at least **${FS_FLOOR}x your bet** (${amount(FS_FLOOR)}) from its free spins.`,
						`**Free Spins floor:** a Free Spins round always wins at least **${FS_FLOOR}x your play amount** (${amount(FS_FLOOR)}) from its free spins.`,
					),
					soc('A bought round can still upgrade to Super or Epic Free Spins.', 'An instantly triggered round can still upgrade to Super or Epic Free Spins.'),
				],
			},
			super: {
				enter: soc(`Land 5 ${SCATTERS}, or buy directly.`, `Land 5 ${SCATTERS}, or trigger it instantly from ${MENU}.`),
				spins: `${config.freeSpins.super} free spins.`,
				mech: [
					`Tiles persist and double up to ${config.tileCap.super}×.`,
					'The roar clears the low symbols and a Super Sting is possible.',
					soc(
						`**Super floor:** a Super Free Spins round always pays at least **${SUPER_FLOOR}x your bet** (${amount(SUPER_FLOOR)}) from its free spins.`,
						`**Super floor:** a Super Free Spins round always wins at least **${SUPER_FLOOR}x your play amount** (${amount(SUPER_FLOOR)}) from its free spins.`,
					),
					soc('A bought round can still upgrade to Epic Free Spins.', 'An instantly triggered round can still upgrade to Epic Free Spins.'),
				],
			},
			epic: {
				enter: soc(`Land 6 or more ${SCATTERS}, or buy directly.`, `Land 6 or more ${SCATTERS}, or trigger it instantly from ${MENU}.`),
				spins: `${config.freeSpins.epic} free spins.`,
				// COPY RULE (Corey 2026-10-13 14:14): a guaranteed multiple names its base and shows the live amount. The
				// Mystery Epic's own floor is stated nowhere, so this sentence names only the two routes it covers
				mech: [
					`Tiles persist and double up to ${config.tileCap.epic}×, and Super Stings land far more often than in Super Free Spins.`,
					soc(
						`**Epic floor:** a round triggered by ${SCATTERS} or bought directly always pays at least **${config.epicMinWin}x your bet** (${amount(config.epicMinWin)}) from its free spins.`,
						`**Epic floor:** a round triggered by ${SCATTERS} or instantly triggered always wins at least **${config.epicMinWin}x your play amount** (${amount(config.epicMinWin)}) from its free spins.`,
					),
				],
			},
			mystery: {
				enter: soc(`Buy from ${MENU}.`, `Trigger from ${MENU}.`),
				spins: 'One Mystery spin, then whatever it awards.',
				mech: ['Awards Super Free Spins, Epic Free Spins or no feature, never regular Free Spins.', 'The exact shares are under Mystery Disclosure.'],
			},
		} as Record<string, { enter: string; spins: string; mech: string[] }>,
	},
	mystery: [
		soc(
			`**What a Mystery awards:** exactly **${share(config.mystery.nothing)}** of Mysteries award no feature, **${share(config.mystery.super)}** award Super Free Spins and **${share(config.mystery.epic)}** award Epic Free Spins, for ${modeCost('MYSTERY')}x the bet. A Mystery never awards regular Free Spins. These shares are fixed in the published math.`,
			`**What a Mystery awards:** exactly **${share(config.mystery.nothing)}** of Mysteries award no feature, **${share(config.mystery.super)}** award Super Free Spins and **${share(config.mystery.epic)}** award Epic Free Spins, for ${modeCost('MYSTERY')}x the play amount. A Mystery never awards regular Free Spins. These shares are fixed in the published math.`,
		),
		`**A Mystery is a real spin:** ${MYSTERY_SCATTERS} ${SCATTERS} always land, one in each of the first ${MYSTERY_SCATTERS} columns. The Manticore then stings in ${MYSTERY_STINGS.super} more for Super Free Spins, ${MYSTERY_STINGS.epic} more for Epic Free Spins, or none. No wild stings land on the Mystery spin, and no further ${SCATTERS} can drop in during its cascades.`,
		soc(
			"**The spin always plays out:** its clusters pay as normal, so a Mystery that awards no feature can still pay. When a feature is awarded, the spin's wins count toward the round and its tiles carry into the feature.",
			"**The spin always plays out:** its clusters win as normal, so a Mystery that awards no feature can still win. When a feature is awarded, the spin's wins count toward the round and its tiles carry into the feature.",
		),
	],
	tiles: {
		intro: `Every winning cluster lights the cells under it, in every mode. A cold cell becomes a **${config.tileSeed}x Multiplier Tile** and a lit cell **doubles**.`,
		rules: [
			soc(
				'A cluster pays its table value multiplied by the **sum** of the tiles under it. With no tiles under it, it pays its table value once. Example: on tiles of 2x, 4x and 8x it pays its table value x14.',
				'A cluster wins its table value multiplied by the **sum** of the tiles under it. With no tiles under it, it wins its table value once. Example: on tiles of 2x, 4x and 8x it wins its table value x14.',
			),
			soc(
				`A cluster uses the tiles as they stand when it lands. The cells it covers step up after it pays. A ${WILD} shared by two clusters steps up once.`,
				`A cluster uses the tiles as they stand when it lands. The cells it covers step up after it wins. A ${WILD} shared by two clusters steps up once.`,
			),
			'Tiles **reset** at the start of every spin in the Base Game, Ante and Super Ante.',
			'When a spin triggers a feature, the tiles it lit **carry into the feature**. In Free Spins, Super Free Spins and Epic Free Spins the tiles then **persist** for every spin of the round.',
			`The ladder stops at **${CAP_LOW}x** in the Base Game, Ante, Super Ante and Free Spins, and at **${CAP_HIGH}x** in Super Free Spins and Epic Free Spins, from the first free spin.`,
		],
		manticore: 'The Manticore',
		creature: [
			// MUST WIN (math 2026.10.16, game_config SWIPE_MUST_WIN, SWIPE_CHANCE_DEAD, STING_MUST_WIN): every swipe's refill
			// completes a winning cluster; in free spins the first swipe roll of a spin that has paid nothing uses the rescue
			// chance (0.9 against 0.12); a Big or Super Sting, and the last sting of a normal-only run, completes a cluster.
			// The promise is the last sting's only: the earlier normal stings of a run carry none of their own
			soc(
				`**Swipe.** When a spin runs out of clusters, the paw may clear ${SWIPE_BAND} adjacent rows anywhere on the board, up to ${SWIPE_MAX_PER_SPIN} per spin. Every cell it clears lights up if it was cold and doubles if it was lit. ${SCATTERS} are never cleared. The board refills and play carries on. A swipe always completes at least one winning cluster. In Free Spins, Super Free Spins and Epic Free Spins the paw is far more likely to strike on a spin that has not paid yet.`,
				`**Swipe.** When a spin runs out of clusters, the paw may clear ${SWIPE_BAND} adjacent rows anywhere on the board, up to ${SWIPE_MAX_PER_SPIN} per spin. Every cell it clears lights up if it was cold and doubles if it was lit. ${SCATTERS} are never cleared. The board refills and play carries on. A swipe always completes at least one winning cluster. In Free Spins, Super Free Spins and Epic Free Spins the paw is far more likely to strike on a spin that has not won yet.`,
			),
			`**Sting.** Before the board is evaluated, the tail may strike up to ${STING_MAX_PER_SPIN} times, one sting after another. A **normal sting** turns one cell wild, a **Big Sting** a cross of five cells and a **Super Sting** a 3x3 block of nine cells. A spin has at most one Big or Super Sting, and it is always the last sting of that spin. A Big or Super Sting always lands in a winning cluster, and so does the last sting of every run of normal stings. No sting ever lands on a ${SCATTER}.`,
			'Normal stings can land in every spin except the Mystery spin. Big Stings land only in Free Spins, Super Free Spins and Epic Free Spins. Super Stings land only in Super Free Spins and Epic Free Spins.',
			'**Roar.** In Super Free Spins and Epic Free Spins only, the Manticore may roar before the board is evaluated. Every low symbol is blown off the board and replaced. The Multiplier Tiles under them stay. A roar always comes before any stings.',
			soc(
				`**Scatter sting.** On some naturally triggered features in the Base Game, Ante and Super Ante, the board lands with one or more ${SCATTERS} hidden and the Manticore stings them in. Nothing is paid until the stings are done, and the stings do not change the result: those ${SCATTERS} were part of the spin all along. This never happens on bought Free Spins, Super Free Spins or Epic Free Spins.`,
				`**Scatter sting.** On some naturally triggered features in the Base Game, Ante and Super Ante, the board lands with one or more ${SCATTERS} hidden and the Manticore stings them in. Nothing is counted until the stings are done, and the stings do not change the result: those ${SCATTERS} were part of the spin all along. This never happens on instantly triggered Free Spins, Super Free Spins or Epic Free Spins.`,
			),
		],
	},
	maxWin: {
		unit: soc('bet (hard cap)', 'play amount (hard cap)'),
		text: soc(
			`The maximum win is ${MAX_WIN}x the bet in every mode. The moment a round's total reaches it, the round ends and ${MAX_WIN}x is paid. Any free spins left in that round are not played.`,
			`The maximum win is ${MAX_WIN}x the play amount in every mode. The moment a round's total reaches it, the round ends and ${MAX_WIN}x is won. Any free spins left in that round are not played.`,
		),
		rtpHead: 'Return to Player (RTP)',
		rtp: `Every game mode has a theoretical return to player of **${RTP}**. RTP describes long-run behaviour across all players. A single session can return much more or much less.`,
		volHead: 'Volatility',
		// math 2026.10.16 (today_vs_new_real_books.md): a win on 44.2% of base spins (Ante 37.7%, Super Ante 41.6%); spins
		// that win nothing 55.8% / 62.3% / 58.4%; more than half of the wins are under 1x the bet in all three; the
		// feature rounds carry 43.6% / 79.8% / 95.1% of the RTP. "Wins are infrequent" (the 28% books) is no longer true
		volatility: soc(
			'Wins come often but are mostly small: many are smaller than the bet, and more than half of Base Game spins still win nothing. Big wins are rare and can be very large. The free spin rounds carry a large share of the long-run RTP.',
			'Wins come often but are mostly small: many are smaller than the play amount, and more than half of Base Game spins still win nothing. Big wins are rare and can be very large. The free spin rounds carry a large share of the long-run RTP.',
		),
	},
	legal: {
		disclaimer: DISCLAIMER,
		versionHead: 'Version',
	},
});

/** `**word**` to runs: odd runs are bold. The page renders them as text nodes, never as HTML */
export const runs = (s: string) => s.split('**').map((t, i) => ({ t, b: i % 2 === 1 }));
