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
			/* black glass (2026-09-09, "Black Glass Panels"): the menu popover, the Autoplay sheet and
			   Game Info share ONE surface — near-black at .88 with a hairline edge and a 1px top
			   highlight; white ink, grey body, gold as the only accent. No backdrop-filter (Safari
			   compositing, house rule) — the ModalShell dim underneath does the frosting. */
			--ui-glass: rgba(12, 12, 16, 0.88);
			--ui-glass-edge: rgba(255, 255, 255, 0.11);
			--ui-glass-hi: rgba(255, 255, 255, 0.07);
			--ui-glass-well: rgba(255, 255, 255, 0.05);
			--ui-glass-well-2: rgba(255, 255, 255, 0.09);
			--ui-ink: #eef0f6;
			--ui-ink-2: #a5a8b6;
			--ui-ink-3: #6d707d;
			--ui-rule: rgba(255, 255, 255, 0.09);
			--ui-rule-2: rgba(255, 255, 255, 0.16);
			--ui-gold-ink: #1b1204;
		}
		.am-glass {
			background: var(--ui-glass);
			border: 1px solid var(--ui-glass-edge);
			border-radius: 14px;
			color: var(--ui-ink);
			box-shadow: 0 30px 70px rgba(0, 0, 0, 0.65), inset 0 1px 0 var(--ui-glass-hi);
		}
		.am-ui * {
			box-sizing: border-box;
					/* every chrome surface, not just buttons: iOS double-tap zoom on a modal card or a readout */
			touch-action: manipulation;
		}
		.am-ui {
			box-sizing: border-box;
			touch-action: manipulation; /* the root too: a double-tap on bare chrome ground must not zoom */
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
			outline: 2px solid var(--ui-amber);
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
		/* volume slider on glass: 6px track filled gold to --fill, white thumb with a gold ring
		   (22px, inside a 28px hit area); a muted slider greys the ring */
		.vol-slider {
			-webkit-appearance: none;
			appearance: none;
			height: 28px;
			margin: 0;
			background: transparent;
			outline: none;
			pointer-events: auto;
			cursor: pointer;
		}
		.vol-slider::-webkit-slider-runnable-track {
			height: 6px;
			border-radius: 3px;
			background: linear-gradient(90deg, var(--ui-gold) var(--fill, 0%), rgba(255, 255, 255, 0.14) var(--fill, 0%));
		}
		.vol-slider::-webkit-slider-thumb {
			-webkit-appearance: none;
			width: 22px;
			height: 22px;
			margin-top: -8px;
			border-radius: 50%;
			background: #fff;
			border: 3px solid var(--ui-gold);
			box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
			cursor: pointer;
		}
		.vol-slider::-moz-range-track {
			height: 6px;
			border-radius: 3px;
			background: rgba(255, 255, 255, 0.14);
		}
		.vol-slider::-moz-range-progress {
			height: 6px;
			border-radius: 3px;
			background: var(--ui-gold);
		}
		.vol-slider::-moz-range-thumb {
			width: 16px;
			height: 16px;
			border-radius: 50%;
			background: #fff;
			border: 3px solid var(--ui-gold);
		}
		.vol-slider.off::-webkit-slider-thumb {
			border-color: var(--ui-ink-3);
		}
		.vol-slider.off::-moz-range-thumb {
			border-color: var(--ui-ink-3);
		}
	}
</style>
