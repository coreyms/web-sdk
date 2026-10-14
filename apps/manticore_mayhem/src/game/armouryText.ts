// EVERY STRING OF THE ARMOURY (the feature menu), regular and social, in the manner of introCardText.ts and
// gameInfoText.ts: one table, so the parked translation work has one file to take. Spec section 6.2, with the
// Ante, Super Ante, Super and Epic lines brought into line with the approved rules page (gameInfoText.ts, Build B2,
// 2026-10-14): Ante names all three features; Super Ante says what 4 scatters award, not "upgrade"; the tiles
// "double up to" their cap rather than "the 128x ladder".
//
// TEMPLATES. Every sentence is whole, with named slots ({amt}, {x}, {name}, {n}) filled by `fill`; `**word**` marks a
// key term set in gold, split into runs by `boldRuns` (the menu renders text nodes, never HTML). An amount is ONE
// word: the component puts each {amt} in a span (white-space: nowrap; dir="ltr"; unicode-bidi: isolate).
//
// COPY RULES: no em or en dash anywhere; the social wording (soc's second argument) never says bet, buy, cost,
// charged, price, pay or purchase ("play amount", "uses", "Nothing was used"). The guaranteed multiple (the Epic
// floor) names its base and shows the live amount; the Mystery Epic's own floor is stated nowhere.
//
// Numbers come from the game: spin counts and tile caps from config.ts, the Mystery's shares from config.mystery,
// cost multiples from the RGS (modeCost, filled in at render time as {x}).
import config from './config';
import { soc } from './social';
import { modeCost, modeShortLabel } from './betModeMeta';
import { FEATURE_MENU_NAME } from './constants';
import type { ArmouryGroup, ArmouryModeId } from './armouryData';

const SPINS = config.freeSpins;
const CAP = config.tileCap;
const FLOOR = config.epicMinWin;
const SCATTERS = `${config.symbols.S.name}s`;
const share = (x: number) => Math.round(x * 100);

export const ARMOURY_TEXT = {
	name: FEATURE_MENU_NAME,
	group: {
		spin: { head: soc('PER SPIN', 'PER PLAY'), sub: 'stays on until switched off' },
		buy: { head: soc('FEATURE BUYS', 'FEATURES'), sub: soc('one round, one price', 'one round, one amount') },
	} satisfies Record<ArmouryGroup, { head: string; sub: string }>,
	kicker: { spin: soc('PER SPIN MODE', 'PER PLAY MODE'), buy: soc('FEATURE BUY', 'FEATURE') } satisfies Record<ArmouryGroup, string>,
	/** the tile shows the multiple, never an amount ({x}: the RGS's cost multiplier) */
	tileMultiple: { spin: soc('{x}x / spin', '{x}x / play'), buy: '{x}x' } satisfies Record<ArmouryGroup, string>,
	/** what the plate's price covers */
	priceLabel: { spin: soc('PER SPIN', 'PER PLAY'), buy: 'TOTAL' } satisfies Record<ArmouryGroup, string>,
	button: { activate: 'ACTIVATE', switchOff: 'SWITCH OFF', unload: 'UNLOAD', confirm: 'CONFIRM', cancel: 'Cancel' },
	/** the close button's label: KEEP IT EXACTLY (tools/manticore/resume_probe.js and chaos_gate.js find it by it) */
	close: 'Close',
	volatility: 'VOLATILITY',
	balanceShort: soc('Balance too low at this bet', 'Balance too low at this play amount'),
	/** the chip on a mode that is on: on its tile, and leading the plate's status line (the status templates below start
	 *  with it: "ON. Active now. ..."; the menu draws it as the chip and the rest as the line, `afterTag`) */
	onTag: { spin: 'ON', buy: 'LOADED' } satisfies Record<ArmouryGroup, string>,
	/** the plate's line under the name while a mode is on, and just after it was switched off */
	status: {
		anteOn: soc('ON. Active now. Every spin costs **{amt}** until you switch it off.', 'ON. Active now. Every spin uses **{amt}** until you switch it off.'),
		buyLoaded: soc('LOADED. The next press of Spin costs **{amt}** and plays one round.', 'LOADED. The next press of Spin uses **{amt}** and plays one round.'),
		anteOff: soc('**{name}** is off. Every spin costs **{amt}** again.', '**{name}** is off. Every spin uses **{amt}** again.'),
		buyUnloaded: soc('**{name}** is unloaded. Nothing was charged.', '**{name}** is unloaded. Nothing was used.'),
	},
	/** the plate's sentence per mode. EPIC's {amt} is the floor (config.epicMinWin times the bet) as money */
	pitch: {
		ANTE: '**Free Spins**, **Super Free Spins** and **Epic Free Spins** land about **five times as often** on every spin.',
		SUPER_ANTE: `Only **Super** and **Epic Free Spins** can trigger: **4 ${SCATTERS}** award **Super Free Spins** instead.`,
		BONUS: `**${SPINS.bonus} free spins** where **Multiplier Tiles** stay all round and double up to **${CAP.bonus}x**.`,
		SUPER: `**${SPINS.super} free spins**, tiles double up to **${CAP.super}x**, a **roar** that clears the low symbols and a possible **Super Sting**.`,
		EPIC: soc(
			`**${SPINS.epic} free spins**, tiles double up to **${CAP.epic}x**, **Super Stings** are common and every round returns **at least ${FLOOR}x your bet ({amt})**.`,
			`**${SPINS.epic} free spins**, tiles double up to **${CAP.epic}x**, **Super Stings** are common and every round returns **at least ${FLOOR}x your play amount ({amt})**.`,
		),
		MYSTERY: 'One spin reveals **no feature**, **Super** or **Epic Free Spins**.',
	} satisfies Record<ArmouryModeId, string>,
	/** the Mystery's odds rows (armouryData.ts ARMOURY_MODES odds): {n} is the share in percent */
	odds: { nothing: 'No feature', super: 'Super Free Spins', epic: 'Epic Free Spins' },
	oddsShare: '{n}%',
	/** the desktop confirm card's "what you get" line (left out on the phone's card, owner 2026-10-13) */
	gets: {
		ANTE: 'About five times the Free Spins, Super Free Spins and Epic Free Spins triggers',
		SUPER_ANTE: `Super and Epic Free Spins only, 4 ${SCATTERS} award Super Free Spins`,
		BONUS: `${SPINS.bonus} free spins, Multiplier Tiles stay all round, up to ${CAP.bonus}x`,
		SUPER: `${SPINS.super} free spins, tiles up to ${CAP.super}x, the roar, a possible Super Sting`,
		EPIC: soc(
			`${SPINS.epic} free spins, tiles up to ${CAP.epic}x, common Super Stings, at least ${FLOOR}x your bet ({amt})`,
			`${SPINS.epic} free spins, tiles up to ${CAP.epic}x, common Super Stings, at least ${FLOOR}x your play amount ({amt})`,
		),
		MYSTERY: `One spin: ${share(config.mystery.nothing)}% no feature, ${share(config.mystery.super)}% Super, ${share(config.mystery.epic)}% Epic`,
	} satisfies Record<ArmouryModeId, string>,
	/** the confirm card's rows. A buy: BET / <NAME> {x}x / TOTAL. An ante: BET / <NAME> {x}x / EVERY SPIN */
	confirmRow: { base: soc('BET', 'PLAY AMOUNT'), multiple: '{x}x', total: 'TOTAL', everySpin: soc('EVERY SPIN', 'EVERY PLAY') },
	confirmBuy: soc(
		'Loads **{name}** onto the Spin button. Nothing is charged until you press **Spin**, and that press plays **one feature round**.',
		'Loads **{name}** onto the Spin button. Nothing happens until you press **Spin**, and that press plays **one feature round**.',
	),
	confirmTitle: 'Confirm {name}',
	aria: {
		/** a tile's label: "EPIC, feature buy, 500 times the bet" (", on" appended when the mode is on) */
		tile: soc('{name}, {kind}, {x} times the bet', '{name}, {kind}, {x} times the play amount'),
		kind: { spin: soc('per spin mode', 'per play mode'), buy: soc('feature buy', 'feature') } satisfies Record<ArmouryGroup, string>,
		on: ', on',
		volatility: 'Volatility {n} of 4',
		/** the HUD's feature button with a mode on, behind the switch (it OPENS the menu on that mode, owner's answer 1):
		 *  its label at rest, plus which mode is on. Without the switch the button keeps "Disable Ante" / "Cancel X" */
		hudButtonOn: soc('Buy bonus, {name} on', 'Get bonus, {name} on'),
	},
} as const;

/** The ante's confirm sentence. "Triples" and "Ten times" are words for 3x and 10x, which the RGS owns: if it ever
 *  reprices either, the sentence falls back to "{x} times the bet on every spin" (spec 6.1; the probe checks both). */
export const anteConfirm = (mode: 'ANTE' | 'SUPER_ANTE'): string => {
	const x = modeCost(mode);
	const word = mode === 'ANTE' && x === 3 ? 'Triples' : mode === 'SUPER_ANTE' && x === 10 ? 'Ten times' : `${x} times`;
	return soc(`${word} the bet on every spin. **Stays on** until you switch it off.`, `${word} the play amount on every spin. **Stays on** until you switch it off.`);
};

/** a mode's name on the menu: the SHORT name, as on the HUD and the Spin button (betModeMeta.ts modeShortLabel) */
export const armouryName = (mode: ArmouryModeId): string => modeShortLabel(mode);

/** fill a template's named slots; a slot with no value is left as it is (the probe finds it) */
export const fill = (template: string, slots: Record<string, string | number>): string =>
	template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in slots ? String(slots[key]) : whole));

/** a status line less its leading chip ("ON. Active now. ..." -> "Active now. ..."): the menu draws the chip itself */
export const afterTag = (s: string, tag: string): string => (s.startsWith(`${tag}. `) ? s.slice(tag.length + 2) : s);

/** `**word**` to runs: odd runs are the gold key terms. Rendered as text nodes, never as HTML */
export const boldRuns = (s: string): { t: string; b: boolean }[] => s.split('**').map((t, i) => ({ t, b: i % 2 === 1 }));
