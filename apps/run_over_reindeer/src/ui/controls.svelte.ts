// Control-bar behaviour shared by the landscape/portrait chrome. Mirrors what the SDK's Pixi
// buttons (components-ui-pixi) do, so the xstate machine and RGS flow are untouched: only the skin changed.
import { Tween } from 'svelte/motion';
import { untrack } from 'svelte';
import { cubicOut } from 'svelte/easing';
import { stateBet, stateBetDerived, stateConfig, stateModal, stateUi, INFINITY_MARK } from 'state-shared';
import { numberToCurrencyString, bookEventAmountToCurrencyString } from '../game/currency';

import { getContext } from '../game/context';
import { betCostFull } from '../game/modeChipData';
import { modeShortLabel } from '../game/betModeMeta';
import { soc } from '../game/social';
import type { AutoRun } from '../game/stateGame.svelte';
import { SLAM_HURRY, SPIN_TAIL } from '../game/constants';

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
	// armed buy mode: a selected feature (BONUS / SUPER) loaded on the spin button for ONE round
	// the KEY, always upper case: a replay or a resumed round can hand the key over in the URL's or the
	// RGS's own case (mode=bonus), and callers compare it with the upper-case card keys
	const armedBuy = () => (stateBetDerived.activeBetMode()?.type === 'buy' ? stateBet.activeBetModeKey.toUpperCase() : null);
	/** short mode name for the HUD label, the Spin button face and the feature button: BONUS / SUPER,
	 *  read from the mode table (game/betModeMeta.ts modeShortLabel), never the raw key */
	const armedLabel = () => {
		const key = armedBuy();
		return key === null ? null : modeShortLabel(key);
	};
	const cancelArmed = () => {
		stateBet.activeBetModeKey = 'BASE';
	};
	const autoRunning = () => stateBetDerived.hasAutoBetCounter();
	const autoCount = () => stateBet.autoSpinsCounter;
	const autoCountText = () => (stateBet.autoSpinsCounter === Infinity ? INFINITY_MARK : `${stateBet.autoSpinsCounter}`);
	const canAfford = () => betCostFull() > 0 && betCostFull() <= stateBet.balanceAmount;
	// AUTOPLAY NEVER PLAYS A LOADED FEATURE (2026-11-19, the rule startAutoplay below has kept since the Stake review of
	// 2026-09-20, now on the screen too): a loaded feature and a run never coexist. START in the Autoplay menu unloads a
	// loaded Free Spins or Super Free Spins round as the run begins (startAutoplay), the Fast Lane cannot load one during a
	// run (buyMode), and every amount the Autoplay menu shows is the price of what the run will play: the base amount with
	// a feature loaded (it is unloaded on START), the full Ante price with the Ante on (the Ante persists through a run).
	const autoSpinCost = () => (armedBuy() ? stateBet.betAmount : betCostFull());
	const canAffordAuto = () => autoSpinCost() > 0 && autoSpinCost() <= stateBet.balanceAmount;
	// Full price of one press for the spin-button face: the FULL currency string, never
	// abbreviated (Stake review 2026-09-20). The button measures it and shrinks or drops the line
	// if it will not fit (ui/hud/HudSpin.svelte, ui/sign/SignPlay.svelte).
	const playCostText = () => numberToCurrencyString(betCostFull());

	const sound = (type: 'soundPressGeneral' | 'soundPressBet' | 'soundPressMinor' | 'soundPressSub' | 'soundPressBonus') =>
		context.eventEmitter.broadcast({ type });

	// ── spin / stop ──────────────────────────────────────────────────────
	// Idle + unaffordable stays PRESSABLE: the press opens the balance notice (submission checklist:
	// tell the player, send no play request). A disabled button could never reach that card.
	// THE SUPER WHEEL AT REST (game/road/superWheel.ts; Corey 2026-11-18: "When a player clicks spin, Reindeer runs in to
	// spin it"): the Spin key is live and is the wheel's, whatever else is true (a slam stop already spent, an operator's
	// slam stop off, a run of autoplay: the press starts the wheel and does nothing else; the Auto key still stops a run)
	const wheelWaits = () => context.stateGame.wheelPhase === 'rest';

	// ── THE ROUND'S TAIL (2026-11-22, Corey: "Flip the button to spin seems like the right choice there, after the round
	// settles it's animations and such." and why: "the player might think it will speed up it finishing again, not hit
	// another spin") ──
	// Once the round's last book event (finalWin) has played, the board is settled: every reveal, strike, column and line
	// show before it was awaited, and a big win's count or a Total Win card holds the round before finalWin. What is left of
	// the round is no presentation a Stop could shorten, only the strip's small count (game/utils.ts ledCountDone), the
	// operator's minimum round time, the end-round request and the autoplay machine's own last checks. The key is Spin from
	// that moment, and the press is always the next round's:
	//   - ONE RULE, ONE MOMENT: the key reads Stop until finalWin, Spin from finalWin on; a press is judged by what the key
	//     showed. A press while it reads Stop only stops (never a round, whatever comes after it); a press while it reads
	//     Spin always starts the next round.
	//   - A Spin press in the tail completes the readout at once (the strip's count and the HUD's WIN land on the round's
	//     total, components/Board.svelte roundTailFinish) and is kept until the round machine is idle (the end-round has
	//     credited the balance), then starts the round as a press at rest does. The earlier round's win is credited once,
	//     by its own end-round, before the next play is sent.
	//   - A press within SPIN_TAIL.flipGraceMs of the change from Stop to Spin was aimed at the Stop the player saw: it
	//     completes the readout and starts nothing.
	//   - Autoplay keeps its own key (the run's stop) and its own pacing; a resumed round, a replay and the Super Wheel keep
	//     theirs. Outcomes are untouched: this only decides what a press does and when.
	/** a Spin press taken in the tail, waiting for the round machine to be idle */
	let tailPress = $state(false);
	/** a press made after it (the key then reads Stop): the slam of the round it starts */
	let tailSlam = $state(false);
	/** the moment the key turned from Stop to Spin in this tail (performance.now), null while it does not read Spin (set
	 *  as the change reaches the page; a press before that saw Stop) */
	let tailFlipAt: number | null = null;
	const screenOwned = () => {
		const sg = context.stateGame;
		return sg.pressGates > 0 || sg.roundCard !== null || sg.plaque !== null || sg.winShowing;
	};
	/** the round machine still runs its round, but the board is settled and nothing is left that a Stop could shorten */
	const inTail = () => !isIdle() && context.stateGame.roundSettled && !held() && !isReplay() && !wheelWaits() && !autoRunning() && !screenOwned();
	/** the key reads Spin in the tail (until a press there is taken) */
	const tailSpin = () => inTail() && !tailPress;
	/** the key shows its at-rest faces (Spin, an armed feature): the round machine idle, or the tail */
	const keyIdle = () => isIdle() || tailSpin();
	$effect(() => {
		const on = tailSpin();
		untrack(() => (tailFlipAt = on ? performance.now() : null));
	});
	/** the key has read Spin long enough that a press is aimed at it */
	const tailSpinSeen = () => tailFlipAt !== null && performance.now() - tailFlipAt >= SPIN_TAIL.flipGraceMs;
	/** the readout of the round being left lands at once (the strip's count, the HUD's WIN) */
	const finishTail = () => {
		winTween.set(stateBet.winBookEventAmount, { duration: 0 });
		context.eventEmitter.broadcast({ type: 'roundTailFinish' });
	};
	/** what a press at rest does (no press sound: the caller voiced it) */
	const pressAtRest = () => {
		// an armed buy mode (BONUS / SUPER) plays ONE feature round: bookEventHandlerMap's
		// finalWin drops it back to BASE when the round ends (Stake review 2026-09-20)
		context.eventEmitter.broadcast({ type: 'bet' });
	};
	// the kept press starts its round once the machine is idle (the balance is the settled one by then); a modal that came
	// up meanwhile (an end-round failure's notice) or a round held for a resume drops it
	$effect(() => {
		if (!tailPress || !isIdle()) return;
		untrack(() => {
			const slam = tailSlam;
			tailPress = false;
			tailSlam = false;
			if (held() || isReplay() || stateModal.modal != null) return;
			if (!canAfford()) {
				stateModal.modal = { name: 'autoSpinMessage', message: 'insufficientBalance' };
				return;
			}
			pressAtRest();
			// the Stop pressed while the kept press waited: the new round's slam (the round has started: the machine left idle)
			if (slam && !isIdle()) slamStop();
		});
	});

	const spinDisabled = () => held() || (wheelWaits() ? false : keyIdle() ? betCostFull() <= 0 : tailPress ? tailSlam || jurisdiction().disabledSlamstop : (stopDisabled && !autoRunning()) || jurisdiction().disabledSlamstop);
	const showStop = () => !keyIdle() && !wheelWaits() && !autoRunning() && !jurisdiction().disabledSlamstop;
	const spin = () => {
		if (held()) return;
		if (wheelWaits()) {
			sound('soundPressBet');
			context.eventEmitter.broadcast({ type: 'wheelPress' });
			return;
		}
		// THE TAIL (above): a press on the Spin it shows is the next round's; one in the first frames after the change was
		// aimed at the Stop shown before it, and only completes the readout
		if (tailSpin()) {
			finishTail();
			if (!tailSpinSeen()) return;
			sound('soundPressBet');
			tailPress = true;
			return;
		}
		// a press while the kept press waits: the key reads Stop, so it stops (the round it starts), never a second round
		if (tailPress) {
			if (jurisdiction().disabledSlamstop || tailSlam) return;
			sound('soundPressBet');
			tailSlam = true;
			return;
		}
		if (isIdle() && !canAfford()) {
			sound('soundPressMinor');
			stateModal.modal = { name: 'autoSpinMessage', message: 'insufficientBalance' };
			return;
		}
		sound('soundPressBet');
		if (isIdle()) {
			pressAtRest();
			return;
		}
		if (autoRunning()) {
			stateBet.autoSpinsCounter = 0;
			// (the run's round still live: its stop too. Once its board has settled there is nothing left to stop, and the
			// slam's flag and hurry would outlive the round: the autoplay pause gives them back only when one is owed)
			if (!context.stateGame.roundSettled) context.eventEmitter.broadcast({ type: 'stopButtonClick' });
			return;
		}
		slamStop();
	};
	/** a press now starts a round (the key reads Spin and the press is not in the change's first frames): the probes'
	 *  pressReady. Not a resumed round's hold, a replay, the wheel's press or a press under a modal or a press gate. */
	const pressStartsRound = () => {
		if (held() || isReplay() || wheelWaits() || stateModal.modal != null || context.stateGame.pressGates > 0) return false;
		if (isIdle()) return !tailPress && !context.stateGame.busy;
		return tailSpin() && tailSpinSeen();
	};
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		// house rule: extend __reindeer, never a new global. pressReady: a Spin press now starts a round (at rest, or in a
		// round's tail); spinTail: the tail as the controls see it (tools/hud_probe.mjs section `tail`)
		Object.assign(((window as unknown as { __reindeer?: Record<string, unknown> }).__reindeer ??= {}), {
			pressReady: pressStartsRound,
			spinTail: () => ({ tail: inTail(), spin: tailSpin(), kept: tailPress, slam: tailSlam, flipAt: tailFlipAt, graceMs: SPIN_TAIL.flipGraceMs, idle: isIdle(), settled: context.stateGame.roundSettled }),
		});
	}
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
		// the wheel at rest: a press on it or on the board starts it, as the Spin key does (a replay's too)
		// (asked before the press gate's own refusal below: the wheel's wait is a press gate, ui/WheelGate.svelte)
		if (wheelWaits() && !held() && stateModal.modal == null) {
			sound('soundPressBet');
			context.eventEmitter.broadcast({ type: 'wheelPress' });
			return true;
		}
		if (held() || isReplay() || isIdle()) return false;
		// the round's tail (above): the board is settled, a tap has nothing to hurry and never starts a round
		if (inTail()) return false;
		if (stateModal.modal != null || context.stateLayout.showLoadingScreen || sg.pressGates > 0 || sg.winShowing || sg.plaque !== null || sg.skipping) return false;
		// "obviously not with that switch": a tap is a speed up and nothing else, so with the operator's turbo off it
		// is refused outright (no press sound, the STOP face untouched), like under disabledSlamstop in slamStop
		if (jurisdiction().disabledTurbo) return false;
		if (!slamStop()) return false;
		sound('soundPressBet');
		return true;
	};

	// -- autoplay (2026-11-23, Corey: "What would it take to make that the Start Auto-play button and not have the load to
	// button state?" after a tester could not find how to start a run): configure in the Autoplay menu, then its START
	// key begins the run at once. The key names the count and the total and the player presses it inside the menu: that
	// press is the confirmation Stake asks for (one press on Auto only opens the menu). Nothing is parked on the Spin key.
	const autoDisabled = () => held() || stateBet.isSpaceHold || (!isIdle() && !autoRunning()) || !canAffordAuto();
	const autoPress = () => {
		if (jurisdiction().disabledAutoplay || held()) return;
		sound('soundPressMinor');
		if (autoRunning()) {
			stateBet.autoSpinsCounter = 0;
			return;
		}
		stateModal.modal = { name: 'autoSpin' }; // SDK modal-name union; our AutoplayModal owns it
	};
	/** START in the Autoplay menu: the run begins now, as the Spin press that started a loaded run did until 2026-11-23
	 *  (the same checks in the same order, the same press sound, the same autoBet event, so the first round's timing is
	 *  the Spin press's). Refused, with the card left as it was, while a round is held for a resume, in a replay, or
	 *  while a round is in play; a short balance shows the balance notice (in place of the menu) and starts nothing. */
	const startAutoplay = (run: AutoRun) => {
		if (jurisdiction().disabledAutoplay || held() || isReplay() || !isIdle() || autoRunning()) return;
		// the price of what the run will play (the base amount with a feature loaded: it is unloaded below): nothing
		// changes when it cannot be met, the loaded feature included
		if (!canAffordAuto()) {
			sound('soundPressMinor');
			stateModal.modal = { name: 'autoSpinMessage', message: 'insufficientBalance' };
			return;
		}
		stateModal.modal = null;
		sound('soundPressBet');
		// An autoplay run never plays a bought feature: the run would re-buy at the feature price on every press with no
		// per-round confirmation (Stake review 2026-09-20). Drop the armed buy as the run starts, exactly as the SDK's own
		// AutoSpinsStartButton does. Ante persists.
		if (armedBuy()) stateBet.activeBetModeKey = 'BASE';
		const perSpin = betCostFull();
		stateBet.autoSpinsCounter = run.count;
		// loss stop = cumulative net loss since the run began (SDK tracks balance delta); win stop =
		// one spin's win. Both as multiples of a single spin's play amount; null = off.
		stateBet.autoSpinsLossLimitAmount = run.lossMult ? run.lossMult * perSpin : Infinity;
		stateBet.autoSpinsSingleWinLimitAmount = run.winMult ? run.winMult * perSpin : Infinity;
		// the SDK text fields carry a narrow preset union used only by its own (unmounted) UI: the
		// real limits are the amount fields above
		stateUi.autoSpinsLossLimitText = INFINITY_MARK;
		stateUi.autoSpinsSingleWinLimitText = INFINITY_MARK;
		// the run is always base/ante now (any armed buy was dropped above), so the player's choice stands
		context.stateGame.autoStopOnFreeGames = run.stopFree;
		// door screens self-continue only while the run is live (autoBonusesRunning checks the counter)
		context.stateGame.autoPlayBonuses = run.autoBonuses;
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
	// (utils-xstate), displayRTP / displayNetPosition / displaySessionTimer (ui/hud/HudMenuPanel.svelte, ui/sign/SignMenuPanel.svelte).
	// disabledFullscreen: the game has no fullscreen control of its own, so there is nothing to hide.
	const jurisdiction = () => stateConfig.jurisdiction;
	const bonusDisabled = () => held() || !isIdle() || jurisdiction().disabledBuyFeature;
	// THE FAST LANE KEY KEEPS ITS LOOK WHILE A ROUND PLAYS (Corey 2026-11-24: "while spinning the Fast Lane Button gets
	// visibly disabled, much like Manticore was, which is distracting for a user. For this game, I would suggest leaving
	// the button the way it is visibly during spins, and make user taps not work during a spin."). So two answers:
	// bonusDisabled, "a press does nothing now" (a spin, an autoplay run, a feature round, a held resume, the operator's
	// rule), and bonusShownOff, "and it LOOKS disabled": only the reasons that are not a round playing, a round still
	// held for its resume after a reload (every bet control shows disabled then, until it is handed over) and the
	// operator's disabledBuyFeature (where the bars do not draw the key at all). The keys draw by the second and
	// refuse presses by the first (ui/sign/SignFastLane.svelte, ui/hud/HudFeature.svelte).
	const bonusShownOff = () => held() || !!jurisdiction().disabledBuyFeature;
	const bonusPress = () => {
		// refused whenever the key cannot be pressed (a round playing too: the key is no longer a disabled button then,
		// so this is the guard), and under disabledBuyFeature as well as hidden
		if (bonusDisabled()) return;
		// Corey 2026-09-02: the bonus head button has its own voice again (ui-bonus.ogg, remixed);
		// turbo / autoplay / denomination / menu share the minor click, the rest the general click
		sound('soundPressBonus');
		// with a mode on, the button OPENS the feature menu on that mode; switching off (cancelArmed) happens inside
		// the menu (the house rule since Manticore's menu)
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
		// never during an autoplay run (the Fast Lane cannot open then: bonusDisabled; this is the last guard)
		if (held() || autoRunning()) return;
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
		// never while the feature menu is open: the bet picker would replace it
		if (betDisabled() || stateModal.modal?.name === 'buyBonus') return;
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
	// reading "$10,069.789", Corey 2026-09-02). Exactly the currency's own decimals from Stake's
	// table (game/currency.ts, 2026-11-21): USD, SC and GC 2 ("10.00 GC"), JPY 0, KWD 3, BTC 6.
	const balanceText = () => numberToCurrencyString(stateBet.balanceAmount, { fixed: true });
	// WIN counts UP toward the live book value (winInfo applies the spin total as the combos
	// reveal, and this tween chases it: Mother Clucker timing); a reset to a smaller value
	// (new spin) snaps instead of counting backwards
	const winTween = new Tween(stateBet.winBookEventAmount, { duration: 550, easing: cubicOut });
	// The tween's own value is read UNTRACKED (2026-10-21): reading it tracked re-ran this effect on every frame of a count
	// and started a new Tween task each time, so a clear (an instant set, which stops only the newest task) left the count
	// before it running, and it pulled WIN back up after the clear (seen under Autoplay at turbo 2). Now one task per
	// target: the count is the 550 ms cubicOut it was written as, and a clear stops it.
	$effect(() => {
		const target = stateBet.winBookEventAmount;
		if (target < untrack(() => winTween.current)) winTween.set(target, { duration: 0 });
		else winTween.set(target);
	});
	// the count shows the digits its FINAL amount needs (harsh review 2026-10-20 gameplay 5, "$0.784" mid count at a $1.60
	// bet; Corey 2026-10-21 "Yes, unless the final win is a fraction that need to carry decimals, like player betting .01
	// cents"): cents normally, more only when the final win itself carries them; the last frame is the book's amount
	const winText = () => bookEventAmountToCurrencyString(Math.round(winTween.current), { fractionDigitsOfBookAmount: stateBet.winBookEventAmount });
	// THE WIN ODOMETER (2026-11-21, Corey: "Odomoter roll defaults works for me"; ui/hud/winOdometer.ts): while the bonus
	// round's Total Win card is up on the LED board, WIN rolls and lands with the card's own count instead of showing the
	// total at once. This is the total it lands on, formatted as winText formats WIN (the card's amount, the book's round
	// total), or null when the readout is today's: no card, an entry card, the HTML card (no board), a total of 0, and the
	// capped wrap-up (the max win screen hides the bar: nothing rolls behind it)
	const winOdoText = () => {
		const c = context.stateGame.roundCard;
		if (!c || c.kind !== 'outro' || !c.board || c.capped || !(c.amount > 0)) return null;
		return bookEventAmountToCurrencyString(Math.round(c.amount), { fractionDigitsOfBookAmount: c.amount });
	};
	// SPIN readout = the full price of the next press, whatever is armed: with a 300× feature loaded
	// the SDK's betCost() still reported the base amount here while the button charged 300× (Stake
	// review 2026-09-05). betCostFull covers every mode, replay included.
	const betText = () => numberToCurrencyString(betCostFull());
	// The label over that readout. "$100.00 / SPIN" read as a 100x charge PER FREE SPIN (Stake review
	// 2026-09-20), so while a BOUGHT feature is armed or playing the label names the mode instead of
	// the unit: BONUS / SUPER (the mode's short name, as the feature menu's cards use it). Base
	// play, a natural feature and Ante keep SPIN / PLAY (Corey 2026-09-20): their price is per spin.
	const betLabel = () => armedLabel() ?? soc('SPIN', 'PLAY');
	const hasWin = () => stateBet.winBookEventAmount > 0;
	/** the round's win so far, book units (the Spin key's win flourish fires as it rises: ui/hud/HudSpin.svelte) */
	const winAmount = () => stateBet.winBookEventAmount;
	const freeSpin = () =>
		context.stateGame.gameType === 'freegame' && context.stateGame.totalFs > 0
			? { current: Math.min(context.stateGame.spinsPlayed + 1, context.stateGame.totalFs), total: context.stateGame.totalFs } // spinsPlayed = completed spins; show the one in play
			: null;

	return {
		isIdle, keyIdle, isReplay, anteActive, armedBuy, armedLabel, cancelArmed, playCostText, autoRunning, autoCount, autoCountText, canAfford,
		playCost: betCostFull,
		autoSpinCost,
		spinDisabled, showStop, spin, slamStop, boardTap, wheelWaits,
		autoDisabled, autoPress, startAutoplay,
		turboPress, turboLevel,
		bonusDisabled, bonusShownOff, bonusPress, activateMode, buyMode, jurisdiction,
		betOptions, betDisabled, openDenom, setBet,
		menuPress, openGameInfo,
		balanceText, winText, winOdoText, betText, betLabel, hasWin, winAmount, freeSpin,
		sound,
	};
};

export type Controls = ReturnType<typeof createControls>;
export const fmtCurrency = numberToCurrencyString;
