// GAME INFO'S COPY (ui/GameInfoModal.svelte). Written from the settled rules (docs/run-over-reindeer-spec.md "Math
// direction settled" and "What-if 4, variant E accepted"), read again on 2026-11-16 against the math build of 2026-11-15
// (contract 2026-11-15a, the P1 paytable: results/build_2026-11-15/BUILD_REPORT.md). Every rate, floor and multiplier
// range here comes from game/config.ts; the paytable page takes the pays from there too. The text quotes no odds of its own; modes.intro explains what the feature menu's "~1 in N" figures mean.
//
// Social mode: no gambling vocabulary on stake.us (soc(standard, social)). `**text**` marks bold runs.
import config from './config';
import { soc } from './social';
import { AUTOPLAY_RESUME_PAUSE_MS } from './bonusStockRules';
import { FEATURE_MENU_TEXT } from './featureMenuData';

// Verbatim Stake Engine template (docs: approval-guidelines/general-disclaimer), as Manticore Mayhem ships it.
export const DISCLAIMER =
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and \u00a9 2026 Engine.';

export type Run = { t: string; b: boolean };
/** split a string on **bold** marks */
export const runs = (text: string): Run[] =>
	text
		.split('**')
		.map((t, i) => ({ t, b: i % 2 === 1 }))
		.filter((r) => r.t.length > 0);

export const pct = (rtp: number) => `${(rtp * 100).toFixed(1)}%`;

const SPINS = config.freeSpins;
const CAP = config.maxWin.toLocaleString('en-US');

export const MODE_NAMES: Record<string, string> = {
	base: 'Base Game',
	ante_2: soc('Ante Bet 2x', 'Ante Mode 2x'),
	ante_4: soc('Ante Bet 4x', 'Ante Mode 4x'),
	ante_10: soc('Ante Bet 10x', 'Ante Mode 10x'),
	bonus: 'Free Spins',
	super: 'Super Free Spins',
};

/** one UI guide row's text, keyed by the row id ui/GameInfoModal.svelte draws its icon for (Manticore Mayhem's guide,
 *  this game's controls) */
export type GuideId = 'feature' | 'spin' | 'boardTap' | 'autoplay' | 'turbo' | 'menu' | 'sound' | 'amount' | 'readouts' | 'symbols' | 'keyboard' | 'replay';
/** THE OPERATOR'S SWITCHES the rules page follows (authenticate's jurisdiction block, the flags ui/controls.svelte.ts and
 *  ui/Chrome*.svelte read): a control the operator turns off is neither drawn nor described */
export type RulesFlags = {
	disabledAutoplay?: boolean;
	disabledTurbo?: boolean;
	disabledSuperTurbo?: boolean;
	disabledSlamstop?: boolean;
	disabledSpacebar?: boolean;
	disabledBuyFeature?: boolean;
};
/** the guide's rows under the operator's switches: no Turbo row under disabledTurbo, no Autoplay row under
 *  disabledAutoplay, no feature menu row under disabledBuyFeature (their buttons are not drawn), and no board tap where
 *  the slam stop or turbo is off (ui/controls.svelte.ts boardTap refuses it). The Keyboard row stays under
 *  disabledSpacebar (Escape still closes a window); its text drops the Space bar. */
export const guideRowShown = (id: GuideId, j: RulesFlags): boolean => {
	if (id === 'boardTap') return !j.disabledSlamstop && !j.disabledTurbo;
	if (id === 'turbo') return !j.disabledTurbo;
	if (id === 'autoplay') return !j.disabledAutoplay;
	if (id === 'feature') return !j.disabledBuyFeature;
	return true;
};

/** the pause after a bonus round's wrap-up in autoplay, in words ("1 second"): game/bonusStockRules.ts */
const PAUSE_WORDS = ((s) => `${s} second${s === 1 ? '' : 's'}`)(Math.round(AUTOPLAY_RESUME_PAUSE_MS / 100) / 10);
/** THE SPACE BAR as this game has it (ui/Chrome.svelte: OnHotkey Space is the Spin press, components-shared
 *  EnableSpaceHold holds it): a press plays a round, or is STOP during one; held down it plays round after round until it
 *  is let go (checked in the browser 2026-11-18, reported to the owner, not changed) */
const SPACE_BAR = soc('Space bar plays a round, or is **STOP** while one plays. Held down, it plays one round after another until you let go.', 'Space bar plays a round, or is **STOP** while one plays. Held down, it plays one round after another until you let go.');
/** the Ante levels, from the mode list (ante_2 -> 2x): "2x, 4x and 10x" */
const ANTE_LEVELS = ((xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : (xs[0] ?? '')))(config.anteModes.map((k: string) => `${k.split('_')[1]}x`));

const G = config.multipliers.grandmaWild;
const C = config.multipliers.column;
const R = config.multipliers.bonusRare;

export const gameInfoText = (j: RulesFlags = {}) => ({
	paytable: {
		intro: soc(
			`Wins pay on **${config.paylines.length} fixed lines**, from the leftmost column to the right, for 3, 4 or 5 matching symbols in a row. Amounts are shown for the current play amount.`,
			`Wins land on **${config.paylines.length} fixed lines**, from the leftmost column to the right, for 3, 4 or 5 matching symbols in a row. Amounts are multiples of the play amount.`,
		),
		specials: 'Special symbols',
		wild: soc("**Santa's Sleigh is Wild**: it stands in for every paying symbol. A line of only Wilds pays as Grandma's Car.", "**Santa's Sleigh is Wild**: it stands in for every regular symbol. A line of only Wilds wins as Grandma's Car."),
		scatter: `**The Present is the Scatter.** 3 Presents award ${SPINS} Free Spins and 4 or more award ${SPINS} Super Free Spins: the 4th and 5th Present to land in a spin show in red. It ${soc('pays', 'wins')} nothing by itself, lands at most once per column and never in a column Wild.`,
		kinds: { 3: '3', 4: '4', 5: '5' } as Record<number, string>,
	},
	// THE UI GUIDE (2026-11-18, review blocker: the game info had no guide to the controls; Manticore Mayhem's structure).
	// Every sentence that names a control the operator can switch off is said only where it is on (RulesFlags). The turbo
	// and autoplay sentences state the stock rules (game/bonusStockRules.ts).
	guide: {
		intro: 'On a computer or a tablet the controls sit in the glass bar along the bottom of the screen. On an upright phone they sit in one row under the road, and on a phone held sideways in the two columns beside it.',
		rows: {
			feature: {
				name: FEATURE_MENU_TEXT.name,
				text: soc(
					`Opens ${FEATURE_MENU_TEXT.name}, the feature menu. **Ante** raises the bet per spin for more bonus rounds, at ${ANTE_LEVELS} on its slider, and stays on until you switch it off. **Free Spins** and **Super Free Spins** can be bought for one round each. Every choice opens a confirm step that shows its cost, and nothing changes until you press **CONFIRM**. A bought round is loaded onto the Spin button and plays when you press Spin. Open the menu again to unload it or to switch Ante off.`,
					`Opens ${FEATURE_MENU_TEXT.name}, the feature menu. **Ante** raises the play amount per spin for more bonus rounds, at ${ANTE_LEVELS} on its slider, and stays on until you switch it off. **Free Spins** and **Super Free Spins** can be started for one round each. Every choice opens a confirm step that shows its play amount, and nothing changes until you press **CONFIRM**. A loaded round sits on the Spin button and plays when you press Spin. Open the menu again to unload it or to switch Ante off.`,
				),
			},
			spin: {
				name: 'Spin',
				text: [
					soc('Plays one round at the amount shown beside it.', 'Plays one round at the play amount shown beside it.'),
					!j.disabledSlamstop ? 'While the traffic drives in it turns into **STOP**: a press lands the traffic and plays the rest of that spin at top speed.' : '',
					((x) => (x ? `With ${x} loaded, it shows what the next press starts.` : ''))([!j.disabledAutoplay ? 'Autoplay' : '', !j.disabledBuyFeature ? 'a feature' : ''].filter(Boolean).join(' or ')),
					'During a bonus round it shows the spin in play and the round\'s total spins.',
				]
					.filter(Boolean)
					.join(' '),
			},
			boardTap: {
				name: 'Tap to Speed Up',
				text: [
					'While a spin plays, tap or click the road to do what **STOP** does, once per spin, in free spins too.',
					!j.disabledAutoplay ? 'During Autoplay it speeds up the spin and the run carries on.' : '',
					'It never changes the result.',
				]
					.filter(Boolean)
					.join(' '),
			},
			autoplay: {
				name: 'Autoplay',
				text: `Opens the Autoplay menu: the number of spins (10 to 1,000, or until stopped) and **Stop options**: a stop-on-loss limit, a stop-on-single-win limit, **Stop on Free Games** (the run ends when a bonus round starts, and the round still plays out) and **Autoplay Bonuses** (the bonus round's screens continue on their own). **LOAD** puts the run on the Spin button, and Spin starts it. While it runs, **AUTO** is lit and its arrow turns. To stop the run at any time, press **AUTO** (or Spin, which also speeds up the spin in play): the round in play finishes and no further spin starts. This works during free spins too, and the bonus round still plays to its end. When a bonus round ends with Autoplay still running, the game waits ${PAUSE_WORDS} after its total win screen is cleared before the next spin starts, at every speed, so you can stop the run.`,
			},
			turbo: {
				name: 'Turbo',
				text: [
					j.disabledSuperTurbo
						? 'Switches between regular speed (one bar lit) and **Turbo** (both bars), which shortens the traffic and the win presentation.'
						: 'Cycles through three speeds: regular (one bar lit), **Turbo** (two bars) and **Super Turbo** (three bars). Turbo shortens the traffic and the win presentation, and Super Turbo shortens them most.',
					'Every bonus round starts at regular speed. You can change the speed during the round, and that choice lasts for that round only: when it ends, the speed you had set in the base game comes back.',
					'The base game speed is remembered on this device. Speed never changes the result.',
				].join(' '),
			},
			menu: { name: 'Menu', text: 'Opens the menu: **GAME INFO** (this screen) and the sound controls. Press it again to close the menu.' },
			sound: { name: 'Sound', text: 'In the menu, **MUSIC** and **EFFECTS** each have a volume slider and a mute button. All sound can be turned off. The settings are remembered on this device.' },
			amount: soc(
				{ name: 'Bet Amount', text: 'The amount over the minus and plus buttons is the full cost of one press in the active mode (with Ante on, the Ante level\'s name shows over it). Minus and plus step through the bet levels, and a tap on the amount opens the full list. Between rounds only.' },
				{ name: 'Play Amount', text: 'The amount over the minus and plus buttons is the full play amount of one press in the active mode (with Ante on, the Ante level\'s name shows over it). Minus and plus step through the levels, and a tap on the amount opens the full list. Between rounds only.' },
			),
			readouts: { name: 'Readouts', text: '**BALANCE** is your current balance. **WIN** is the round\'s total so far: in a bonus round it reads **FREE SPINS WIN**, the running total of the round.' },
			symbols: {
				name: soc('Symbol Pays', 'Symbol Values'),
				text: soc(
					'Between rounds, tap or click a symbol on the road to see what 3, 4 and 5 in a line pay at the current bet. The Wild and the Present show what they do. It closes on any other press or after a few seconds.',
					'Between rounds, tap or click a symbol on the road to see what 3, 4 and 5 in a line win at the current play amount. The Wild and the Present show what they do. It closes on any other press or after a few seconds.',
				),
			},
			keyboard: {
				name: 'Keyboard',
				text: [j.disabledSpacebar ? '' : SPACE_BAR, 'Escape closes any open window.'].filter(Boolean).join(' '),
			},
			replay: {
				name: 'Replay Mode',
				text: soc(
					'A shared round opens in replay mode: a card shows its mode, its bet and its total win, and **START REPLAY** plays the round exactly as it happened. During the replay the Spin button reads **REPLAY**, and once the round is over a press shows it again. Nothing is bet and the balance does not change.',
					'A shared round opens in replay mode: a card shows its mode, its play amount and its total win, and **START REPLAY** plays the round exactly as it happened. During the replay the Spin button reads **REPLAY**, and once the round is over a press shows it again. Nothing is played for real and the balance does not change.',
				),
			},
		} satisfies Record<GuideId, { name: string; text: string }>,
	},
	lines: {
		intro: `The ${config.paylines.length} lines. Each one runs left to right across the five columns, one lane per column.`,
	},
	howTo: [
		soc(
			'Choose a bet with the minus and plus buttons, then press **Spin**. Traffic drives in from the tunnels: the top two lanes run left to right and the bottom two run right to left. When it stops, every line is checked.',
			'Choose a play amount with the minus and plus buttons, then press **Play**. Traffic drives in from the tunnels: the top two lanes run left to right and the bottom two run right to left. When it stops, every line is checked.',
		),
		`**Reindeer strikes.** After the traffic stops a reindeer can run along the snow above the road, turn and charge down into a symbol. If it hits **Grandma's Car**, that one cell becomes a Wild with a multiplier (${G.base[0]}x to ${G.base[1]}x in the base game, up to ${G.freeSpins[1]}x in a bonus round) for that spin only. If it hits **Santa's Sleigh**, the whole column becomes a Wild with a multiplier of its own.`,
		`**Column Wilds.** Who steps out of the smoke tells you the size of the multiplier: the Reindeer is the lowest (${C.base.reindeer[0]}x to ${C.base.reindeer[1]}x in the base game), Santa is in the middle (${C.base.santa[0]}x to ${C.base.santa[1]}x) and Grandma is the highest (${C.base.grandma[0]}x to ${C.base.grandma[1]}x). In the base game a column Wild lasts for that spin.`,
		`**Multipliers add up.** When more than one multiplier Wild is part of the same winning line, their multipliers are added together and the line ${soc('pays', 'wins')} that many times over. A plain sleigh adds nothing. Each line ${soc('pays', 'awards')} only its highest win, multipliers included.`,
		`**Bonus rounds.** In Free Spins and Super Free Spins every column Wild stays for the rest of the round and keeps the multiplier it landed with. In Free Spins the Reindeer is ${C.freeSpins.reindeer[0]}x to ${C.freeSpins.reindeer[1]}x, Santa ${C.freeSpins.santa[0]}x to ${C.freeSpins.santa[1]}x and Grandma ${C.freeSpins.grandma[0]}x to ${C.freeSpins.grandma[1]}x; in Super Free Spins the Reindeer is ${C.super.reindeer[0]}x to ${C.super.reindeer[1]}x, Santa ${C.super.santa[0]}x to ${C.super.santa[1]}x and Grandma ${C.super.grandma[0]}x to ${C.super.grandma[1]}x. Now and then Santa steps out at **${R.santa}x** and Grandma at **${R.grandma}x**. 3 Presents during a round add ${config.retriggerSpins} more spins.`,
		`The most a round can ${soc('pay', 'win')} is **${CAP}x**. When a round reaches it, the round ends there.`,
		// THE STOCK RULES (game/bonusStockRules.ts, 2026-11-18): speed and Autoplay around a bonus round, said plainly
		[
			'**Speed and Autoplay in bonus rounds.**',
			j.disabledTurbo ? '' : 'Every bonus round starts at regular speed, whatever Turbo was set to. Turbo can be changed during the round, and that choice lasts for that round only: when it ends, the speed set in the base game comes back.',
			j.disabledAutoplay ? '' : `A running Autoplay can be stopped at any time during a bonus round with **AUTO** (or Spin): the round plays to its end and no further spin starts. When a bonus round ends with Autoplay still running, the next spin starts ${PAUSE_WORDS} after the total win screen is cleared, at every speed, so there is time to stop it.`,
		]
			.filter(Boolean)
			// (both off: nothing to say, the paragraph goes; ui/GameInfoModal.svelte skips an empty one)
			.join(' ')
			.replace(/^\*\*Speed and Autoplay in bonus rounds\.\*\*$/, ''),
	],
	modes: {
		intro: [soc('Each mode has its own published return to player. A bought round plays by the same rules as one that triggers by itself.', 'Each mode has its own published return to player. A round you start from the menu plays by the same rules as one that triggers by itself.'),
			// what the feature menu's "~1 in N" figures mean (Corey 2026-11-17)
			'**About the odds.** Figures such as "~1 in 76" in the feature menu are long-run averages. "~1 in 76" means that over a very large number of spins, the feature starts about once every 76 spins on average. It is not a countdown and not a promise. Every spin is independent: the feature can start twice in a row, or not start for many hundreds of spins. Earlier spins never make it more or less likely on the next spin.',
		],
		labels: { enter: 'HOW TO ENTER', spins: 'WHAT YOU GET', mech: 'HOW IT PLAYS' },
		stats: { price: soc('PRICE', 'EACH ROUND'), priceUnit: soc('x bet', 'x play'), rtp: 'RTP', maxWin: 'MAX WIN', thisMode: soc('this price', 'this mode') },
		cards: {
			base: {
				enter: 'The normal game.',
				spins: 'One spin per press.',
				mech: ['Reindeer strikes can happen on any spin. Wilds made in the base game last for that spin only.', '3 Presents award Free Spins, 4 or more award Super Free Spins.'],
			},
			ante_2: {
				enter: soc('The Ante card in the feature menu, slider at 2x.', 'The Ante card in the feature menu, slider at 2x.'),
				spins: soc('Every spin costs 2x the bet.', 'Every play is 2x the play amount.'),
				mech: ['Free Spins and Super Free Spins trigger more often than in the base game.', 'Stays on until you switch it off.'],
			},
			ante_4: {
				enter: 'The Ante card in the feature menu, slider at 4x.',
				spins: soc('Every spin costs 4x the bet.', 'Every play is 4x the play amount.'),
				mech: ['Bonus rounds trigger more often again, Super Free Spins most of all.', 'Stays on until you switch it off.'],
			},
			ante_10: {
				enter: 'The Ante card in the feature menu, slider at 10x.',
				spins: soc('Every spin costs 10x the bet.', 'Every play is 10x the play amount.'),
				mech: ['The most frequent bonus rounds of the three levels.', 'Stays on until you switch it off.'],
			},
			bonus: {
				enter: soc('3 Presents, or buy it from the feature menu.', '3 Presents, or start it from the feature menu.'),
				spins: `${SPINS} free spins.`,
				mech: [
					'Every column Wild stays for the rest of the round and keeps its multiplier.',
					'Every round has at least one column Wild.',
					`Column Wilds from ${C.freeSpins.reindeer[0]}x up to ${R.grandma}x.`,
					`3 Presents add ${config.retriggerSpins} spins.`,
					soc(`A round triggered by Presents pays at least ${config.floors.naturalFreeSpins}x the bet: if its spins total less, the difference is added at the end.`, `A round triggered by Presents wins at least ${config.floors.naturalFreeSpins}x the play amount: if its spins total less, the difference is added at the end.`),
				],
			},
			super: {
				enter: soc('4 or more Presents, or buy it from the feature menu.', '4 or more Presents, or start it from the feature menu.'),
				spins: `${SPINS} super free spins.`,
				mech: [
					'Starts with one column Wild already in place.',
					`More strikes on Grandma's Car, with multipliers from ${G.super[0]}x.`,
					soc(`A round triggered by Presents pays at least ${config.floors.naturalSuper}x the bet, with the difference added at the end if needed. A bought round pays at least ${config.floors.boughtSuper}x the bet.`, `A round triggered by Presents wins at least ${config.floors.naturalSuper}x the play amount, with the difference added at the end if needed. A round started from the menu wins at least ${config.floors.boughtSuper}x the play amount.`),
				],
			},
		} as Record<string, { enter: string; spins: string; mech: string[] }>,
	},
	maxWin: {
		unit: soc('the bet', 'the play amount'),
		text: soc(`The maximum win is **${CAP}x the bet** in every mode. A round that reaches it ends at once and pays exactly that.`, `The maximum win is **${CAP}x the play amount** in every mode. A round that reaches it ends at once and wins exactly that.`),
		rtpHead: 'Return to player',
		rtp: 'The theoretical return to player of each mode, over a very large number of rounds.',
	},
	legal: {
		disclaimer: DISCLAIMER,
		versionHead: 'Version',
	},
});
