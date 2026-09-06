<script lang="ts" module>
	import { stateBet, stateBetDerived, stateConfig } from 'state-shared';
</script>

<script lang="ts">
	import OnHotkey from './OnHotkey.svelte';

	// holding Space spins continuously; the turbo it also switches on is an operator-gated feature
	// (jurisdiction.disabledTurbo), so it is left alone where turbo is forbidden
	const spaceHoldOn = () => {
		stateBet.autoSpinsCounter = 0;
		stateBet.isSpaceHold = true;
		if (!stateConfig.jurisdiction.disabledTurbo) stateBetDerived.updateIsTurbo(true, { persistent: true });
	};

	const spaceHoldOff = () => {
		stateBet.isSpaceHold = false;
		if (!stateConfig.jurisdiction.disabledTurbo) stateBetDerived.updateIsTurbo(false, { persistent: true });
	};
</script>

<OnHotkey hotkey="Space" onhold={spaceHoldOn} onholdend={spaceHoldOff} />
