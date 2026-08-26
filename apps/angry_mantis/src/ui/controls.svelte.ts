// Control-bar behaviour shared by the landscape/portrait chrome. Mirrors what the SDK's Pixi
// buttons (components-ui-pixi) do, so the xstate machine and RGS flow are untouched — only the skin changed.
import { stateBet, stateBetDerived, stateConfig, stateModal, stateUi, INFINITY_MARK } from 'state-shared';
import { numberToCurrencyString, bookEventAmountToCurrencyString } from 'utils-shared/amount';

import { getContext } from '../game/context';

export const createControls = () => {
	const context = getContext();

	let stopDisabled = $state(false);
	let autoOpen = $state(false);

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => {
			stopDisabled = true;
			stateBetDerived.updateIsTurbo(true, { persistent: false });
		},
		stopButtonEnable: () => {
			stopDisabled = false;
			stateBetDerived.updateIsTurbo(false, { persistent: false });
		},
	});

	const isIdle = () => context.stateXstateDerived.isIdle();
	const isReplay = () => stateUi.config.mode === 'replay';
	const anteActive = () => stateBetDerived.activeBetMode()?.type === 'activate';
	// armed buy mode: a selected feature (BONUS/SUPER/FEAST) that stays loaded on the spin button
	const armedBuy = () => (stateBetDerived.activeBetMode()?.type === 'buy' ? stateBet.activeBetModeKey : null);
	const armedLabel = () => (armedBuy() ? (stateBetDerived.activeBetMode()?.text?.betAmountLabel ?? armedBuy()) : null);
	const cancelArmed = () => {
		stateBet.activeBetModeKey = 'BASE';
	};
	/** small chip above the SPIN readout: ante, or the armed feature + the base bet it multiplies */
	const spinOverhead = () =>
		anteActive()
			? 'ANTE MODE'
			: armedBuy()
				? `${armedLabel()} · BET ${numberToCurrencyString(stateBet.betAmount)}`
				: null;
	const autoRunning = () => stateBetDerived.hasAutoBetCounter();
	const autoCount = () => stateBet.autoSpinsCounter;
	const autoCountText = () => (stateBet.autoSpinsCounter === Infinity ? INFINITY_MARK : `${stateBet.autoSpinsCounter}`);
	// full price of the next press: bet × mode multiplier. The SDK's betCost() applies the multiplier
	// only to 'activate' modes (buys are charged server-side), so an armed buy would read as the base
	// bet — wrong price on the button and no affordability gate. This covers all modes.
	const betCostFull = () => stateBet.betAmount * (stateBetDerived.activeBetMode()?.costMultiplier ?? 1);
	const canAfford = () => betCostFull() > 0 && betCostFull() <= stateBet.balanceAmount;

	const sound = (type: 'soundPressGeneral' | 'soundPressBet') => context.eventEmitter.broadcast({ type });

	// ── spin / stop ──────────────────────────────────────────────────────
	const spinDisabled = () => (isIdle() ? !canAfford() : stopDisabled && !autoRunning());
	const showStop = () => !isIdle() && !autoRunning();
	const spin = () => {
		sound('soundPressBet');
		if (isIdle()) {
			if (!canAfford()) return;
			// an armed buy mode (BONUS/SUPER/FEAST) stays loaded on this button: every press buys and
			// plays that feature again until the player switches it off (bonus button / cancelArmed)
			context.eventEmitter.broadcast({ type: 'bet' });
			return;
		}
		if (autoRunning()) {
			stateBet.autoSpinsCounter = 0;
			context.eventEmitter.broadcast({ type: 'stopButtonClick' });
			return;
		}
		if (!stopDisabled) context.eventEmitter.broadcast({ type: 'stopButtonClick' });
	};

	// ── autoplay ─────────────────────────────────────────────────────────
	const autoDisabled = () => stateBet.isSpaceHold || (!isIdle() && !autoRunning()) || !canAfford();
	const autoPress = () => {
		sound('soundPressGeneral');
		if (autoRunning()) {
			stateBet.autoSpinsCounter = 0;
			return;
		}
		autoOpen = !autoOpen;
	};
	const autoStart = (count: number) => {
		stateBet.autoSpinsCounter = count;
		stateBet.autoSpinsLossLimitAmount = Infinity;
		stateBet.autoSpinsSingleWinLimitAmount = Infinity;
		stateUi.autoSpinsLossLimitText = INFINITY_MARK;
		stateUi.autoSpinsSingleWinLimitText = INFINITY_MARK;
		if (stateBetDerived.activeBetMode()?.type === 'buy') stateBet.activeBetModeKey = 'BASE';
		autoOpen = false;
		sound('soundPressGeneral');
		context.eventEmitter.broadcast({ type: 'autoBet' });
	};

	// ── turbo (SDK is on/off; the design's third "instant" state has no SDK equivalent) ──
	// Cycles off → turbo → instant. Levels 1 and 2 both set the SDK turbo flag; level 2 also swaps the
	// reel spin options for SPIN_OPTIONS_INSTANT (stateGame.svelte.ts).
	const turboLevel = () => context.stateGame.turboLevel;
	const turboPress = () => {
		sound('soundPressGeneral');
		const next = ((context.stateGame.turboLevel + 1) % 3) as 0 | 1 | 2;
		context.stateGame.turboLevel = next;
		stateBetDerived.updateIsTurbo(next > 0, { persistent: true });
	};

	// ── bonus / ante ─────────────────────────────────────────────────────
	const bonusDisabled = () => !isIdle();
	const bonusPress = () => {
		context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_ui_bonus' });
		// same gesture as switching Ante off: while a mode is active/armed the head button disarms it
		if (anteActive() || armedBuy()) stateBet.activeBetModeKey = 'BASE';
		else stateModal.modal = { name: 'buyBonus' };
	};
	const activateMode = (mode: string) => {
		stateBet.activeBetModeKey = mode;
		stateUi.autoSpinsLossLimitText = INFINITY_MARK;
		stateUi.autoSpinsSingleWinLimitText = INFINITY_MARK;
		stateModal.modal = null;
	};
	const buyMode = (mode: string) => {
		stateBet.activeBetModeKey = mode;
		stateModal.modal = null;
		context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_ui_bonus' });
		context.eventEmitter.broadcast({ type: 'bet' });
	};

	// ── bet amount ───────────────────────────────────────────────────────
	const betOptions = () => stateConfig.betAmountOptions;
	const betDisabled = () => !isIdle();
	const openDenom = () => {
		if (betDisabled()) return;
		sound('soundPressGeneral');
		stateModal.modal = { name: 'betAmountMenu' };
	};
	const setBet = (value: number) => {
		sound('soundPressGeneral');
		stateBetDerived.setBetAmount(value);
	};
	const betIndex = () => betOptions().indexOf(stateBet.betAmount);
	const canStepBet = (dir: 1 | -1) => {
		const options = betOptions();
		if (!options.length) return false;
		const i = betIndex();
		if (i < 0) return true;
		return dir > 0 ? i < options.length - 1 : i > 0;
	};
	const stepBet = (dir: 1 | -1) => {
		const options = [...betOptions()].sort((a, b) => a - b);
		const next =
			dir > 0
				? options.find((o) => o > stateBet.betAmount)
				: [...options].reverse().find((o) => o < stateBet.betAmount);
		if (next !== undefined) setBet(next);
	};

	// ── menu ─────────────────────────────────────────────────────────────
	const menuPress = () => {
		sound('soundPressGeneral');
		stateUi.menuOpen = !stateUi.menuOpen;
	};
	const openGameInfo = () => {
		stateUi.menuOpen = false;
		stateModal.modal = { name: 'gameRules' };
	};

	// ── readouts ─────────────────────────────────────────────────────────
	const balanceText = () => numberToCurrencyString(stateBet.balanceAmount);
	const winText = () => bookEventAmountToCurrencyString(stateBet.winBookEventAmount);
	const betText = () => numberToCurrencyString(betCostFull());
	const hasWin = () => stateBet.winBookEventAmount > 0;
	const freeSpin = () =>
		context.stateGame.gameType === 'freegame' && context.stateGame.totalFs > 0
			? { current: Math.min(context.stateGame.spinsPlayed + 1, context.stateGame.totalFs), total: context.stateGame.totalFs } // spinsPlayed = completed spins; show the one in play
			: null;

	return {
		get autoOpen() { return autoOpen; },
		set autoOpen(v: boolean) { autoOpen = v; },
		isIdle, isReplay, anteActive, armedBuy, armedLabel, cancelArmed, spinOverhead, autoRunning, autoCount, autoCountText, canAfford,
		spinDisabled, showStop, spin,
		autoDisabled, autoPress, autoStart,
		turboPress, turboLevel,
		bonusDisabled, bonusPress, activateMode, buyMode,
		betOptions, betDisabled, openDenom, setBet, canStepBet, stepBet,
		menuPress, openGameInfo,
		balanceText, winText, betText, hasWin, freeSpin,
		sound,
	};
};

export type Controls = ReturnType<typeof createControls>;
export const fmtCurrency = numberToCurrencyString;
