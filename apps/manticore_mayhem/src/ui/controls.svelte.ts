// Control-bar behaviour shared by the landscape/portrait chrome. Mirrors what the SDK's Pixi
// buttons (components-ui-pixi) do, so the xstate machine and RGS flow are untouched — only the skin changed.
import { Tween } from 'svelte/motion';
import { cubicOut } from 'svelte/easing';
import { stateBet, stateBetDerived, stateConfig, stateModal, stateUi, INFINITY_MARK } from 'state-shared';
import { numberToCurrencyString, bookEventAmountToCurrencyString } from 'utils-shared/amount';

import { getContext } from '../game/context';
import { betCostFull } from '../game/modeChipData';
import { modeShortLabel } from '../game/betModeMeta';
import { soc } from '../game/social';
import type { AutoLoadout } from '../game/stateGame.svelte';
import { SLAM_HURRY } from '../game/constants';
import { armouryView } from './armoury/armouryView.svelte';
import { hudWin } from '../game/hudWin.svelte';

export const createControls = () => {
	const context = getContext();

	let stopDisabled = $state(false);

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => {
			stopDisabled = true;
			// a slam-stop finishes the reels fast; under an operator's disabledTurbo the reels keep
			// their normal speed (the stop still lands, the turbo flag never flips)
			if (!jurisdiction().disabledTurbo) {
				stateBetDerived.updateIsTurbo(true, { persistent: false });
				// THE HURRY (2026-10-13). The shared flag above is all the slam stop ever set, and this game's motion does
				// not read it (it runs on its own TURBO_SCALE by stateGame.turboLevel), so until now a STOP press changed
				// nothing on this board. The rest of the spin now runs at the fastest level the operator allows
				// (stateGame.hurryLevel: speed only, the one reader is timeScale()).
				if (SLAM_HURRY) context.stateGame.hurryLevel = maxTurboLevel() as 0 | 1 | 2;
			}
		},
		stopButtonEnable: () => {
			stopDisabled = false;
			stateBetDerived.updateIsTurbo(false, { persistent: false });
			context.stateGame.hurryLevel = 0;
		},
		// a tap on the board (components/BoardTap.svelte): the Spin press of a live spin, by the same function
		boardTap: () => {
			boardTap();
		},
	});

	const isIdle = () => context.stateXstateDerived.isIdle();
	// an open round is still waiting to be resumed after a reload (stateGame.resumeHold): every control that
	// starts a round or changes the bet shows its normal disabled state until that round has been handed over
	const held = () => context.stateGame.resumeHold;
	const isReplay = () => stateUi.config.mode === 'replay';
	const anteActive = () => stateBetDerived.activeBetMode()?.type === 'activate';
	// armed buy mode: a selected feature (BONUS/SUPER/MYSTERY) loaded on the spin button for ONE round
	// the KEY, always upper case: a replay or a resumed round can hand the key over in the URL's or the
	// RGS's own case (mode=bonus), and callers compare it with the upper-case card keys
	const armedBuy = () => (stateBetDerived.activeBetMode()?.type === 'buy' ? stateBet.activeBetModeKey.toUpperCase() : null);
	/** short mode name for the HUD label, the Spin button face and the feature button: BONUS / SUPER /
	 *  EPIC / MYSTERY, read from the mode table (game/betModeMeta.ts modeShortLabel), never the raw key */
	const armedLabel = () => {
		const key = armedBuy();
		return key === null ? null : modeShortLabel(key);
	};
	const cancelArmed = () => {
		stateBet.activeBetModeKey = 'BASE';
		context.stateGame.autoLoadout = null; // one gesture, clean slate: mode AND autoplay unload
	};
	const autoRunning = () => stateBetDerived.hasAutoBetCounter();
	const autoCount = () => stateBet.autoSpinsCounter;
	const autoCountText = () => (stateBet.autoSpinsCounter === Infinity ? INFINITY_MARK : `${stateBet.autoSpinsCounter}`);
	const canAfford = () => betCostFull() > 0 && betCostFull() <= stateBet.balanceAmount;
	// Full price of one press for the spin-button face — the FULL currency string, never
	// abbreviated (Stake review 2026-09-20). The button measures it and shrinks or drops the line
	// if it will not fit (SquareSpin.svelte + game/textFit.ts).
	const playCostText = () => numberToCurrencyString(betCostFull());

	const sound = (type: 'soundPressGeneral' | 'soundPressBet' | 'soundPressMinor' | 'soundPressSub' | 'soundPressBonus') =>
		context.eventEmitter.broadcast({ type });

	// ── spin / stop ──────────────────────────────────────────────────────
	// Idle + unaffordable stays PRESSABLE: the press opens the balance notice (submission checklist:
	// tell the player, send no play request). A disabled button could never reach that card.
	const spinDisabled = () => held() || (isIdle() ? betCostFull() <= 0 : (stopDisabled && !autoRunning()) || jurisdiction().disabledSlamstop);
	const showStop = () => !isIdle() && !autoRunning() && !jurisdiction().disabledSlamstop;
	const spin = () => {
		if (held()) return;
		if (isIdle() && !canAfford()) {
			sound('soundPressMinor');
			stateModal.modal = { name: 'autoSpinMessage', message: 'insufficientBalance' };
			return;
		}
		sound('soundPressBet');
		if (isIdle()) {
			// a loaded autoplay run: the Spin press is what starts it
			if (context.stateGame.autoLoadout) {
				startLoadout();
				return;
			}
			// an armed buy mode (BONUS/SUPER/MYSTERY) plays ONE feature round: bookEventHandlerMap's
			// finalWin drops it back to BASE when the round ends (Stake review 2026-09-20)
			context.eventEmitter.broadcast({ type: 'bet' });
			return;
		}
		if (autoRunning()) {
			stateBet.autoSpinsCounter = 0;
			context.eventEmitter.broadcast({ type: 'stopButtonClick' });
			return;
		}
		slamStop();
	};
	/** THE SLAM STOP: what a Spin press does during a live spin, and a tap on the board through boardTap below. The
	 *  ONE function for both, so both honour the same switches: nothing under jurisdiction.disabledSlamstop, once per
	 *  spin, and under disabledTurbo the stop lands with no speed up (the stopButtonClick subscriber above). Speed
	 *  only: it never touches an outcome and awaits nothing. Returns whether it took. */
	const slamStop = (): boolean => {
		if (jurisdiction().disabledSlamstop) return false; // operator flag: reels always run their full spin
		if (stopDisabled) return false;
		context.eventEmitter.broadcast({ type: 'stopButtonClick' });
		return true;
	};
	/** A TAP ON THE BOARD (Corey 2026-10-13: "touching the board during anticipation should end the anticipation
	 *  and/or rapidly speed it up the spin through clusters. (obviously not with that switch)"). Only during a live
	 *  spin (drop, tease, cascades, a feature's spins): not at rest (a tap never starts a round), not while a round is
	 *  held for a resume, not in a replay (Spin is the REPLAY banner there), not under a modal, the landing screen, a
	 *  press gate, a plaque or a win screen, not while SKIP TO RESULT runs. During autoplay it hurries the spin and
	 *  does NOT end the run (the Spin press does; a board tap changes speed only). */
	const boardTap = (): boolean => {
		const sg = context.stateGame;
		if (held() || isReplay() || isIdle()) return false;
		if (stateModal.modal != null || context.stateLayout.showLoadingScreen || sg.pressGates > 0 || sg.winShowing || sg.plaque !== null || sg.skipping) return false;
		// "obviously not with that switch": a tap is a speed up and nothing else, so with the operator's turbo off it
		// is refused outright (no press sound, the STOP face untouched), like under disabledSlamstop in slamStop
		if (jurisdiction().disabledTurbo) return false;
		if (!slamStop()) return false;
		sound('soundPressBet');
		return true;
	};

	// ── autoplay (loadout flow: configure → LOAD to the spin button → Spin starts the run) ──
	const autoLoadout = () => context.stateGame.autoLoadout;
	const autoDisabled = () => held() || stateBet.isSpaceHold || (!isIdle() && !autoRunning()) || !canAfford();
	const autoPress = () => {
		if (jurisdiction().disabledAutoplay || held()) return;
		sound('soundPressMinor');
		if (autoRunning()) {
			stateBet.autoSpinsCounter = 0;
			return;
		}
		stateModal.modal = { name: 'autoSpin' }; // SDK modal-name union; our AutoplayModal owns it
	};
	/** park a configured run on the spin button; nothing plays until Spin is pressed */
	const loadAutoplay = (loadout: AutoLoadout) => {
		context.stateGame.autoLoadout = loadout;
		stateModal.modal = null;
		sound('soundPressMinor'); // the autoplay card's ACTIVATE (LOAD) — minor click, like the bonus ACTIVATEs
	};
	const clearAutoplay = () => {
		context.stateGame.autoLoadout = null;
	};
	const startLoadout = () => {
		const loadout = context.stateGame.autoLoadout;
		if (!loadout || held()) return;
		// An autoplay run never plays a bought feature: the run would re-buy at the feature price on
		// every press with no per-round confirmation (Stake review 2026-09-20). Drop the armed buy
		// before the run starts, exactly as the SDK's own AutoSpinsStartButton does. Ante persists.
		if (armedBuy()) stateBet.activeBetModeKey = 'BASE';
		const perSpin = betCostFull();
		stateBet.autoSpinsCounter = loadout.count;
		// loss stop = cumulative net loss since the run began (SDK tracks balance delta); win stop =
		// one spin's win. Both as multiples of a single spin's play amount; null = off.
		stateBet.autoSpinsLossLimitAmount = loadout.lossMult ? loadout.lossMult * perSpin : Infinity;
		stateBet.autoSpinsSingleWinLimitAmount = loadout.winMult ? loadout.winMult * perSpin : Infinity;
		// the SDK text fields carry a narrow preset union used only by its own (unmounted) UI — the
		// real limits are the amount fields above
		stateUi.autoSpinsLossLimitText = INFINITY_MARK;
		stateUi.autoSpinsSingleWinLimitText = INFINITY_MARK;
		// the run is always base/ante now (any armed buy was dropped above), so the player's choice stands
		context.stateGame.autoStopOnFreeGames = loadout.stopFree;
		// door screens self-continue only while the run is live (autoBonusesRunning checks the counter)
		context.stateGame.autoPlayBonuses = loadout.autoBonuses;
		context.stateGame.autoLoadout = null; // consumed: one load = one run
		context.eventEmitter.broadcast({ type: 'autoBet' });
	};

	// ── turbo (SDK is on/off; the design's third "instant" state has no SDK equivalent) ──
	// Cycles off → turbo → instant. Levels 1 and 2 both set the SDK turbo flag; level 2 also swaps the
	// reel spin options for SPIN_OPTIONS_INSTANT (stateGame.svelte.ts).
	const turboLevel = () => context.stateGame.turboLevel;
	// level 2 (instant) is the "super turbo" an operator can forbid on its own
	const maxTurboLevel = () => (jurisdiction().disabledTurbo ? 0 : jurisdiction().disabledSuperTurbo ? 1 : 2);
	const turboPress = () => {
		if (jurisdiction().disabledTurbo) return;
		sound('soundPressMinor');
		const next = ((context.stateGame.turboLevel + 1) % (maxTurboLevel() + 1)) as 0 | 1 | 2;
		context.stateGameDerived.setTurboLevel(next);
		// a press during a bonus lasts that bonus only; the base level is what comes back at the end
		if (context.stateGame.gameType !== 'freegame') context.stateGame.baseTurboLevel = next;
	};
	// the base level is remembered between sessions (stateGame.svelte.ts): a saved level the
	// operator forbids is clamped the moment the jurisdiction block lands
	$effect(() => {
		if (context.stateGame.turboLevel > maxTurboLevel()) context.stateGameDerived.setTurboLevel(maxTurboLevel() as 0 | 1 | 2);
		if (context.stateGame.baseTurboLevel > maxTurboLevel()) context.stateGame.baseTurboLevel = maxTurboLevel() as 0 | 1 | 2;
	});

	// ── bonus / ante ─────────────────────────────────────────────────────
	// operator jurisdiction flags from authenticate (stateConfig.jurisdiction): a disabled feature is
	// hidden by the chrome AND refused here, so nothing can reach it via a hotkey or a stale button.
	// Consumed: disabledBuyFeature, disabledAutoplay, disabledTurbo, disabledSuperTurbo,
	// disabledSlamstop, disabledSpacebar, socialCasino (Game.svelte), minimumRoundDuration
	// (utils-xstate), displayRTP / displayNetPosition / displaySessionTimer (MenuButton.svelte).
	// disabledFullscreen: the game has no fullscreen control of its own, so there is nothing to hide.
	const jurisdiction = () => stateConfig.jurisdiction;
	const bonusDisabled = () => held() || !isIdle() || jurisdiction().disabledBuyFeature;
	const bonusPress = () => {
		// refused under disabledBuyFeature as well as hidden (THE ARMOURY spec 7.1: the comment above said so, the code
		// only had the button's own disabled state and its absence)
		if (held() || jurisdiction().disabledBuyFeature) return;
		// Corey 2026-09-02: the bonus head button has its own voice again (ui-bonus.ogg, remixed);
		// turbo / autoplay / denomination / menu share the minor click, the rest the general click
		sound('soundPressBonus');
		// THE ARMOURY (owner 2026-10-13 22:18, answer 1): with a mode on, the button OPENS the menu on that mode;
		// switching off (and unloading a waiting autoplay run with it, cancelArmed) happens inside the menu
		stateModal.modal = { name: 'buyBonus' };
	};
	const activateMode = (mode: string) => {
		if (held()) return;
		stateBet.activeBetModeKey = mode;
		stateUi.autoSpinsLossLimitText = INFINITY_MARK;
		stateUi.autoSpinsSingleWinLimitText = INFINITY_MARK;
		stateModal.modal = null;
	};
	const buyMode = (mode: string) => {
		if (held()) return;
		// arm only: the feature loads onto the spin button for ONE round. Nothing is charged and
		// nothing plays until the player presses Spin, and the round's finalWin returns the game to
		// the base game, so the next feature round is a fresh selection + confirmation.
		stateBet.activeBetModeKey = mode;
		stateModal.modal = null;
		sound('soundPressGeneral'); // a modal button like any other: the shared UI click
	};

	// ── bet amount ───────────────────────────────────────────────────────
	const betOptions = () => stateConfig.betAmountOptions;
	const betDisabled = () => held() || !isIdle();
	const openDenom = () => {
		// never while THE ARMOURY is shown: the bet picker would replace it (its lit bet readout takes no pointer too)
		if (betDisabled() || armouryView.shown) return;
		sound('soundPressMinor');
		stateModal.modal = { name: 'betAmountMenu' };
	};
	// silent: a caller that already voiced the press (the autoplay card's stepper uses the sub click)
	const setBet = (value: number, opts?: { silent?: boolean }) => {
		if (held()) return;
		if (!opts?.silent) sound('soundPressGeneral');
		stateBetDerived.setBetAmount(value);
	};

	// ── menu ─────────────────────────────────────────────────────────────
	const menuPress = () => {
		sound('soundPressMinor');
		stateUi.menuOpen = !stateUi.menuOpen;
	};
	const openGameInfo = () => {
		sound('soundPressMinor'); // the rules button shares the menu's minor click
		stateUi.menuOpen = false;
		stateModal.modal = { name: 'gameRules' };
	};

	// ── readouts ─────────────────────────────────────────────────────────
	// BALANCE is a wallet readout, not a win: it never shows the sub-cent tail that
	// numberToCurrencyString extends to for WIN amounts (play at the $0.01 denomination left it
	// reading "$10,069.789" — Corey 2026-09-02). Capped at the currency's own minor units, so
	// USD/SC/GC land on 2 (a whole GC balance still prints whole) and JPY still shows 0.
	const balanceText = () => numberToCurrencyString(stateBet.balanceAmount, { maximumFractionDigits: 2 });
	// WIN counts UP toward the live book value (winInfo applies the spin total as the combos
	// reveal, and this tween chases it — Mother Clucker timing); a reset to a smaller value
	// (new spin) snaps instead of counting backwards
	const winTween = new Tween(stateBet.winBookEventAmount, { duration: 550, easing: cubicOut });
	// a win that replaces one an autoplay press kept up (game/hudWin.svelte.ts, HUD_WIN_CARRY) counts from zero, as by hand
	let winFresh = hudWin.fresh;
	$effect(() => {
		const target = stateBet.winBookEventAmount;
		const fresh = hudWin.fresh;
		if (fresh !== winFresh) {
			winFresh = fresh;
			// from zero by the interpolation, not a set(0) first: an instant set stops only the newest count, and the
			// count before it (still running when the next autoplay round came in fast) kept pulling the WIN back up
			winTween.set(target, { interpolate: (_from: number, to: number) => (u: number) => to * u });
			return;
		}
		if (target < winTween.current) winTween.set(target, { duration: 0 });
		else winTween.set(target);
	});
	// the count shows the digits its FINAL amount needs (harsh review 2026-10-20 gameplay 5, "$0.784" mid count at a $1.60
	// bet; Corey 2026-10-21 "Yes, unless the final win is a fraction that need to carry decimals, like player betting .01
	// cents"): cents normally, more only when the final win itself carries them; the last frame is the book's amount
	const winText = () => bookEventAmountToCurrencyString(Math.round(winTween.current), { fractionDigitsOfBookAmount: stateBet.winBookEventAmount });
	// SPIN readout = the full price of the next press, whatever is armed: with a 300× feature loaded
	// the SDK's betCost() still reported the base amount here while the button charged 300× (Stake
	// review 2026-09-05). betCostFull covers every mode, replay included.
	const betText = () => numberToCurrencyString(betCostFull());
	// The label over that readout. "$100.00 / SPIN" read as a 100x charge PER FREE SPIN (Stake review
	// 2026-09-20), so while a BOUGHT feature is armed or playing the label names the mode instead of
	// the unit: BONUS / SUPER / MYSTERY (the mode key is the short name the Chow Line cards use). Base
	// play, a natural feature and Ante keep SPIN / PLAY (Corey 2026-09-20): their price is per spin.
	const betLabel = () => armedLabel() ?? soc('SPIN', 'PLAY');
	const hasWin = () => stateBet.winBookEventAmount > 0;
	const freeSpin = () =>
		context.stateGame.gameType === 'freegame' && context.stateGame.totalFs > 0
			? { current: Math.min(context.stateGame.spinsPlayed + 1, context.stateGame.totalFs), total: context.stateGame.totalFs } // spinsPlayed = completed spins; show the one in play
			: null;

	return {
		isIdle, isReplay, anteActive, armedBuy, armedLabel, cancelArmed, playCostText, autoRunning, autoCount, autoCountText, canAfford,
		playCost: betCostFull,
		spinDisabled, showStop, spin, slamStop, boardTap,
		autoDisabled, autoPress, autoLoadout, loadAutoplay, clearAutoplay,
		turboPress, turboLevel,
		bonusDisabled, bonusPress, activateMode, buyMode, jurisdiction,
		betOptions, betDisabled, openDenom, setBet,
		menuPress, openGameInfo,
		balanceText, winText, betText, betLabel, hasWin, freeSpin,
		sound,
	};
};

export type Controls = ReturnType<typeof createControls>;
export const fmtCurrency = numberToCurrencyString;
