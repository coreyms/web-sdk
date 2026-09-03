<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	import { requestAuthenticate, requestReplay } from 'rgs-requests';
	import { stateUrlDerived, stateBet, stateConfig, stateModal, stateUi } from 'state-shared';
	import { API_AMOUNT_MULTIPLIER, MOST_USED_BET_INDEXES } from 'constants-shared/bet';

	type Props = { children: Snippet };

	const props: Props = $props();

	let authenticated = $state(false);

	const authenticate = async () => {
		try {
			const authenticateData = await requestAuthenticate({
				rgsUrl: stateUrlDerived.rgsUrl(),
				sessionID: stateUrlDerived.sessionID(),
				language: stateUrlDerived.lang(),
			});

			// error
			if (authenticateData?.error) throw authenticateData;

			// balance
			if (authenticateData?.balance) {
				// Example of authenticateData.balance
				// {
				// 		"amount": 10000000000000000,
				// 		"currency": "USD"
				// },
				stateBet.currency = authenticateData.balance.currency;
				stateBet.balanceAmount = authenticateData.balance.amount / API_AMOUNT_MULTIPLIER;
			}

			// config
			if (authenticateData?.config) {
				// Example of authenticateData.config
				// {
				// 	"gameID": "37_test-lines",
				// 	"minBet": 100000,
				// 	"maxBet": 1000000000,
				// 	"stepBet": 10000,
				// 	"defaultBetLevel": 1000000,
				// 	"betLevels": [100000, 200000, ..., 1000000000],
				// 	"betModes": {},
				// 	"jurisdiction": {
				// 			"socialCasino": false,
				// 			"disabledFullscreen": false,
				// 			"disabledTurbo": false,
				// 			"disabledSuperTurbo": false,
				// 			"disabledAutoplay": false,
				// 			"disabledSlamstop": false,
				// 			"disabledSpacebar": false,
				// 			"disabledBuyFeature": false,
				// 			"displayNetPosition": false,
				// 			"displayRTP": false,
				// 			"displaySessionTimer": false,
				// 			"minimumRoundDuration": 0
				// 	}
				// }
				stateConfig.jurisdiction = authenticateData?.config?.jurisdiction;
				stateConfig.betAmountOptions = (authenticateData.config?.betLevels || []).map(
					(level) => level / API_AMOUNT_MULTIPLIER,
				);
				stateConfig.betMenuOptions = stateConfig.betAmountOptions.filter((_, index) =>
					MOST_USED_BET_INDEXES.includes(index),
				);

				// WHY: cost multipliers are a betting parameter the RGS owns, and the submission
				// checklist requires the game to use the authenticate response's values rather than a
				// build-time copy — a math re-publish that reprices a buy (FEAST 2000x -> 1000x,
				// 2026-09-02) must never leave the UI quoting a price /wallet/play does not charge.
				// Three shapes are tolerated: the documented map { BASE: { costMultiplier } }, an
				// array of those same objects, and a plain array of mode names (what our mock RGS
				// sends) which carries no cost at all — modes with no cost in the response keep no
				// entry here, so the game falls back to its local math config for them.
				const toPositive = (value: unknown) =>
					typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
				const rawBetModes = authenticateData.config?.betModes as unknown;
				const rawEntries: [unknown, unknown][] = Array.isArray(rawBetModes)
					? rawBetModes.map((entry) =>
							typeof entry === 'string' ? [entry, {}] : [(entry as { mode?: unknown })?.mode, entry],
						)
					: Object.entries((rawBetModes ?? {}) as Record<string, unknown>);
				const parsedBetModes: Record<string, { costMultiplier?: number; maxWin?: number }> = {};
				for (const [rawKey, rawValue] of rawEntries) {
					if (typeof rawKey !== 'string' || !rawKey) continue;
					const value = (rawValue ?? {}) as Record<string, unknown>;
					const costMultiplier = toPositive(value.costMultiplier) ?? toPositive(value.cost);
					const maxWin = toPositive(value.maxWin) ?? toPositive(value.max_win);
					const parsed: { costMultiplier?: number; maxWin?: number } = {};
					if (costMultiplier !== undefined) parsed.costMultiplier = costMultiplier;
					if (maxWin !== undefined) parsed.maxWin = maxWin;
					parsedBetModes[rawKey.toUpperCase()] = parsed;
				}
				stateConfig.betModes = parsedBetModes;

				// Boot bet MUST come from the ladder the RGS just declared. stateBet.betAmount
				// otherwise keeps its hard-coded 1, which a USD session masks ($1.00 is a real
				// level) but a GC session does not: minBet is GC 100, so the game armed "SPIN GC 1"
				// and a real RGS would reject the /wallet/play. Pick defaultBetLevel when the ladder
				// actually contains it, else the smallest level >= minBet — never a value outside
				// betLevels. Compared in raw API units so no float division can miss an exact match.
				// A resumed round overrides this below (its wagered amount wins).
				const rawLevels = [...(authenticateData.config?.betLevels ?? [])].sort((a, b) => a - b);
				const rawDefault = authenticateData.config?.defaultBetLevel;
				const rawMin = authenticateData.config?.minBet ?? 0;
				const bootBetRaw =
					(rawDefault !== undefined && rawLevels.includes(rawDefault) ? rawDefault : undefined) ??
					rawLevels.find((level) => level >= rawMin) ??
					rawLevels[0];
				if (bootBetRaw !== undefined) {
					stateBet.betAmount = bootBetRaw / API_AMOUNT_MULTIPLIER;
					stateBet.wageredBetAmount = bootBetRaw / API_AMOUNT_MULTIPLIER;
				}
			}

			// round
			if (authenticateData?.round) {
				// Example of authenticateData.round 
				// {
				// 	"betID": 62277967,
				// 	"amount": 1000000,
				// 	"payout": 33400000,
				// 	"payoutMultiplier": 33.4,
				// 	"active": true,
				// 	"state": [...],
				// 	"mode": "BONUS",
				// 	"event": null
				// }

				if(authenticateData.round?.state) {
					// @ts-ignore
					stateBet.betToResume =  authenticateData.round;
				}

				if(authenticateData.round?.amount) {
					const betAmountValue =
						authenticateData.round.amount > 0
							? authenticateData.round.amount / API_AMOUNT_MULTIPLIER
							: 0;
					stateBet.betAmount = betAmountValue;
					stateBet.wageredBetAmount = betAmountValue;
				}

				if (authenticateData.round?.mode) {
					stateBet.activeBetModeKey = authenticateData.round.mode;
				};
			}
		} catch (error) {
			console.error(error);
			stateModal.modal = { name: 'error', error };
		}
	};

	const handleReplay = async () => {
		// replay `amount` arrives in API micro-units (1000000 = 1 unit). With no amount in the
		// URL, fall back to a 1-unit bet so payouts read as multipliers instead of $0.00.
		stateBet.betAmount = (stateUrlDerived.amount() / API_AMOUNT_MULTIPLIER) || 1;
		stateBet.wageredBetAmount = (stateUrlDerived.amount() / API_AMOUNT_MULTIPLIER) || 1;
		stateBet.activeBetModeKey = stateUrlDerived.mode();
		// replay links carry the currency the round was played in (there is no authenticate
		// balance to take it from): a GC/SC replay must not fall back to "$"
		if (stateUrlDerived.currency()) stateBet.currency = stateUrlDerived.currency() as typeof stateBet.currency;

		// a failed replay fetch must surface like a failed authenticate (the error card + RELOAD),
		// not leave a blank page — the children (and the notice modal) only mount once we return
		try {
			const data = await requestReplay({
				rgsUrl: stateUrlDerived.rgsUrl(),
				game: stateUrlDerived.game(),
				mode: stateUrlDerived.mode(),
				version: stateUrlDerived.version(),
				event: stateUrlDerived.event(),
			});

			if (data) {
				// @ts-ignore
				stateBet.betToResume = {
					...data,
					event: '0',
					active: true,
					mode: stateUrlDerived.mode(),
				};
			}
		} catch (error) {
			console.error(error);
			stateModal.modal = { name: 'error', error };
		}
	};

	onMount(async () => {
		if(stateUrlDerived.replay()) {
			stateUi.config.mode = 'replay';
			await handleReplay();
		} else {
			stateUi.config.mode = 'default';
			await authenticate();
		};

		authenticated = true;
	});
</script>

{#if authenticated}
	{@render props.children()}
{/if}
