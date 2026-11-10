// GAME INFO'S COPY (ui/GameInfoModal.svelte). Written from the settled rules (docs/run-over-reindeer-spec.md "Math
// direction settled" and "What-if 4, variant E accepted", contract 2026-11-10a). No books are published yet: every
// rate, floor and multiplier range here must be read again against the published math before a submission.
//
// Social mode: no gambling vocabulary on stake.us (soc(standard, social)). `**text**` marks bold runs.
import config from './config';
import { soc } from './social';

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

const G = config.multipliers.grandmaWild;
const C = config.multipliers.column;
const R = config.multipliers.bonusRare;

export const gameInfoText = () => ({
	paytable: {
		intro: soc(
			`Wins pay on **${config.paylines.length} fixed lines**, from the leftmost column to the right, for 3, 4 or 5 matching symbols in a row. Amounts are shown for the current bet.`,
			`Wins land on **${config.paylines.length} fixed lines**, from the leftmost column to the right, for 3, 4 or 5 matching symbols in a row. Amounts are multiples of the play amount.`,
		),
		specials: 'Special symbols',
		wild: soc("**Santa's Sleigh is Wild**: it stands in for every paying symbol. A line of only Wilds pays as Grandma's Car.", "**Santa's Sleigh is Wild**: it stands in for every regular symbol. A line of only Wilds wins as Grandma's Car."),
		scatter: `**The Present is the Scatter.** 3 Presents award ${SPINS} Free Spins and 4 or more award ${SPINS} Super Free Spins. It ${soc('pays', 'wins')} nothing by itself, lands at most once per column and never in a column Wild.`,
		kinds: { 3: '3', 4: '4', 5: '5' } as Record<number, string>,
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
		`**Multipliers add up.** When more than one multiplier Wild is part of the same winning line, their multipliers are added together and the line ${soc('pays', 'wins')} that many times over. A plain sleigh adds nothing.`,
		`**Bonus rounds.** In Free Spins and Super Free Spins every column Wild stays for the rest of the round and keeps the multiplier it landed with. In Free Spins the Reindeer is ${C.freeSpins.reindeer[0]}x to ${C.freeSpins.reindeer[1]}x, Santa ${C.freeSpins.santa[0]}x to ${C.freeSpins.santa[1]}x and Grandma ${C.freeSpins.grandma[0]}x to ${C.freeSpins.grandma[1]}x; in Super Free Spins the Reindeer is ${C.super.reindeer[0]}x to ${C.super.reindeer[1]}x, Santa ${C.super.santa[0]}x to ${C.super.santa[1]}x and Grandma ${C.super.grandma[0]}x to ${C.super.grandma[1]}x. Now and then Santa steps out at **${R.santa}x** and Grandma at **${R.grandma}x**. 3 Presents during a round add ${config.retriggerSpins} more spins.`,
		`The most a round can ${soc('pay', 'win')} is **${CAP}x**. When a round reaches it, the round ends there.`,
	],
	modes: {
		intro: [soc('Each mode has its own published return to player. A bought round plays by the same rules as one that triggers by itself.', 'Each mode has its own published return to player. A round you start from the menu plays by the same rules as one that triggers by itself.')],
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
