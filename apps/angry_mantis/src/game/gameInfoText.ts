import config from './config';
import { modeCost } from './betModeMeta';
import { soc } from './social';

// Verbatim Stake Engine template (docs: approval-guidelines/general-disclaimer).
export const DISCLAIMER =
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.';

const MODE_NAMES: Record<string, string> = { base: 'Base Game', ante: 'Ante', bonus: 'Free Spins', super: 'Super Free Spins', mystery: 'Mystery Spin' };
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const MODE_RTP_LINE = Object.entries(config.betModes)
	.map(([key, m]) => `${MODE_NAMES[key] ?? key.toUpperCase()} ${pct(m.rtp)}`)
	.join(', ');

/** THE OPERATOR'S SWITCHES the rules page follows (Manticore 2026-10-15, ported for 1.0.13; front-end-communication.md):
 *  authenticate's jurisdiction block (stateConfig.jurisdiction), the same flags the controls read (ui/controls.svelte.ts,
 *  ui/Chrome*.svelte, stateGame skipAllowed). A control the operator turns off is neither drawn nor described: its UI
 *  guide row goes (ui/GameInfoModal.svelte guideRowShown) and no other sentence names it. */
export type RulesFlags = {
	disabledAutoplay?: boolean;
	disabledTurbo?: boolean;
	disabledSuperTurbo?: boolean;
	disabledSlamstop?: boolean;
	disabledSpacebar?: boolean;
	disabledBuyFeature?: boolean;
};
/** SKIP TO RESULT exists only where both the slam stop and turbo are allowed (stateGame skipAllowed, the same rule) */
export const skipShown = (j: RulesFlags) => !j.disabledSlamstop && !j.disabledTurbo;
/** the UI guide's rows (ui/GameInfoModal.svelte), keyed for the operator's switches */
export type GuideId = 'spin' | 'turbo' | 'autoplay' | 'feature' | 'menu' | 'readouts' | 'keyboard' | 'skip' | 'screens';
/** the UI guide's rows under the operator's switches: no Turbo row under disabledTurbo, no Autoplay row under
 *  disabledAutoplay, no feature menu row under disabledBuyFeature (their buttons are not drawn: ui/Chrome*.svelte),
 *  no Skip to Result row where SKIP does not exist (skipShown). The Keyboard row stays under disabledSpacebar
 *  (Escape still closes a window); its text drops the Space bar. */
export const guideRowShown = (id: GuideId, j: RulesFlags): boolean => {
	if (id === 'turbo') return !j.disabledTurbo;
	if (id === 'autoplay') return !j.disabledAutoplay;
	if (id === 'feature') return !j.disabledBuyFeature;
	if (id === 'skip') return skipShown(j);
	return true;
};
/** "A and B" / "A" / "" */
export const andList = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : (xs[0] ?? ''));

// A function, not a constant: this module is evaluated at boot, but the buy prices below come from
// the authenticate response, which has only landed by the time the info modal is opened. `j`: the
// operator's switches (RulesFlags), so the text names no control the operator turned off.
export const rulesSections = (j: RulesFlags = {}) => [
	{
		title: 'HOW TO PLAY',
		paragraphs: [
			soc(
				`Choose a bet and press SPIN${j.disabledSpacebar ? '' : ' (or the spacebar)'}. Wins are formed by matching symbols on adjacent reels from left to right, in any row: 1,024 ways to win. Only the highest win per symbol is paid.`,
				`Choose a play amount and press SPIN${j.disabledSpacebar ? '' : ' (or the spacebar)'}. Wins are formed by matching symbols on adjacent reels from left to right, in any row: 1,024 ways to win. Only the highest win per symbol counts.`,
			),
			soc(
				'A single base game spin never pays more than 250x the bet. The total payout of any round is capped at 20,000x the bet.',
				'A single base game spin never wins more than 250x the play amount. The total win of any round is capped at 20,000x the play amount.',
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
				'Every Service Bell that lands during free spins rings for another Mantis Strike. If all eight paying symbols are eaten, the round pays the 20,000x max win immediately and the session ends. The cap is also reached whenever wins in a session add up to 20,000x the bet; either way the round ends and the cap is paid.',
				'Every Service Bell that lands during free spins rings for another Mantis Strike. If all eight menu symbols are eaten, the round wins the 20,000x max win immediately and the session ends. The cap is also reached whenever wins in a session add up to 20,000x the play amount; either way the round ends and the cap is won.',
			),
			`Each Marky scatter in free spins awards +1 extra spin, up to +${config.freeSpins.maxRetrigger} per session. Once the maximum extra spins have been awarded, Marky scatters stop appearing for the rest of the session. A spin that reaches the 20,000x cap ends the round at once and awards no extra spin.`,
			soc(`Every Mantis Feast session pays at least ${config.feastMinWin}x the bet.`, `Every Mantis Feast session wins at least ${config.feastMinWin}x the play amount.`),
			// the SKIP button (1.0.13); not where the operator disables the slam stop or turbo
			...(skipShown(j) ? ['Once the first free spin has started, Skip to Result ends the presentation of the remaining spins and shows the final total of the round. The outcome is unchanged.'] : []),
		],
	},
	{
		title: soc('ANTE BET', 'ANTE MODE'),
		paragraphs: [
			soc(
				`Ante Bet costs ${modeCost('ANTE')}x the bet. A Marky scatter is locked onto reel 1 for every spin, so only two more scatters are needed to trigger a feature. Features land about four times as often as in the base game.`,
				`Ante Mode is played for ${modeCost('ANTE')}x the play amount. A Marky scatter is locked onto reel 1 for every spin, so only two more scatters are needed to trigger a feature. Features land about four times as often as in the base game.`,
			),
		],
	},
	{
		title: soc('BONUS BUY', 'FEATURE MODES'),
		paragraphs: [
			soc(
				`Free Spins can be bought for ${modeCost('BONUS')}x the bet and Super Free Spins for ${modeCost('SUPER')}x. The Mystery Spin costs ${modeCost('MYSTERY')}x the bet and plays one spin: ${config.mystery.nothing * 100}% of Mystery Spins award nothing, ${config.mystery.super * 100}% award Super Free Spins and ${config.mystery.feast * 100}% award Mantis Feast. A Mystery Feast always pays at least ${config.feastMinWin}x the bet. Bought features follow the same rules as naturally triggered ones, but each mode is its own game: the odds of each outcome and the average win per session differ between a bought feature and a natural one, and every mode returns 96.00% of what is bet in it.`,
				`Free Spins can be played directly for ${modeCost('BONUS')}x the play amount and Super Free Spins for ${modeCost('SUPER')}x. The Mystery spin is played for ${modeCost('MYSTERY')}x the play amount and plays one spin: ${config.mystery.nothing * 100}% of Mystery spins award nothing, ${config.mystery.super * 100}% award Super Free Spins and ${config.mystery.feast * 100}% award Mantis Feast. A Mystery Feast always wins at least ${config.feastMinWin}x the play amount. Instantly triggered features follow the same rules as naturally triggered ones, but each mode is its own game: the odds of each outcome and the average win per session differ between an instantly triggered feature and a natural one, and every mode returns 96.00% of what is played in it.`,
			),
		],
	},
	{
		title: 'SETTINGS',
		paragraphs: [
			[
				j.disabledAutoplay ? '' : 'Autoplay requires confirmation before it starts and can be stopped at any time.',
				'Sound can be turned off in the settings menu.',
				j.disabledSpacebar ? '' : 'Spacebar spins.',
			]
				.filter(Boolean)
				.join(' '),
		],
	},
];
