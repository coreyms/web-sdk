<!-- Global design-system styles for the HTML chrome (from the design's system.jsx). -->
<!-- Fonts are bundled (static/assets/fonts/ui) — Stake Engine forbids external CDNs. -->

<script lang="ts">
	// fonts live in fontFaces.ts so their URLs carry the ?v= cache-buster stamp
	import './fontFaces';
</script>

<style lang="scss">
	:global {
		:root {
			--ui-font: 'Outfit', system-ui, sans-serif;
			--ui-font-num: 'Sora', system-ui, sans-serif;
			--ui-text: #eef0f6;
			--ui-gold: #ffdc4a;
			--ui-green: #9cd92f;
			--ui-red: #c53c24;
			--ui-amber: #e8b04a;
		}
		.am-ui * {
			box-sizing: border-box;
		}
		.am-ui {
			box-sizing: border-box;
			font-family: var(--ui-font);
			color: var(--ui-text);
			-webkit-font-smoothing: antialiased;
			user-select: none;
			-webkit-user-select: none;
		}
		.slot-num {
			font-family: var(--ui-font-num);
			font-variant-numeric: tabular-nums;
			letter-spacing: -0.01em;
		}
		.slot-btn {
			position: relative;
			border: 0;
			padding: 0;
			margin: 0;
			cursor: pointer;
			font-family: var(--ui-font);
			color: var(--ui-text);
			user-select: none;
			-webkit-tap-highlight-color: transparent;
			touch-action: manipulation;
			pointer-events: auto;
		}
		.slot-btn:disabled {
			cursor: not-allowed;
			opacity: 0.55;
		}
		.slot-btn:focus-visible {
			outline: 2px solid #ffa07a;
			outline-offset: 3px;
		}
		@keyframes slot-count {
			0% {
				transform: translateY(20%);
				opacity: 0;
			}
			100% {
				transform: translateY(0);
				opacity: 1;
			}
		}
		.vol-slider {
			-webkit-appearance: none;
			appearance: none;
			height: 4px;
			border-radius: 2px;
			background: rgba(255, 255, 255, 0.18);
			outline: none;
			pointer-events: auto;
		}
		.vol-slider::-webkit-slider-thumb {
			-webkit-appearance: none;
			width: 16px;
			height: 16px;
			border-radius: 50%;
			background: #fff;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
			cursor: pointer;
		}
	}
</style>
