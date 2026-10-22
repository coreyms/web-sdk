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
	import { bootSizes } from '../game/assetStamp';
	import { loadGate } from '../game/loadGate.svelte';
	import { sound } from '../game/sound';
	import { INTRO_CARD, INTRO_CARD_ASSETS, INTRO_CARD_STYLE, INTRO_GATE, INTRO_LOGO_SHINE_MS, LANDING_BAR, introGatePctSize, introPlacement } from '../game/introCards';
	import { INTRO_BODY_FIT, LOAD_GATE } from '../game/constants';
	import { INTRO_CARD_TEXT, INTRO_DOT_LABEL, INTRO_MAX_WIN, introBodyRuns, introSceneIndexAt } from '../game/introCardText';
	import Shine from './Shine.svelte';

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
	const place = $derived(introPlacement(kind, innerWidth.current ?? 1, innerHeight.current ?? 1));

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
	const logoSrc = $derived(stamp('/assets/ui/logo-stacked.webp'));
	const logo = $derived(place.logo);

	// ---- the cards -------------------------------------------------------------------------------
	const C = INTRO_CARD;
	const N = INTRO_CARD_TEXT.length;
	const frameSrc = stamp(INTRO_CARD_ASSETS.frame);
	const posterSrc = INTRO_CARD_TEXT.map((c) => stamp(INTRO_CARD_ASSETS.poster(c.key)));
	const clipSrc = INTRO_CARD_TEXT.map((c) => stamp(INTRO_CARD_ASSETS.clip(c.key)));
	const bodyRuns = INTRO_CARD_TEXT.map(introBodyRuns);
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
	/** the frame picture is decoded (game/boot.svelte.ts decoded it on the splash): the cards fade in. A frame that never
	 *  arrives leaves no cards, and nothing waits. */
	let frameReady = $state(false);
	$effect(() => {
		if (!armed) return;
		const img = new Image();
		img.src = frameSrc;
		img.decode().then(() => (frameReady = true), () => {});
	});
	/** the clips may run: on the splash's fade when the cards came in on the splash, else at PRESS ANYWHERE
	 *  (holdClipsUntilLoaded) */
	const clipsGo = $derived(cardsIn ? boot.splashOut : !C.holdClipsUntilLoaded || ready);

	const oneUp = $derived(place.mode !== 'row');
	/** one card at a time: which one shows */
	let active = $state(0);
	let activeSince = 0;
	const isVisible = (i: number) => frameReady && (!oneUp || i === active);
	/** the scene line each card shows (follows its clip's time) */
	let sceneIdx = $state(INTRO_CARD_TEXT.map(() => 0));
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
			sceneIdx[next] = 0;
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

	// one loop for the three cards: the scene line follows the clip's time, and with one card at a time the
	// card moves on when its clip has played once (or, with no clip running, after stillDwellMs)
	const frame = (now: number) => {
		for (let i = 0; i < N; i += 1) {
			const v = videos[i];
			if (!v || v.paused || v.readyState < 2) continue;
			const card = INTRO_CARD_TEXT[i];
			const t = v.currentTime;
			if (!live[i] && t > 0.03) live[i] = true;
			const idx = introSceneIndexAt(card, t);
			if (idx !== sceneIdx[i]) sceneIdx[i] = idx;
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

	// ---- THE BODY SHRINK TO FIT (constants INTRO_BODY_FIT) ----------------------------------------------
	// A body taller than its zone (.zb clips it top and bottom) steps its font size down until it fits, never under the
	// floor. Measured in layout px (offsetHeight ignores the .fit and card transforms); hidden cards are only at opacity
	// 0, so every card is measured. Runs once the body faces are in, on every placement change (resize, turn) and when
	// the cards mount; never per frame. A body that fits keeps --b-k unset (the slate's own size).
	const bodyEls: (HTMLElement | undefined)[] = $state([]);
	const bodyFit: { k: number; bodyH: number; zoneH: number; fontPx: number }[] = [];
	const fitBodies = () => {
		for (let i = 0; i < N; i += 1) {
			const b = bodyEls[i];
			const zone = b?.parentElement;
			if (!b || !zone) continue;
			b.style.removeProperty('--b-k');
			const zoneH = zone.clientHeight;
			const base = parseFloat(getComputedStyle(b).fontSize);
			let k = 1;
			if (zoneH > 0 && base > 0) {
				const minK = INTRO_BODY_FIT.floor;
				while (b.offsetHeight > zoneH + INTRO_BODY_FIT.slackPx && k > minK) {
					k = Math.max(minK, k - INTRO_BODY_FIT.stepPx / base);
					b.style.setProperty('--b-k', String(k));
				}
			}
			bodyFit[i] = { k, bodyH: b.offsetHeight, zoneH, fontPx: base * k };
		}
	};
	let bodyFacesIn = $state(false);
	onMount(() => {
		let gone = false;
		// the body's two weights (400, the highlight 600), then whatever else the page still loads
		Promise.all([document.fonts.load(`${INTRO_CARD_STYLE.body.weight} 40px Sora`), document.fonts.load(`${INTRO_CARD_STYLE.highlight.weight} 40px Sora`)])
			.catch(() => {})
			.then(() => document.fonts.ready)
			.then(() => {
				if (!gone) bodyFacesIn = true;
			});
		return () => (gone = true);
	});
	$effect(() => {
		// what the fit depends on: the faces, the placement (the card's width), the cards being mounted
		void place;
		if (!bodyFacesIn || !armed || bodyEls.filter(Boolean).length < N) return;
		untrack(fitBodies);
	});

	// the slate's numbers as CSS variables (card-width units, multiplied by --u = 1% of the card's width)
	const S = INTRO_CARD_STYLE;
	const cardVars = [
		`--win-l:${C.window.left}%`, `--win-t:${C.window.top}%`, `--win-w:${C.window.width}%`, `--win-h:${C.window.height}%`,
		`--side:${S.side}`,
		`--t-top:${S.title.top}`, `--t-h:${S.title.height}`, `--t-size:${S.title.size}`, `--t-weight:${S.title.weight}`, `--t-ls:${S.title.letterSpacingEm}em`, `--t-color:${S.title.color}`, `--t-font:${S.title.font}`,
		`--t-dark-y:${S.titleEdge.darkY}`, `--t-dark:${S.titleEdge.dark}`, `--t-light-y:${S.titleEdge.lightY}`, `--t-light:${S.titleEdge.light}`,
		`--b-top:${S.body.top}`, `--b-h:${S.body.height}`, `--b-size:${S.body.size}`, `--b-weight:${S.body.weight}`, `--b-lh:${S.body.lineHeight}`, `--b-color:${S.body.color}`, `--b-font:${S.body.font}`,
		`--hl-color:${S.highlight.color}`, `--hl-weight:${S.highlight.weight}`,
		`--r-top:${S.rule.top}`, `--r-side:${S.rule.side}`, `--r-h:${S.rule.height}`, `--r-color:${S.rule.color}`,
		`--c-top:${S.scene.top}`, `--c-h:${S.scene.height}`, `--c-size:${S.scene.size}`, `--c-weight:${S.scene.weight}`, `--c-lh:${S.scene.lineHeight}`, `--c-color:${S.scene.color}`, `--c-font:${S.scene.font}`,
		`--fade-in:${C.fadeInMs}ms`, `--swap:${C.swapMs}ms`, `--slide:${C.swapSlide}px`, `--scene-fade:${C.sceneFadeMs}ms`,
	].join(';');

	// ---- DEV hook: __manticore.landing() (tools/manticore/landing_probe.js) ----
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		Object.assign(((window as any).__manticore ??= {}), {
			/** the body shrink to fit: runs it again now (a probe that widened the text with a style first) and says per
			 *  card the factor, the body's and the zone's height and the font size, layout px */
			landingFit: () => {
				fitBodies();
				return bodyFit.map((f, i) => ({ key: INTRO_CARD_TEXT[i].key, ...f }));
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
						sceneIndex: sceneIdx[i],
						sceneLine: card.sceneLines[sceneIdx[i]].text,
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
		<!-- the explainer cards, in master px: clip in the glass window, the frame picture over it, live text on the slate -->
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
						<div class="z zt"><span class="t">{card.title}</span></div>
						<div class="z zb">
							<span class="b" bind:this={bodyEls[i]}>{#each bodyRuns[i] as run}{#if run.hl}<b>{run.text}</b>{:else}{run.text}{/if}{/each}</span>
						</div>
						<div class="rule"></div>
						<div class="z zc">
							{#key sceneIdx[i]}<span class="cap">{card.sceneLines[sceneIdx[i]].text}</span>{/key}
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
		<span class="shine-host logo" style:width="{logo.w}px" style:left="{logo.cx - logo.w / 2}px" style:top="{logo.cy}px">
			<img src={logoSrc} alt="Manticore Mayhem" width={logo.w} draggable="false" /><Shine src={stamp('/assets/ui/logo-stacked-glint.webp')} idleMs={INTRO_LOGO_SHINE_MS} />
		</span>

		<div class="gate" style:padding="{SZ.pad}px" style:transform="translateX({place.gateCx - master.width / 2}px)">
			<!-- the max win line (Corey 2026-10-21): steady over the bar and over PRESS ANYWHERE, the number from config -->
			<div class="maxwin" style:font-size="{SZ.maxWin}px">{INTRO_MAX_WIN.lead}<b>{INTRO_MAX_WIN.num}</b>{INTRO_MAX_WIN.tail}</div>
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
	/* the slate's fixed zones (card-width units x --u) */
	.z {
		position: absolute;
		left: calc(var(--u) * var(--side));
		right: calc(var(--u) * var(--side));
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		overflow: hidden;
	}
	.zt {
		top: calc(var(--u) * var(--t-top));
		height: calc(var(--u) * var(--t-h));
		white-space: nowrap;
	}
	.zb {
		top: calc(var(--u) * var(--b-top));
		height: calc(var(--u) * var(--b-h));
	}
	.zc {
		top: calc(var(--u) * var(--c-top));
		height: calc(var(--u) * var(--c-h));
	}
	.rule {
		position: absolute;
		left: calc(var(--u) * var(--r-side));
		right: calc(var(--u) * var(--r-side));
		top: calc(var(--u) * var(--r-top));
		height: max(1px, calc(var(--u) * var(--r-h)));
		background: linear-gradient(90deg, transparent, var(--r-color) 18%, var(--r-color) 82%, transparent);
	}
	.t {
		font-family: var(--t-font);
		font-weight: var(--t-weight);
		font-size: calc(var(--u) * var(--t-size));
		line-height: 1;
		letter-spacing: var(--t-ls);
		color: var(--t-color);
		text-transform: uppercase;
		text-shadow:
			0 calc(var(--u) * var(--t-dark-y)) 0 var(--t-dark),
			0 calc(var(--u) * var(--t-light-y)) 0 var(--t-light);
	}
	.b {
		font-family: var(--b-font);
		font-weight: var(--b-weight);
		/* --b-k: the shrink to fit (fitBodies, constants INTRO_BODY_FIT), 1 wherever the body fits its zone */
		font-size: calc(var(--u) * var(--b-size) * var(--b-k, 1));
		line-height: var(--b-lh);
		color: var(--b-color);
	}
	.b b {
		color: var(--hl-color);
		font-weight: var(--hl-weight);
	}
	.cap {
		font-family: var(--c-font);
		font-weight: var(--c-weight);
		font-size: calc(var(--u) * var(--c-size));
		line-height: var(--c-lh);
		color: var(--c-color);
		animation: landing-scene-in var(--scene-fade) ease both;
	}
	@keyframes landing-scene-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
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
	.shine-host {
		position: relative;
		display: block;
		filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.7));
	}
	.shine-host img {
		display: block;
		width: 100%;
		height: auto;
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
	/* THE MAX WIN LINE (Corey 2026-10-21, introCardText INTRO_MAX_WIN): PRESS ANYWHERE's face, steady (no pulse), in the
	   cards' copy colour with the number in the cards' highlight gold (INTRO_CARD_STYLE body / highlight) */
	.maxwin {
		font-family: var(--ui-font-display);
		font-weight: var(--ui-display-weight);
		letter-spacing: 0.05em;
		line-height: 1.3;
		white-space: nowrap;
		color: #ddd3bb;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
	}
	.maxwin b {
		font-weight: inherit;
		color: #e0b860;
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
		.cap {
			animation: none;
		}
	}
</style>
