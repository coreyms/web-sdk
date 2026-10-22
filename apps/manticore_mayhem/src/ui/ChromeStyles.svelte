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
			/* THE DISPLAY FACE (review D10, Corey 2026-10-17 13:05): every live title in the game is set in Cinzel Bold,
			   the face the Armoury, the intro cards and the board plaque already use. Outfit stays the body face and the
			   HUD keeps Sora. Cinzel ships one weight (700, ui/fontFaces.ts); Outfit stands in while it loads.
			   Tracking: the plain heading (.am-stencil) and the wide one the single-word modal headers take
			   (GAME INFO, AUTOPLAY); both in em so they follow the size. The wide one keeps AUTOPLAY no wider than
			   it was in Black Ops One (125 px at 18 px): the Autoplay head shares its row with the price pill and
			   the close button only while all three fit, and on a 390 px phone it had 2 px to spare. */
			--ui-font-display: 'Cinzel', var(--ui-font);
			--ui-display-weight: 700;
			--ui-display-track: 0.08em;
			--ui-display-track-wide: 0.15em;
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
			/* HOVER AND PRESSED LIFTS, mouse only (2026-10-13; the rules are at the foot of this block). ONE place for the
			   numbers. A lift is a light veil over the whole button, as a CSS filter: contrast(k) then brightness(b) maps a
			   colour c to b*k*c + b*(1 - k)/2, so 0.88 / 1.14 adds about 17 of 255 to every colour (and so shows on the
			   black glass buttons, where a plain brightness would not) and 0.84 / 1.22 about 25. No movement, no scale.
			   (CSS filter on HTML is allowed: the "no filters" house rule is about Pixi; only backdrop-filter is out here.) */
			--ui-hover-ms: 100ms;
			--ui-hover-lift: contrast(0.88) brightness(1.14);
			--ui-press-lift: contrast(0.84) brightness(1.22);
		}
		/* the ONE theme cue every modal shares (approval review 2026-09-15: the three modal
		   families carried nothing from the game): headings set in the game's display face, gold, on
		   the glass. Black Ops One until 2026-10-17; Cinzel Bold since (review D10, one display face for
		   every title). The class keeps its name so every card that uses it follows. Bundled font (fontFaces.ts). */
		.am-stencil {
			font-family: var(--ui-font-display);
			font-weight: var(--ui-display-weight);
			letter-spacing: var(--ui-display-track);
			color: var(--ui-gold);
			text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
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
		.slot-btn {
			/* the lift's fade. A component that sets its own `transition` on a button lists
			   `filter var(--ui-hover-ms) ease` in it too (the shorthand replaces this one). */
			transition: filter var(--ui-hover-ms) ease;
		}
		.slot-btn:disabled {
			cursor: not-allowed;
			opacity: 0.55;
		}
		/* HOVER (Corey 2026-10-13): only where there is a real pointer that can hover. A touch screen matches neither
		   query, so nothing changes there (no sticky hover after a tap). Every HUD and modal button is a .slot-btn:
		   Play, feature, turbo, autoplay, plus, minus, the menu, SKIP and its Yes / No, the Armoury's buttons, the
		   modals' buttons. Not a disabled one. Not the three that already had a hover of their own (the modals' close
		   X, the bet picker's options, the menu's Game Info row). */
		@media (hover: hover) and (pointer: fine) {
			.slot-btn:hover:not(:disabled):not(.x):not(.opt):not(.info-row) {
				filter: var(--ui-hover-lift);
			}
			.slot-btn:active:not(:disabled):not(.x):not(.opt):not(.info-row) {
				filter: var(--ui-press-lift);
			}
		}
		.slot-btn:focus-visible {
			outline: 2px solid var(--ui-amber);
			outline-offset: 3px;
		}
		/* THE HUD BUTTON PLATE (Corey 2026-10-15, direction "A. Riveted bronze plate", feedback/hud_buttons_r1, without
		   the sun crest): the frame's own foot plate. Smoked warm glass inside a bevelled bronze bezel (four border
		   colours lit from the top left) with a rivet in each corner. Play, the feature button, menu, autoplay, turbo,
		   the steppers and SKIP. The state colour is the bezel metal (.plate-gold / -green / -red / -silver, bronze
		   by default) and, where a button tints its glass, --plate-g1 / --plate-g2 (or .plate-stop / .plate-run).
		   EVERYTHING IS DRAWN ON ::before, behind the content (isolation keeps it above the page): the button keeps its
		   box, its content box and every ::after hit area exactly as before. No backdrop-filter, no mask, no filter.
		   A component sets --plate-s, its own size in its own px (master px in the scaled chrome, CSS px on the SKIP
		   layer). The ::before is drawn in CSS px, as the mock was: it is --plate-k (the chrome's --fit-scale) times the
		   button's size and scaled back by 1 / --plate-k, so the bezel, the rivets and the 40 px rivet rule are the
		   mock's numbers on every screen (Chrome floors a border's width to whole px in an element's own units: in
		   master px the chrome's scale would multiply that floor, 1.98 px drawn as 1.8 CSS px on a tablet). */
		:root {
			--plate-bronze-1: #e6c993;
			--plate-bronze-2: #8f6636;
			--plate-bronze-3: #5a3e1f;
			--plate-bronze-4: #bd8f52;
			/* the gold metal (.plate-gold) and the plate's smoked warm glass as tokens, so the menus' chosen and plain
			   chips (ui/DenomModal.svelte) wear the HUD's own metals (Corey 2026-10-17 20:27: the bet picker "in the
			   theme of the game"; it used Angry Mantis's lime --ui-green) */
			--plate-gold-1: #fff1b8;
			--plate-gold-2: #cfa432;
			--plate-gold-3: #8f6d12;
			--plate-gold-4: #ecc85e;
			--plate-glass-1: rgba(36, 25, 15, 0.6);
			--plate-glass-2: rgba(12, 9, 6, 0.76);
			/* the bronze bezel's mid tone (--plate-bronze-4) as a hairline on the black glass */
			--plate-bronze-line: rgba(189, 143, 82, 0.4);
			--plate-ink: #f7eedc;
			/* THE AUTOPLAY STATES (Corey 2026-10-21, his option A: "deeper green and Manticore Red"; game/constants.ts
			   AUTOPLAY_COLOURS): green = Autoplay on, red = its stop. The green is AUTOPLAY_COLOURS.on #5f9149, deeper and
			   less saturated than Angry Mantis's lime #9cd92f, lit and shaded like the bronze; the red is the shell's
			   --accent #e32400 (it was a pink, #ff5a8a). Bezel 1..4 as the bronze's (top, right, bottom, left), the live
			   count's glass, and its ACTIVE ink (pale enough to read on that glass). */
			--auto-green-1: #d2e4b6;
			--auto-green-2: #557f3e;
			--auto-green-3: #2e4a1d;
			--auto-green-4: #8db26b;
			--auto-glass-1: rgba(64, 102, 44, 0.88);
			--auto-glass-2: rgba(30, 52, 20, 0.9);
			--auto-ink: #e3efcf;
			--auto-red-1: #ffc4b2;
			--auto-red-2: #b71d00;
			--auto-red-3: #6b1200;
			--auto-red-4: #f2643f;
			--plate-rivet: radial-gradient(circle at 36% 34%, #fff0c8 0, #d2a364 32%, #7a5529 60%, rgba(0, 0, 0, 0.45) 70%, transparent 78%);
		}
		.am-plate {
			--plate-k: var(--fit-scale, 1);
			/* the button's size in CSS px */
			--plate-css: calc(var(--plate-s) * var(--plate-k));
			--plate-b1: var(--plate-bronze-1);
			--plate-b2: var(--plate-bronze-2);
			--plate-b3: var(--plate-bronze-3);
			--plate-b4: var(--plate-bronze-4);
			--plate-g1: var(--plate-glass-1);
			--plate-g2: var(--plate-glass-2);
			--plate-bz: clamp(1.5px, calc(var(--plate-css) * 0.055), 5.5px);
			/* the rivets go below 40 CSS px (the sideways rail, the portrait phone's small squares, the steppers) */
			--plate-rs: min(calc(var(--plate-css) * 0.085), 9px, max(0px, calc((var(--plate-css) - 39.5px) * 100)));
			--plate-ro: calc(var(--plate-css) * 0.06);
			--plate-r: 0.14;
			isolation: isolate;
			background: transparent;
			border-radius: calc(var(--plate-s) * var(--plate-r));
			color: var(--plate-ink);
		}
		/* (the SKIP button: as wide as Play, half as high) */
		.am-plate.half {
			--plate-r: 0.07;
		}
		.am-plate::before {
			content: '';
			position: absolute;
			left: 0;
			top: 0;
			width: calc(100% * var(--plate-k));
			height: calc(100% * var(--plate-k));
			transform: scale(calc(1 / var(--plate-k)));
			transform-origin: 0 0;
			z-index: -1;
			pointer-events: none;
			box-sizing: border-box;
			border-radius: calc(var(--plate-css) * var(--plate-r));
			border: var(--plate-bz) solid;
			border-color: var(--plate-b1) var(--plate-b2) var(--plate-b3) var(--plate-b4);
			background:
				var(--plate-rivet) left var(--plate-ro) top var(--plate-ro) / var(--plate-rs) var(--plate-rs) no-repeat,
				var(--plate-rivet) right var(--plate-ro) top var(--plate-ro) / var(--plate-rs) var(--plate-rs) no-repeat,
				var(--plate-rivet) left var(--plate-ro) bottom var(--plate-ro) / var(--plate-rs) var(--plate-rs) no-repeat,
				var(--plate-rivet) right var(--plate-ro) bottom var(--plate-ro) / var(--plate-rs) var(--plate-rs) no-repeat,
				linear-gradient(180deg, rgba(255, 232, 190, 0.16), rgba(255, 232, 190, 0) 42%),
				linear-gradient(180deg, var(--plate-g1), var(--plate-g2));
			background-clip: padding-box;
			box-shadow:
				inset 0 0 0 1px rgba(0, 0, 0, 0.6),
				inset 0 1px 0 1px rgba(255, 236, 200, 0.08),
				0 0 0 1px rgba(18, 11, 5, 0.7),
				0 4px 10px rgba(0, 0, 0, 0.5),
				var(--plate-glow, 0 0 0 0 transparent);
			transition: box-shadow 0.25s;
		}
		/* pressed: the bevel turns over (lit from the bottom right) and the glass sinks */
		.am-plate:active:not(:disabled)::before {
			border-color: var(--plate-b3) var(--plate-b4) var(--plate-b1) var(--plate-b2);
			box-shadow:
				inset 0 0 0 1px rgba(0, 0, 0, 0.6),
				inset 0 3px 8px rgba(0, 0, 0, 0.55),
				0 0 0 1px rgba(18, 11, 5, 0.7),
				0 2px 6px rgba(0, 0, 0, 0.5);
			transition: none;
		}
		.am-plate:disabled {
			color: #cfc8bb;
		}
		.am-plate.plate-gold {
			--plate-b1: var(--plate-gold-1);
			--plate-b2: var(--plate-gold-2);
			--plate-b3: var(--plate-gold-3);
			--plate-b4: var(--plate-gold-4);
		}
		.am-plate.plate-green {
			--plate-b1: var(--auto-green-1);
			--plate-b2: var(--auto-green-2);
			--plate-b3: var(--auto-green-3);
			--plate-b4: var(--auto-green-4);
		}
		/* the Autoplay button while a run is live (its stop): Manticore red (was .plate-pink) */
		.am-plate.plate-red {
			--plate-b1: var(--auto-red-1);
			--plate-b2: var(--auto-red-2);
			--plate-b3: var(--auto-red-3);
			--plate-b4: var(--auto-red-4);
		}
		/* free spins (the code's white ring there): pale iron */
		.am-plate.plate-silver {
			--plate-b1: #f4ecdc;
			--plate-b2: #9a938a;
			--plate-b3: #5c5650;
			--plate-b4: #cfc6b8;
		}
		.am-plate.plate-stop {
			--plate-g1: rgba(150, 36, 56, 0.88);
			--plate-g2: rgba(96, 18, 34, 0.9);
		}
		.am-plate.plate-run {
			--plate-g1: var(--auto-glass-1);
			--plate-g2: var(--auto-glass-2);
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
