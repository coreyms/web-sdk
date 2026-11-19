<script lang="ts">
	// Post-intro landing screen (HTML overlay over the Pixi courtyard Background): the logo, the three
	// ANIMATED explainer cards (approved 2026-10-12: game/introCards.ts for every number and for where
	// things stand, game/introCardText.ts for the strings), the red loading bar (the PolyMath splash's own red, Corey
	// 2026-10-20: "this status bar needs to use the same red as the Polymath statusbar"), then PRESS ANYWHERE TO
	// CONTINUE. Where the screen has room the cards stand three in a row; where it has not, one card
	// shows at a time and they rotate when the visible card's clip has played once (dots; a swipe or a
	// tap on a dot changes the card; a tap anywhere else is still the continue press).
	//
	// THE CARDS LOAD ON THE POLYMATH SPLASH (2026-10-20, Corey: "the explainer card videos need to load on the Polymath
	// splash screen, so they are ready when the landing screen drops"). game/boot.svelte.ts loads their files while the
	// splash is up and makes the three clip elements; the splash waits for them (up to INTRO_CARD.splashCapMs past
	// everything else it waits on), so with boot.cards 'in' the cards are up under the splash and every visible clip starts
	// the moment the splash starts to fade. They are still not in the gate (`ready` below). Past the cap (boot.cards
	// 'late') the cards fall back to the rules from before: they show when INTRO_CARD.armAfter says so (the audio is in)
	// and their clips wait for PRESS ANYWHERE (holdClipsUntilLoaded). A clip that will not play leaves its poster, and the
	// press pauses every clip and lets go of its file.
	//
	// THE GATE (first-minute plan D, Corey 2026-10-16 17:21; constants LOAD_GATE): PRESS ANYWHERE waits for the audio AND
	// the win plaque's set and the symbols' sheets (game/deferredLoad.ts loadGate, after the audio), but never more than
	// LOAD_GATE.capMs after the audio is ready; the bar counts the gate's bytes too. And never before the shell splash has
	// cleared (game/boot.svelte.ts splashOut): a tap on the splash was lost.
	// Pressing hands off to the Pixi transition via onpress (see components/LoadingScreen.svelte).
	import { onMount, untrack } from 'svelte';
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';

	import { getContext } from '../game/context';
	import { boot, cardClip, cardClipInfo, cardsLate, dropCardHolder, releaseSplash, splashShare } from '../game/boot.svelte';
	import { MASTER, layoutKind } from '../game/layoutSpec';
	import { GATE_BYTES, stamp } from '../game/assets';
	import LogoPicture from './LogoPicture.svelte';
	import { bootSizes } from '../game/assetStamp';
	import { loadGate } from '../game/loadGate.svelte';
	import { sound } from '../game/sound';
	import { INTRO_CARD, INTRO_CARD_ASSETS, INTRO_GATE, INTRO_SLATE, LANDING_BAR, introGatePctSize, introPlacement, introSlatePointY } from '../game/introCards';
	import { LOAD_GATE } from '../game/constants';
	import { INTRO_CARD_TEXT, INTRO_DOT_LABEL, INTRO_SLATE_NUMBERS, INTRO_TILE_LIFT, introSlateNumbersMatch, introTileLiftAt } from '../game/introCardText';
	import { INTRO_SLATE_ATLAS, INTRO_SLATE_PIECES, INTRO_SLATE_ZONES, type IntroSlatePiece } from '../game/introSlateSpec';
	import { INTRO_MAXLINE } from '../game/introCards';
	import { INTRO_MAXLINE_ART } from '../game/introMaxlineSpec';
	import { introMaxWinText } from '../game/introCardText';
	import { IS_SOCIAL } from '../game/social';
	import config from '../game/config';

	type Props = { onpress: () => void };
	const props: Props = $props();
	const context = getContext();

	// canvas text rasterises with whatever font is loaded — gate the handoff like the old screen did
	let fontsReady = $state(false);
	let pressed = $state(false);
	onMount(async () => {
		// THE HANDOFF (2026-09-15): this screen is what the shell splash (src/app.html) fades to, so
		// it must be mounted and painted before the splash goes. game/boot.svelte.ts has already
		// fetched and decoded the logo and these two faces by the time we get here. The explainer cards
		// are not waited for: each fades in whole when its frame picture is decoded.
		boot.landingMounted = true;
		try {
			await Promise.all([document.fonts.load('900 40px Outfit'), document.fonts.load('700 40px Sora')]);
		} catch {
			/* fall through — fonts.ready best effort */
		}
		fontsReady = true;
	});

	// ...and only once the assets are actually in: this screen mounts as soon as Authenticate
	// resolves, which on a fast link is long before the cards have landed.
	// ...and once the Pixi preload is in: the scene (the room this screen sits in) renders only
	// then (pixi-svelte AssetsLoader) — a landing over a black canvas is what Corey saw on
	// 2026-09-15. A failed preload releases too (the assetsFailed notice below takes over).
	// ...and once the explainer cards are in (game/boot.svelte.ts boot.cards), but never more than INTRO_CARD.splashCapMs
	// past the rest: then the splash moves on and the cards use their fallback (cardsLate).
	let splashCapped = $state(false);
	$effect(() => {
		if (!boot.landingReady) return;
		if (!(context.stateApp.preLoaded || assetsFailed)) return;
		if (boot.cards === 'loading' && !assetsFailed) {
			const cap = setTimeout(() => {
				splashCapped = true;
				cardsLate();
			}, INTRO_CARD.splashCapMs);
			return () => clearTimeout(cap);
		}
		// a beat so Pixi has painted the room (and the cards have faded in) before the crossfade starts
		const id = setTimeout(releaseSplash, 350);
		return () => clearTimeout(id);
	});

	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	const master = $derived(MASTER[kind]);
	// where the logo, the cards, the dots and the gate stand for this viewport (game/introCards.ts)
	// THE MAX WIN LINE (game/introCards.ts INTRO_MAXLINE): the gold "WIN UP TO 10,000x" between the logo and the cards, its
	// art for this wording, sized by its cap for this kind (never over maxCapCss on screen), and the room it asks for
	const lineArt = INTRO_MAXLINE_ART[IS_SOCIAL ? 'social' : 'standard'];
	if (import.meta.env.DEV && lineArt.text !== introMaxWinText()) console.error('[landing] the max win line art says other words than introCardText INTRO_MAX_WIN: rebake tools/build_intro_slate.py', lineArt.text);
	const lineSrc = stamp(lineArt.src);
	const lineAsk = $derived.by(() => {
		const vw = innerWidth.current ?? 1;
		const vh = innerHeight.current ?? 1;
		const scale = Math.min(vw / master.width, vh / master.height) || 1;
		const cap = Math.min(INTRO_MAXLINE.cap[kind], INTRO_MAXLINE.maxCapCss / scale);
		return { w: (lineArt.w * cap) / lineArt.cap, h: (lineArt.h * cap) / lineArt.cap };
	});
	// where the logo, the cards, the dots and the gate stand for this viewport (game/introCards.ts)
	const place = $derived(introPlacement(kind, innerWidth.current ?? 1, innerHeight.current ?? 1, lineAsk));

	// The audiosprite is roughly a third of the payload and downloads in parallel with the images
	// (game/sound.ts), so the bar blends both — otherwise it parks at 100% for however long the
	// audio still needs. Weights are a fixed approximation of the byte split; the label switches to
	// LOADING AUDIO once the images are done so a long audio tail doesn't look like a hang.
	// ONE loading scale across both screens (Corey 2026-09-15): the shell splash's red bar
	// stopped at `start` (its share of everything: bundle + landing images + the Pixi preload,
	// game/boot.svelte.ts splashShare) and this bar carries on from there with the one thing still
	// in flight — the audio (sfx sprite + base loop, byte progress from game/sound.ts).
	// Since first-minute plan D the bar carries THE GATE too (game/loadGate.svelte.ts: its files' bytes as they land),
	// weighed against the audio by bytes (scripts/stamp-assets.mjs bootSizes.audio, game/assets.ts GATE_BYTES).
	const start = Math.round(splashShare() * 100);
	const audioReady = $derived(sound.isReady);
	const AUDIO_BYTES = bootSizes.audio;
	const rest = $derived((sound.progress * AUDIO_BYTES + Math.min(loadGate.doneBytes, GATE_BYTES)) / Math.max(1, AUDIO_BYTES + GATE_BYTES));
	const rawProgress = $derived(Math.round(Math.min(100, start + (100 - start) * rest)));
	// high-water mark: the audio share restarts as the sprite hands off to the music player, and a
	// bar that slips back reads as a hang (seen 60% -> 49% on the throttled probe, 2026-09-15)
	let highWater = $state(0);
	$effect(() => {
		const p = rawProgress;
		untrack(() => {
			if (p > highWater) highWater = p;
		});
	});
	const progress = $derived(Math.max(rawProgress, highWater));
	// THE SPLASH'S BAR (LANDING_BAR, Corey 2026-10-21 "the same look as the splash screen"): segments lit whole; the ones
	// the splash had lit (its bar stops at `start`) are lit from the first frame with no pop; a jump lights the rest
	// staggerMs apart, as the splash's paintBar does
	const SEG = LANDING_BAR.segments;
	const SEG_PTS = 100 / SEG;
	const litFrom = Math.min(SEG, Math.floor(start / SEG_PTS));
	let lit = $state(litFrom);
	let segDelay = $state<number[]>(Array(SEG).fill(0));
	$effect(() => {
		const m = Math.min(SEG, Math.floor(progress / SEG_PTS));
		untrack(() => {
			if (m <= lit) return;
			const d = segDelay.slice();
			for (let i = lit; i < m; i += 1) d[i] = (i - lit) * LANDING_BAR.staggerMs;
			segDelay = d;
			lit = m;
		});
	});
	const litPct = $derived(lit * SEG_PTS);
	const loadingLabel = $derived(context.stateApp.preLoaded && !audioReady ? 'LOADING AUDIO' : 'LOADING');
	// An asset that exhausted its retries stops the load dead (AssetsLoader leaves `loaded` false and
	// lists the keys): entering with missing money glyphs / headshots / mode labels is worse than
	// asking for a tap. Audio is deliberately NOT in here — a dead audiosprite lets the player in
	// silently by design (sound.isReady goes true on error), which is why the gate below still hangs
	// off `ready` alone.
	const assetsFailed = $derived(context.stateApp.failedAssets.length > 0);
	// audio joins images + fonts in the gate: PRESS ANYWHERE must not appear over a silent game
	// ...and THE GATE (up to its cap after the audio is ready), and the splash must have cleared (see the header)
	let audioAt = $state(0);
	let capped = $state(false);
	$effect(() => {
		if (!audioReady || capped) return;
		untrack(() => (audioAt ||= performance.now()));
		// re-armed by every gate file that lands (done or failed): with capMs null only a stall lets PRESS through
		if (LOAD_GATE.capMs === null) void loadGate.filesDone;
		const ms = LOAD_GATE.capMs ?? LOAD_GATE.stallMs;
		const id = setTimeout(() => (capped = true), ms);
		return () => clearTimeout(id);
	});
	const gateIn = $derived(loadGate.settled || capped);
	const ready = $derived(context.stateApp.preLoaded && fontsReady && audioReady && gateIn && boot.splashOut);
	let readyAt = $state(0);
	$effect(() => {
		if (ready) untrack(() => (readyAt ||= performance.now()));
	});

	// per-kind sizing of the gate (master units)
	const SZ = $derived(INTRO_GATE[kind]);
	const logo = $derived(place.logo);

	// ---- the cards -------------------------------------------------------------------------------
	const C = INTRO_CARD;
	const N = INTRO_CARD_TEXT.length;
	const frameSrc = stamp(INTRO_CARD_ASSETS.frame);
	const posterSrc = INTRO_CARD_TEXT.map((c) => stamp(INTRO_CARD_ASSETS.poster(c.key)));
	const clipSrc = INTRO_CARD_TEXT.map((c) => stamp(INTRO_CARD_ASSETS.clip(c.key)));
	const slateSrc = stamp(INTRO_CARD_ASSETS.slate);
	// posters only, and no clip is ever asked for, where the player asked for less motion
	const reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/** every file of the cards came in during the splash (game/boot.svelte.ts): the cards are up at once and their clips
	 *  start with the splash's fade. Otherwise the fallback rules (armAfter, holdClipsUntilLoaded) */
	const cardsIn = $derived(boot.cards === 'in');
	/** the cards show (INTRO_CARD.armAfter: once the loading bar is done, once the audio is in, or once the Pixi preload is
	 *  in; at once when they came in on the splash) */
	let armed = $state(false);
	$effect(() => {
		if (cardsIn || (C.armAfter === 'loaded' ? ready : C.armAfter === 'audio' ? context.stateApp.preLoaded && audioReady : context.stateApp.preLoaded)) armed = true;
	});
	/** the frame picture AND the slate's lettering are decoded (game/boot.svelte.ts decoded both on the splash): the cards
	 *  fade in, never a frame with a bare slate. A frame that never arrives leaves no cards, and nothing waits; a lettering
	 *  atlas that fails leaves the cards with their plain lines (slateFailed, for the DEV hook). */
	let frameReady = $state(false);
	let slateFailed = $state(false);
	$effect(() => {
		if (!armed) return;
		const decode = (src: string) => {
			const img = new Image();
			img.src = src;
			return img.decode();
		};
		const slate = Promise.all([
			decode(slateSrc).catch(() => {
				slateFailed = true;
			}),
			// the max win line comes in with the cards (game/boot.svelte.ts CARD_IMAGES) and shows with them
			decode(lineSrc).catch(() => {}),
		]);
		decode(frameSrc).then(
			() => slate.then(() => (frameReady = true)),
			() => {},
		);
	});
	/** the clips may run: on the splash's fade when the cards came in on the splash, else at PRESS ANYWHERE
	 *  (holdClipsUntilLoaded) */
	const clipsGo = $derived(cardsIn ? boot.splashOut : !C.holdClipsUntilLoaded || ready);

	const oneUp = $derived(place.mode !== 'row');
	/** one card at a time: which one shows */
	let active = $state(0);
	let activeSince = 0;
	const isVisible = (i: number) => frameReady && (!oneUp || i === active);
	/** the tile lifted on each card (INTRO_TILE_LIFT: the CLUSTERS tiles follow its clip's time), -1 none */
	let liftIdx = $state(INTRO_CARD_TEXT.map(() => -1));
	/** the clip is really running, so it is drawn over the poster (a clip that never starts stays hidden under it) */
	let live = $state(INTRO_CARD_TEXT.map(() => false));
	let videos: (HTMLVideoElement | undefined)[] = $state([]);
	const lastT = INTRO_CARD_TEXT.map(() => 0);
	// the same elements, kept past the unmount for the DEV hook (it reports that they were let go)
	const kept: (HTMLVideoElement | undefined)[] = [];
	let mounted = true;

	const wantsClip = (i: number) => armed && frameReady && !reducedMotion && !pressed && (!oneUp || i === active) && clipsGo;
	const startClip = (i: number) => {
		const v = videos[i];
		if (!v) return;
		v.muted = true;
		// the element came from game/boot.svelte.ts with its src (loaded on the splash); one without (no clip was asked for
		// then) gets the plain same-origin URL only when its card first has to play
		if (!v.getAttribute('src')) v.src = clipSrc[i];
		// refused (iPhone Low Power Mode) or cut short by a pause: the poster stays, nothing to report
		if (v.paused) v.play().catch(() => {});
	};
	$effect(() => {
		for (let i = 0; i < N; i += 1) {
			const v = videos[i];
			if (!v) continue;
			kept[i] = v;
			if (wantsClip(i)) startClip(i);
			else if (!v.paused) v.pause();
		}
	});
	/** THE HANDOFF of a clip element: game/boot.svelte.ts made it (and loaded it, on the splash); the card's glass window
	 *  takes it in. Moving it keeps what it has buffered. */
	const adoptClip = (host: HTMLElement, i: number) => {
		const v = cardClip(i);
		host.appendChild(v);
		videos[i] = v;
	};
	// the clip is drawn over the poster only once it is really running (the element is not the template's: a class by hand)
	$effect(() => {
		for (let i = 0; i < N; i += 1) videos[i]?.classList.toggle('live', live[i]);
	});
	/** pause every clip and let go of its file, so no decoder stays alive behind the game */
	const releaseClips = () => {
		for (let i = 0; i < N; i += 1) {
			const v = videos[i] ?? kept[i];
			if (!v) continue;
			v.pause();
			v.removeAttribute('autoplay');
			if (v.getAttribute('src')) {
				v.removeAttribute('src');
				v.load();
			}
			live[i] = false;
		}
	};

	/** one card at a time: bring card i up from its start; `byUser` = inside a tap or swipe, where a refused clip may start */
	const show = (i: number, byUser = false) => {
		const next = ((i % N) + N) % N;
		if (next !== active) {
			const v = videos[next];
			if (v && v.getAttribute('src')) v.currentTime = 0;
			liftIdx[next] = -1;
			lastT[next] = 0;
			active = next;
		}
		activeSince = performance.now();
		if (byUser && wantsClip(next)) startClip(next);
	};
	/** one card at a time: the cards move on by themselves only once their clips may play (armed during the gate's wait,
	 *  plan D, they hold the first card's poster until then, so its clip is the first one seen); with reduced motion at once */
	const rotating = $derived(clipsGo || reducedMotion);
	$effect(() => {
		// the dwell clock starts when the visible card is actually there, and again when the cards start moving on
		if (frameReady && oneUp && rotating) untrack(() => (activeSince = performance.now()));
	});

	// one loop for the three cards: the CLUSTERS tiles follow the clip's time, and with one card at a time the
	// card moves on when its clip has played once (or, with no clip running, after stillDwellMs)
	const frame = (now: number) => {
		for (let i = 0; i < N; i += 1) {
			const v = videos[i];
			if (!v || v.paused || v.readyState < 2) continue;
			const card = INTRO_CARD_TEXT[i];
			const t = v.currentTime;
			if (!live[i] && t > 0.03) live[i] = true;
			const idx = card.key === INTRO_TILE_LIFT.card ? introTileLiftAt(t) : -1;
			if (idx !== liftIdx[i]) liftIdx[i] = idx;
			if (oneUp && i === active) {
				const length = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : card.clipSeconds;
				if (t >= length - C.endSlackSeconds || t < lastT[i] - 1) {
					show(active + 1);
					continue;
				}
			}
			lastT[i] = t;
		}
		if (oneUp && frameReady && rotating) {
			const v = videos[active];
			const running = !!v && !v.paused && v.currentTime > 0.03;
			const since = now - activeSince;
			if ((!running && since > C.stillDwellMs) || since > INTRO_CARD_TEXT[active].clipSeconds * 1000 + C.stallGraceMs) show(active + 1);
		}
	};
	onMount(() => {
		let raf = 0;
		const tick = () => {
			raf = requestAnimationFrame(tick);
			if (!pressed) frame(performance.now());
		};
		raf = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(raf);
			mounted = false;
			releaseClips();
		};
	});

	// a drag across the visible card changes the card; anything shorter is the continue press
	let down: { x: number; y: number; id: number } | null = null;
	const cardDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY, id: e.pointerId });
	const cardUp = (e: PointerEvent) => {
		const d = down;
		down = null;
		// released on the card without having gone down on it: the press began on the screen behind, in the instant
		// before the card appeared. It is still a press (found by the probe pressing the moment the gate opened).
		if (!d || d.id !== e.pointerId) return press();
		const dx = e.clientX - d.x;
		const dy = e.clientY - d.y;
		if (Math.abs(dx) >= C.swipeMinPx && Math.abs(dx) > Math.abs(dy)) show(active + (dx < 0 ? 1 : -1), true);
		else press();
	};

	// ---- THE SLATE: the block centered between the frame's two engraved points (game/introCards.ts INTRO_SLATE) ----------
	// The centering is layout (.slate is a flex column from the one point to the other). This only guards the size: a block
	// taller than the span less INTRO_SLATE.margin at each end is scaled about its center (--k) until it fits. Measured in
	// layout px (offsetHeight ignores the .fit and card transforms); hidden cards are only at opacity 0, so every card is
	// measured. Runs once the line's face is in, on every placement change (resize, turn) and when the cards mount; never
	// per frame. A block that fits keeps --k unset.
	const SL = INTRO_SLATE;
	const Z = INTRO_SLATE_ZONES;
	const pointTop = introSlatePointY('top');
	const pointBottom = introSlatePointY('bottom');
	/** the plain line's top in the block: where the mock's line zone set a two-line line (centered in the zone) */
	const lineTop = Z.lineTop + (Z.lineH - 2 * SL.line.size * SL.line.lineHeight) / 2;
	/** the block's fixed upper part (the header's cap top to the plain line's top), card-width units */
	const upperH = lineTop - Z.capTop;
	const piecesOf = (key: string) => Object.values(INTRO_SLATE_PIECES).filter((p) => p.card === key);
	const cardPieces = INTRO_CARD_TEXT.map((c) => piecesOf(c.key));
	/** a piece of the atlas as a CSS sprite: its box in the block (units from the card's left and the cap top) */
	const spriteStyle = (p: IntroSlatePiece) => {
		const [ax, ay, aw, ah] = p.atlas;
		const A = INTRO_SLATE_ATLAS;
		return [
			`left:calc(var(--u) * ${p.x})`,
			`top:calc(var(--u) * ${+(p.y - Z.capTop).toFixed(3)})`,
			`width:calc(var(--u) * ${p.w})`,
			`height:calc(var(--u) * ${p.h})`,
			`background-size:${+((A.w / aw) * 100).toFixed(4)}% ${+((A.h / ah) * 100).toFixed(4)}%`,
			`background-position:${aw < A.w ? +((ax / (A.w - aw)) * 100).toFixed(4) : 0}% ${ah < A.h ? +((ay / (A.h - ah)) * 100).toFixed(4) : 0}%`,
		].join(';');
	};
	const blockEls: (HTMLElement | undefined)[] = $state([]);
	const slateFit: { k: number; blockH: number; spanH: number; roomH: number }[] = [];
	const fitSlates = () => {
		for (let i = 0; i < N; i += 1) {
			const b = blockEls[i];
			if (!b) continue;
			b.style.removeProperty('--k');
			const u = place.cardW / 100;
			const blockH = b.offsetHeight;
			const spanH = (pointBottom - pointTop) * u;
			const roomH = spanH - 2 * SL.margin * u;
			const k = blockH > roomH && blockH > 0 ? roomH / blockH : 1;
			if (k < 1) b.style.setProperty('--k', String(k));
			slateFit[i] = { k, blockH, spanH, roomH };
		}
	};
	let lineFaceIn = $state(false);
	onMount(() => {
		let gone = false;
		// the line's weight, then whatever else the page still loads
		document.fonts
			.load(`${SL.line.weight} 40px Sora`)
			.catch(() => {})
			.then(() => document.fonts.ready)
			.then(() => {
				if (!gone) lineFaceIn = true;
			});
		return () => (gone = true);
	});
	$effect(() => {
		// what the fit depends on: the face, the placement (the card's width), the cards being mounted
		void place;
		if (!lineFaceIn || !armed || blockEls.filter(Boolean).length < N) return;
		untrack(fitSlates);
	});
	if (import.meta.env.DEV && !introSlateNumbersMatch()) console.error('[landing] the intro lettering states numbers the math no longer has: rebake tools/build_intro_slate.py', INTRO_SLATE_NUMBERS);

	// the card's numbers as CSS variables (card-width units, multiplied by --u = 1% of the card's width)
	const cardVars = [
		`--win-l:${C.window.left}%`, `--win-t:${C.window.top}%`, `--win-w:${C.window.width}%`, `--win-h:${C.window.height}%`,
		`--pt-top:${pointTop}`, `--pt-h:${pointBottom - pointTop}`, `--upper-h:${upperH}`,
		`--l-side:${SL.line.side}`, `--l-size:${SL.line.size}`, `--l-weight:${SL.line.weight}`, `--l-lh:${SL.line.lineHeight}`, `--l-color:${SL.line.color}`, `--l-font:${SL.line.font}`,
		`--r-side:${SL.rule.side}`, `--r-h:${SL.rule.height}`, `--r-color:${SL.rule.color}`,
		`--lift:${SL.tileLift.transform}`, `--lift-ms:${SL.tileLift.ms}ms`, `--slate:url("${slateSrc}")`,
		`--fade-in:${C.fadeInMs}ms`, `--swap:${C.swapMs}ms`, `--slide:${C.swapSlide}px`,
	].join(';');

	// ---- DEV hook: __manticore.landing() (tools/manticore/landing_probe.js) ----
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		Object.assign(((window as any).__manticore ??= {}), {
			/** THE SLATE per card: runs the fit again now (a probe that changed the text with a style first), then the two
			 *  frame points and the block's top and bottom in CLIENT px (getBoundingClientRect: every transform counted),
			 *  the fit factor, the block's and the span's height in layout px, and what the slate shows */
			landingSlate: () => {
				fitSlates();
				return INTRO_CARD_TEXT.map((card, i) => {
					const el = document.querySelector(`.icard[data-card="${card.key}"]`);
					const fr = el?.querySelector('.frame')?.getBoundingClientRect();
					const bl = blockEls[i]?.getBoundingClientRect();
					const at = (y: number) => (fr ? fr.top + (y / SL.frame.h) * fr.height : NaN);
					return {
						key: card.key,
						points: { top: at(SL.points.top), bottom: at(SL.points.bottom) },
						framePoints: { ...SL.points, frameH: SL.frame.h },
						block: bl ? { top: bl.top, bottom: bl.bottom, left: bl.left, right: bl.right } : null,
						marginPx: SL.margin * (fr ? fr.width / 100 : 0),
						...(slateFit[i] ?? { k: 1, blockH: 0, spanH: 0, roomH: 0 }),
						title: card.title,
						line: card.line,
						pieces: cardPieces[i].length,
						lift: liftIdx[i],
						slateFailed,
						numbersMatch: introSlateNumbersMatch(),
					};
				});
			},
			landing: () => ({
				mounted,
				dismissed: pressed,
				ready,
				/** THE GATE (plan D): performance.now() the audio was ready, the gate settled, PRESS was ready; whether the
				 *  cap opened it; the gate's bytes */
				gate: { audioAt, settledAt: loadGate.settledAt, readyAt, capped, capMs: LOAD_GATE.capMs, settled: loadGate.settled, doneBytes: loadGate.doneBytes, totalBytes: GATE_BYTES, files: loadGate.files, filesDone: loadGate.filesDone, failed: loadGate.failed, splashOut: boot.splashOut },
				armed,
				/** game/boot.svelte.ts: the cards on the splash ('in', 'late' past the cap), per clip how it came in */
				cardsOnSplash: boot.cards,
				splashCapped,
				splashCapMs: C.splashCapMs,
				clipLoad: cardClipInfo.map((x) => ({ ...x })),
				clipsGo,
				armAfter: C.armAfter,
				holdClipsUntilLoaded: C.holdClipsUntilLoaded,
				/** the CLUSTERS tiles' lift with the clip (introCardText INTRO_TILE_LIFT) */
				tileLift: INTRO_TILE_LIFT,
				/** the max win line: the words its art says, the words the game would set (introMaxWinText), the max win, its
				 *  box (CLIENT px) */
				maxline: { text: lineArt.text, want: introMaxWinText(), maxWin: config.maxWin, box: (() => { const b = document.querySelector('.landing .maxline-art')?.getBoundingClientRect(); return b ? { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom } : null; })() },
				frameReady,
				reducedMotion,
				kind,
				mode: place.mode,
				scale: place.scale,
				cardCssWidth: place.cardW * place.scale,
				active,
				visible: INTRO_CARD_TEXT.map((_, i) => i).filter(isVisible),
				cards: INTRO_CARD_TEXT.map((card, i) => {
					const v = videos[i] ?? kept[i];
					return {
						key: card.key,
						visible: isVisible(i),
						live: live[i],
						title: card.title,
						line: card.line,
						lift: liftIdx[i],
						video: v
							? { paused: v.paused, currentTime: v.currentTime, readyState: v.readyState, duration: v.duration, src: v.getAttribute('src'), currentSrc: v.currentSrc, loop: v.loop, muted: v.muted, connected: v.isConnected }
							: null,
					};
				}),
			}),
		});
	}

	const press = () => {
		// same tap target serves both states: while assets are missing it retries instead of entering
		if (assetsFailed) {
			context.stateApp.retryFailedAssets?.();
			return;
		}
		if (!ready || pressed) return;
		pressed = true;
		releaseClips();
		dropCardHolder();
		// the continue press has a voice of its own (the minor click, Corey 2026-09-02); the sprite
		// is guaranteed loaded here — it is one of the things this screen waited for
		sound.players.once.play({ name: 'sfx_ui_minor' });
		props.onpress();
	};
</script>

<div class="landing" class:pressed>
	<!-- full-screen continue target -->
	<button class="press-target" aria-label={assetsFailed ? 'Retry loading' : 'Continue'} disabled={pressed || (!ready && !assetsFailed)} onclick={press}></button>

	<div class="fit" style:width="{master.width}px" style:height="{master.height}px" style:transform="translate({place.left}px, {place.top}px) scale({place.scale})">
		<!-- the explainer cards, in master px: clip in the glass window, the frame picture over it, the slate's lettering and line -->
		{#if armed}
			<div class="cards" class:one-up={oneUp} style={cardVars}>
				{#each INTRO_CARD_TEXT as card, i (card.key)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="icard"
						class:on={isVisible(i)}
						data-card={card.key}
						style:width="{place.cardW}px"
						style:height="{place.cardH}px"
						style:left="{place.slots[i].x - place.cardW / 2}px"
						style:top="{place.slots[i].y - place.cardH / 2}px"
						style:--u="{place.cardW / 100}px"
						onpointerdown={cardDown}
						onpointerup={cardUp}
						onpointercancel={() => (down = null)}
					>
						<div class="win">
							<img class="poster" src={posterSrc[i]} alt="" draggable="false" />
							{#if !reducedMotion}
								<!-- the clip's <video> is game/boot.svelte.ts's (muted, loop, playsinline, the poster), adopted here -->
								<span class="clip-host" use:adoptClip={i}></span>
							{/if}
						</div>
						<img class="frame" src={frameSrc} alt="" draggable="false" />
						<!-- the slate: the block (header, rules, lettering and pictures, the plain line) centered between the frame's two points -->
						<div class="slate">
							<div class="block" bind:this={blockEls[i]}>
								<div class="upper" role="img" aria-label={card.title}>
									{#each cardPieces[i] as pc (pc.atlas.join())}
										<i class="sp" class:tile={pc.role === 'tile'} class:lift={pc.role === 'tile' && pc.order === liftIdx[i]} data-piece={pc.role} style={spriteStyle(pc)}></i>
									{/each}
									{#each Z.rules as r (r.top)}
										<div class="rule" style:top="calc(var(--u) * {+(r.top - Z.capTop).toFixed(3)})" style:opacity={r.opacity}></div>
									{/each}
								</div>
								<div class="line">{card.line}</div>
							</div>
						</div>
					</div>
				{/each}
				{#if place.dots && frameReady}
					<div class="dots" class:vertical={place.dots.vertical} style:left="{place.dots.x}px" style:top="{place.dots.y}px" style:--dot="{C.dot[kind].size}px" style:--hit="{C.dot[kind].hit}px">
						{#each INTRO_CARD_TEXT as card, i (card.key)}
							<button type="button" class:on={i === active} aria-label={INTRO_DOT_LABEL(card.title)} aria-current={i === active} onclick={() => show(i, true)}><i></i></button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
		{#if armed && place.maxline}
			<!-- the max win line: image lettering between the logo and the cards; it shows with them -->
			<img class="maxline-art" class:on={frameReady} src={lineSrc} alt={lineArt.text} draggable="false" style:left="{place.maxline.cx - place.maxline.w / 2}px" style:top="{place.maxline.cy - place.maxline.h / 2}px" style:width="{place.maxline.w}px" style:height="{place.maxline.h}px" />
		{/if}
		<span class="logo-host logo" style:width="{logo.w}px" style:left="{logo.cx - logo.w / 2}px" style:top="{logo.cy}px">
			<LogoPicture width={logo.w} />
		</span>

		<div class="gate" style:padding="{SZ.pad}px" style:transform="translateX({place.gateCx - master.width / 2}px)">
			{#if assetsFailed}
				<!-- same display style as PRESS ANYWHERE; the full-screen target retries instead of entering -->
				<div class="pressText" style:font-size="{SZ.press}px">CONNECTION PROBLEM · TAP TO RETRY</div>
			{:else if !ready}
				<!-- the splash's segmented bar (LANDING_BAR): segments, a shine clipped to the lit part, a spark on its edge -->
				<div class="bar gbar" style:width="{SZ.barW}px" style:height="{SZ.barH}px" style:--skew="{LANDING_BAR.skewDeg}deg" style:--spark="{(SZ.barH / 1.8) * 2.8}px" aria-hidden="true">
					<div class="gs">
						{#each segDelay as d, i (i)}<i class:on={i < lit} class:still={i < litFrom} style:--d="{d}ms"></i>{/each}
					</div>
					<div class="gw"><div class="gc" style:transform="translateX({litPct - 100}%)"><div class="gi" style:transform="translateX({100 - litPct}%)"><div class="gsh"></div></div></div></div>
					<div class="gk" class:on={lit > 0 && lit < SEG} style:transform="translateX({litPct}%)"><b></b></div>
				</div>
				<div class="pct" style:font-size="{introGatePctSize(kind)}px">{loadingLabel} · {progress}%</div>
			{:else}
				<div class="pressText" style:font-size="{SZ.press}px">PRESS ANYWHERE TO CONTINUE</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.landing {
		position: fixed;
		inset: 0;
		z-index: 30;
		overflow: hidden;
		transition: opacity 0.3s ease;
		font-family: var(--ui-font);
	}
	.landing.pressed {
		opacity: 0;
		pointer-events: none;
	}
	.press-target {
		position: absolute;
		inset: 0;
		z-index: 1;
		border: none;
		background: transparent;
		cursor: pointer;
		padding: 0;
	}
	.press-target:disabled {
		cursor: default;
	}
	.fit {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: top left;
		pointer-events: none;
		z-index: 2;
	}
	.cards {
		position: absolute;
		inset: 0;
		z-index: 3;
		user-select: none;
		-webkit-user-select: none;
	}
	/* a card: hidden until its frame picture is decoded (and, one at a time, until it is the one showing) */
	.icard {
		position: absolute;
		opacity: 0;
		transition: opacity var(--fade-in) ease;
		pointer-events: none;
	}
	.icard.on {
		opacity: 1;
	}
	.one-up .icard {
		transform: translateX(var(--slide)) scale(0.98);
		transition:
			opacity var(--swap) ease,
			transform var(--swap) ease;
		touch-action: none;
	}
	.one-up .icard.on {
		transform: none;
		pointer-events: auto;
		cursor: pointer;
	}
	/* the glass window: poster underneath, the clip over it once it is really running */
	.win {
		position: absolute;
		left: var(--win-l);
		top: var(--win-t);
		width: var(--win-w);
		height: var(--win-h);
		background: #000;
		overflow: hidden;
	}
	.clip-host {
		display: contents;
	}
	.win .poster,
	.win :global(video) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		pointer-events: none;
	}
	.win :global(video) {
		opacity: 0;
	}
	.win :global(video.live) {
		opacity: 1;
	}
	/* a refused autoplay must not leave the system's play glyph on the glass */
	.win :global(video::-webkit-media-controls),
	.win :global(video::-webkit-media-controls-start-playback-button),
	.win :global(video::-webkit-media-controls-overlay-play-button) {
		display: none !important;
		-webkit-appearance: none;
	}
	.frame {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		pointer-events: none;
	}
	/* THE SLATE (card-width units x --u; game/introCards.ts INTRO_SLATE): a flex column from the frame's top point to its
	 * bottom point, the block centered in it by layout. --k: the fit (fitSlates), unset wherever the block fits. */
	.slate {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(var(--u) * var(--pt-top));
		height: calc(var(--u) * var(--pt-h));
		display: flex;
		flex-direction: column;
		justify-content: center;
		pointer-events: none;
	}
	.block {
		position: relative;
		flex: none;
		transform: scale(var(--k, 1));
		transform-origin: 50% 50%;
	}
	/* the header's cap top to the plain line's top: the pieces and the rules in the mock's own places */
	.upper {
		position: relative;
		height: calc(var(--u) * var(--upper-h));
	}
	.sp {
		position: absolute;
		display: block;
		background-image: var(--slate);
		background-repeat: no-repeat;
	}
	.sp.tile {
		transform-origin: 50% 100%;
		transition: transform var(--lift-ms) ease-out;
	}
	.sp.tile.lift {
		transform: var(--lift);
	}
	.rule {
		position: absolute;
		left: calc(var(--u) * var(--r-side));
		right: calc(var(--u) * var(--r-side));
		height: max(1px, calc(var(--u) * var(--r-h)));
		background: linear-gradient(90deg, transparent, var(--r-color) 18%, var(--r-color) 82%, transparent);
	}
	/* the plain line (the mock's .one): its last line box is the block's bottom */
	.line {
		margin: 0 calc(var(--u) * var(--l-side));
		text-align: center;
		font-family: var(--l-font);
		font-weight: var(--l-weight);
		font-size: calc(var(--u) * var(--l-size));
		line-height: var(--l-lh);
		color: var(--l-color);
		text-wrap: balance;
	}
	/* one card at a time: the dots (each button is a touch target, the drawn dot is the <i> inside) */
	.dots {
		position: absolute;
		display: flex;
		transform: translate(-50%, -50%);
		pointer-events: auto;
	}
	.dots.vertical {
		flex-direction: column;
	}
	.dots button {
		width: var(--hit);
		height: var(--hit);
		padding: 0;
		border: 0;
		background: transparent;
		display: grid;
		place-items: center;
		cursor: pointer;
	}
	.dots button i {
		display: block;
		width: var(--dot);
		height: var(--dot);
		border-radius: 50%;
		background: rgba(18, 12, 8, 0.8);
		/* a gold ring, so the dots that are not lit still read on the bright stone and on the dark pillars */
		box-shadow:
			0 0 0 calc(var(--dot) * 0.16) rgba(233, 196, 106, 0.8),
			0 calc(var(--dot) * 0.2) calc(var(--dot) * 0.5) rgba(0, 0, 0, 0.7);
		transition: background 0.2s ease;
	}
	.dots button.on i {
		background: #e9c46a;
	}
	.maxline-art {
		position: absolute;
		display: block;
		opacity: 0;
		transition: opacity var(--fade-in, 350ms) ease;
		pointer-events: none;
	}
	.maxline-art.on {
		opacity: 1;
	}
	.logo-host {
		position: relative;
		display: block;
		filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.7));
	}
	/* the logo is centre-anchored on its slot: `top` is the centre y, the transform lifts it half its height */
	.logo {
		position: absolute;
		transform: translateY(-50%);
		z-index: 4;
	}
	.gate {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		min-height: 56px;
		justify-content: flex-end;
		z-index: 5;
	}
	/* THE SPLASH'S SEGMENTED BAR (LANDING_BAR; Corey 2026-10-21 "the same look as the splash screen"): src/app.html's
	   #am-splash .gbar rules, the same colours (the splash's --accent, Manticore red #e32400), segments, shine and spark,
	   in this screen's master px. Only transform and opacity animate. */
	.gbar {
		--accent: #e32400;
		position: relative;
		padding: 3px;
		box-sizing: border-box;
		border-radius: 5px;
		background: rgba(0, 0, 0, 0.6);
		box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.07);
		transform: skewX(var(--skew));
	}
	.gs {
		display: flex;
		gap: 3px;
		height: 100%;
	}
	.gs i {
		flex: 1;
		position: relative;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.06);
	}
	.gs i::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 2px;
		background: linear-gradient(180deg, color-mix(in oklab, var(--accent) 55%, #fff), var(--accent) 55%, color-mix(in oklab, var(--accent) 70%, #000));
		box-shadow: 0 0 8px color-mix(in oklab, var(--accent) 55%, transparent);
		opacity: 0;
		transition: opacity 140ms ease-out var(--d, 0ms);
	}
	.gs i.on::after {
		opacity: 1;
		animation: landing-seg-pop 260ms cubic-bezier(0.2, 1.6, 0.4, 1) var(--d, 0ms);
	}
	/* the segments the splash had lit: lit from the first frame, no pop (the handoff reads as one bar) */
	.gs i.still::after {
		transition: none;
		animation: none;
	}
	@keyframes landing-seg-pop {
		from {
			transform: scaleY(1.6);
		}
		to {
			transform: scaleY(1);
		}
	}
	.gw {
		position: absolute;
		inset: 3px;
		overflow: hidden;
		border-radius: 2px;
	}
	.gc {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
	.gi {
		position: absolute;
		inset: 0;
	}
	.gc,
	.gi,
	.gk {
		transition: transform 160ms ease-out;
	}
	.gsh {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: 22%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
		animation: landing-shine 1800ms ease-in-out 600ms infinite both;
	}
	@keyframes landing-shine {
		0% {
			transform: translateX(-100%);
		}
		70%,
		100% {
			transform: translateX(460%);
		}
	}
	.gk {
		position: absolute;
		inset: 3px;
		opacity: 0;
		pointer-events: none;
	}
	.gk.on {
		opacity: 1;
	}
	/* the spark: the splash's, 2.8 x the bar's base (its drawn height / 1.8; --spark on the bar) */
	.gk b {
		position: absolute;
		left: 0;
		top: 50%;
		width: var(--spark);
		height: var(--spark);
		margin: calc(var(--spark) / -2) 0 0 calc(var(--spark) / -2);
		border-radius: 50%;
		background: radial-gradient(circle, #fff 0 12%, color-mix(in oklab, var(--accent) 50%, #fff) 24%, transparent 62%);
		animation: landing-spark 170ms linear infinite alternate;
	}
	@keyframes landing-spark {
		from {
			transform: scale(0.7) rotate(0);
			opacity: 0.7;
		}
		to {
			transform: scale(1.15) rotate(45deg);
			opacity: 1;
		}
	}
	/* the readout in the splash's face and colour ("LOADING · N%", src/app.html #am-splash .pct) */
	.pct {
		font-family: var(--ui-font, inherit);
		font-weight: 700;
		letter-spacing: 1.5px;
		color: rgba(238, 240, 230, 0.5);
		font-variant-numeric: tabular-nums;
	}
	/* PRESS ANYWHERE in the game's display face (review D10, Corey 2026-10-17 13:05; ChromeStyles --ui-font-display):
	   Cinzel 700, was Outfit Black. Its capitals are wider than Outfit's, so it tracks at --press-track, about Outfit's
	   old width at every size (the sideways column, introCards.ts INTRO_CARD.side, is set by this line). */
	.pressText {
		--press-track: 0.05em;
		font-family: var(--ui-font-display);
		font-weight: var(--ui-display-weight);
		letter-spacing: var(--press-track);
		color: #eef0e6;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
		animation: landing-pulse 1.6s ease-in-out infinite;
	}
	@keyframes landing-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pressText {
			animation: none;
		}
		/* the bar as the splash's with reduced motion: no shine, no spark, no pop */
		.gsh,
		.gk {
			display: none;
		}
		.gs i.on::after {
			animation: none;
		}
		.icard,
		.one-up .icard {
			transition: opacity var(--swap) ease;
			transform: none;
		}
		.sp.tile {
			transition: none;
		}
	}
</style>
