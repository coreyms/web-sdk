<script lang="ts" module>
	/** the book's own max win amount (wincap.amount); resolves when the whole screen is over */
	export type EmitterEventMaxWinCinematic = { type: 'maxWinCinematicPlay'; payout: number };
</script>

<script lang="ts">
	// THE MAX WIN SCREEN (Corey 2026-10-15 18:10; Stake approval review 2026-10-15, Major 2: "The 10,000x max win has no
	// moment of its own"). Modelled on Angry Mantis's MaxWinCinematic; constants MAX_WIN has every number.
	//
	// The beat starts BEFORE this screen: the round's plaque (the capped feature's wrap up, or the base game's safety net
	// win plaque) counts the book's amount up the win ladder, and the instant its MAX tier lands
	// (StingerPlaque -> game/maxWin.svelte.ts maxWinTierLanded, armed by the book's `wincap`) bgm_maxwin starts and so
	// does this screen's clock. Every stage is an offset from that instant, cut to the measured track:
	//
	//   t 0          MAX lands on the plaque, the track starts (full from 1.0 s); the plaque holds its MAX
	//   t dimAt      the DEEP dim: uiHide({ deep: true }) takes the HUD, the canvas logo and the WIN readout too; the
	//                plaque leaves; the manticore is LIFTED over the dim where he stands (game/creature.ts
	//                creatureFront.lift: his scene's twin root moves to this screen's own host, same pixels) and ROARS
	//                (his roar clip and sfx_roar, as the book's roar plays them); the Wild Medallions start to fall
	//   unleashedAt  MAYHEM UNLEASHED slams in, large
	//   slamAt       the track's swell: MAX WIN slams over it, MAYHEM UNLEASHED recedes and shrinks above it, the
	//                payout and the multiple read underneath, the rain is a downpour
	//   ~26 s        the track's fade: the rain thins with it
	//   30 s         the track ENDS: only now does the press gate arm (with a trackMs + gatePad fallback for a muted or
	//                blocked audio context), and it moves on by itself after autoAdvanceMs. Then everything fades, he
	//                goes back down to his own layer and the round finishes exactly as before (the handler that asked
	//                for this screen carries on: balance, finalWin, back to the base game and its music)
	//
	// NUMBERS: the payout is the book's wincap.amount and the multiple is that amount in base bet multiples
	// ("10,000x", en-US separators). Nothing is computed. Currency text goes through the game's own formatter (SC / GC
	// on stake.us, never a "$" there).
	// SKIP, TURBO, AUTOPLAY: as Angry Mantis. `wincap` already ended any SKIP TO RESULT (the max win is never skipped)
	// and the SKIP button is down for the wrap up; nothing here takes a press before the gate; the screen is not time
	// scaled (turbo never outruns the music); auto bonuses get the same screen and the gate's own auto advance.
	//
	// RAW PIXI, ALWAYS MOUNTED (the conditional mount z order trap): one root on the stage, straight after FreeSpinOutro
	// in components/Game.svelte (over the board, the plaques and the win screens; under the scene transition and the
	// HTML HUD). Inside it: the dim < the medallion rain < his lifted host < the titles. The ticker callback is on only
	// while the screen is up. The titles and the amount are the win plaque's own two looks (game/stinger/plaqueText.ts),
	// set from this screen's own big atlas (tools/build_maxwin_assets.py); no filter, mask or per frame texture.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { waitForResolve, waitForTimeout } from 'utils-shared/wait';
	import { bookEventAmountToBetAmountMultiplier, bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { MAX_WIN } from '../game/constants';
	import { layoutKind, type LayoutKind } from '../game/layoutSpec';
	import { creatureFront } from '../game/creature';
	import { MedallionRain } from '../game/medallionRain';
	import { PlaqueFont } from '../game/stinger/text';
	import { PlaqueText, PlaqueTitle } from '../game/stinger/plaqueText';
	import type { StingerJson } from '../game/stinger/types';
	import { installMaxWinProbe, maxWinArt, maxWinElapsed, maxWinPrefetch, maxWinRelease, maxWinReset, maxWinBegin, maxWinState, maxWinTrackEnded } from '../game/maxWin.svelte';
	import { stingerPlaque } from './StingerPlaque.svelte';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();

	// ---- the stage pieces (made once) ----
	const root = new PIXI.Container();
	root.label = 'maxwin';
	root.visible = false;
	root.eventMode = 'none';
	const dim = new PIXI.Sprite(PIXI.Texture.WHITE);
	dim.tint = 0x000000;
	dim.alpha = 0;
	const rain = new MedallionRain();
	/** his host while the screen is up (game/creature.ts creatureFront.lift) */
	const lift = new PIXI.Container();
	lift.label = 'maxwin-creature';
	lift.eventMode = 'none';
	/** the titles, in master px from the master's centre */
	const titles = new PIXI.Container();
	titles.label = 'maxwin-titles';
	/** MAYHEM over UNLEASHED: the pair recedes as one */
	const pair = new PIXI.Container();
	const slot = () => new PIXI.Container();
	const mayhemSlot = slot();
	const unleashedSlot = slot();
	const maxSlot = slot();
	const amountSlot = slot();
	pair.addChild(mayhemSlot, unleashedSlot);
	titles.addChild(pair, maxSlot, amountSlot);
	root.addChild(dim, rain.root, lift, titles);
	getContextParent().addToParent(root);

	// the type (built the first time the atlas is in; the sprites go back to EMPTY before the atlas is let go)
	type Type = { mayhem: PlaqueTitle; unleashed: PlaqueTitle; max: PlaqueTitle; amount: PlaqueText; mult: PlaqueText; font: PlaqueFont; sheet: PIXI.Spritesheet };
	let type: Type | null = null;
	const buildType = (): Type | null => {
		const sheet = maxWinArt.sheet;
		if (!sheet) return null;
		if (type?.sheet === sheet) return type;
		dropType();
		const text = (sheet.data.meta as unknown as { text: StingerJson['text'] }).text;
		const atlas = sheet.textures as Record<string, PIXI.Texture>;
		const font = new PlaqueFont({ text } as unknown as StingerJson);
		const t: Type = {
			mayhem: new PlaqueTitle(text.titles, atlas),
			unleashed: new PlaqueTitle(text.titles, atlas),
			max: new PlaqueTitle(text.titles, atlas),
			amount: new PlaqueText(font, atlas),
			mult: new PlaqueText(font, atlas),
			font,
			sheet,
		};
		mayhemSlot.addChild(t.mayhem.view);
		unleashedSlot.addChild(t.unleashed.view);
		maxSlot.addChild(t.max.view);
		amountSlot.addChild(t.amount.view, t.mult.view);
		type = t;
		laid = '';
		return t;
	};
	/** every sprite of the type off the atlas, then the atlas is free to go */
	const dropType = () => {
		if (!type) return;
		for (const s of [mayhemSlot, unleashedSlot, maxSlot, amountSlot]) for (const child of s.removeChildren()) child.destroy({ children: true });
		type = null;
	};

	// ---- layout (plain copies for the ticker) ----
	let kind: LayoutKind = 'landscape';
	let master = { x: 0, y: 0, width: 1280, height: 720, scale: 1 };
	let canvas = { width: 1280, height: 720 };
	/** the key of the last layout the type was set for */
	let laid = '';
	$effect(() => {
		kind = layoutKind(context.stateLayoutDerived.layoutType());
		const m = context.stateLayoutDerived.mainLayout();
		const c = context.stateLayoutDerived.canvasSizes();
		master = { x: m.x, y: m.y, width: m.width, height: m.height, scale: m.scale };
		canvas = { width: c.width, height: c.height };
		placeAll();
	});
	const placeAll = () => {
		dim.position.set(0, 0);
		dim.setSize(canvas.width, canvas.height);
		rain.place(canvas.width, canvas.height, master.scale, master.width);
		titles.position.set(master.x, master.y);
		titles.scale.set(master.scale);
		laid = '';
	};
	/** the strings and the slots for this layout (only when the layout, the atlas or the payout changed) */
	let payoutText = '';
	let multText = '';
	const layType = (t: Type) => {
		const key = `${kind}:${master.width}:${master.height}:${payoutText}`;
		if (laid === key) return;
		laid = key;
		const L = MAX_WIN.layout[kind];
		const H = master.height;
		t.mayhem.set('mw_mayhem', L.lineCap, L.lineWidth);
		t.unleashed.set('mw_unleashed', L.lineCap, L.lineWidth);
		t.max.set('mw_max', L.maxCap, L.maxWidth);
		const em = (cap: number) => (cap * t.font.em) / t.font.cap;
		t.amount.set(payoutText, em(L.amountCap), { maxWidth: L.amountWidth });
		t.mult.set(multText, em(L.multCap), { maxWidth: L.multWidth });
		// ACROSS: every slot on x 0, the master's centre = the SCREEN's centre (Corey 2026-10-17 15:34), and each line's
		// visible ink moved onto it inside its slot (constants MAX_WIN.titleInk / glyphInk), so the slam and the recede
		// scale about the ink's own centre
		const titleX = (title: PlaqueTitle) => -(MAX_WIN.titleInk[title.name] ?? 0) * title.scale;
		const rowX = (row: PlaqueText) => {
			const [left, right] = row.inkSpan(MAX_WIN.glyphInk.left, MAX_WIN.glyphInk.right);
			return -(left + right) / 2;
		};
		const mid = (L.mayhemY + L.unleashedY) / 2;
		mayhemSlot.position.set(0, (L.mayhemY - mid) * H);
		unleashedSlot.position.set(0, (L.unleashedY - mid) * H);
		t.mayhem.view.position.set(titleX(t.mayhem), 0);
		t.unleashed.view.position.set(titleX(t.unleashed), 0);
		maxSlot.position.set(0, (L.maxY - 0.5) * H);
		t.max.view.position.set(titleX(t.max), 0);
		amountSlot.position.set(0, 0);
		t.amount.view.position.set(rowX(t.amount), (L.amountY - 0.5) * H);
		t.mult.view.position.set(rowX(t.mult), (L.multY - 0.5) * H);
		if (import.meta.env.DEV) {
			const missing = t.font.missing(payoutText + multText);
			if (missing) console.warn(`[manticore] the max win type cannot draw "${missing}"`);
		}
	};

	// ---- the motion: every property a pure function of the screen's clock ----
	const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
	const backOut = (q: number) => {
		const s = 1.70158;
		const u = q - 1;
		return 1 + (s + 1) * u * u * u + s * u * u;
	};
	const smooth = (q: number) => q * q * (3 - 2 * q);
	/** a title slammed at `at`: its slot's scale and alpha at `t` */
	const slam = (node: PIXI.Container, t: number, at: number) => {
		if (t < at) {
			node.visible = false;
			return;
		}
		node.visible = true;
		const q = clamp01((t - at) / MAX_WIN.slamMs);
		node.scale.set(MAX_WIN.slamFrom + (1 - MAX_WIN.slamFrom) * backOut(q));
		node.alpha = clamp01((t - at) / MAX_WIN.slamFadeMs);
	};
	const flare = (title: PlaqueTitle, t: number, at: number) => title.glowGain(t < at ? 0 : 1 + (MAX_WIN.glowFlare - 1) * clamp01(1 - (t - at) / MAX_WIN.glowSettleMs));

	let up = false;
	/** 1 while the screen is up, falling to 0 over outFadeMs on the way out */
	let outAt = 0;
	const frame = (ticker: PIXI.Ticker) => {
		const t = maxWinElapsed();
		const now = performance.now();
		const dimIn = clamp01((t - MAX_WIN.dimAt) / MAX_WIN.dimFadeMs);
		const out = outAt ? clamp01(1 - (now - outAt) / MAX_WIN.outFadeMs) : 1;
		dim.alpha = MAX_WIN.dimAlpha * dimIn * out;
		rain.root.alpha = out * MedallionRain.fadeAt(t);
		titles.alpha = out;
		rain.tick(ticker.deltaMS, t);
		maxWinState.medallions = rain.live;
		const ty = buildType();
		if (ty) {
			layType(ty);
			const L = MAX_WIN.layout[kind];
			const H = master.height;
			slam(mayhemSlot, t, MAX_WIN.unleashedAt);
			slam(unleashedSlot, t, MAX_WIN.unleashedAt + MAX_WIN.unleashedStaggerMs);
			flare(ty.mayhem, t, MAX_WIN.unleashedAt);
			flare(ty.unleashed, t, MAX_WIN.unleashedAt + MAX_WIN.unleashedStaggerMs);
			slam(maxSlot, t, MAX_WIN.slamAt);
			flare(ty.max, t, MAX_WIN.slamAt);
			// the pair recedes (shrinks and lifts) as MAX WIN lands on it
			const r = smooth(clamp01((t - MAX_WIN.slamAt) / MAX_WIN.recedeMs));
			const mid = (L.mayhemY + L.unleashedY) / 2;
			pair.position.set(0, ((mid + (L.recedeY - mid) * r) - 0.5) * H);
			pair.scale.set(1 + (L.recedeScale - 1) * r);
			pair.alpha = 1 + (MAX_WIN.recedeAlpha - 1) * r;
			const a = t - MAX_WIN.slamAt - MAX_WIN.amountAt;
			amountSlot.visible = a >= 0;
			amountSlot.alpha = clamp01(a / MAX_WIN.amountFadeMs);
		}
	};
	const startTicker = () => {
		if (up) return;
		up = true;
		context.stateApp.pixiApplication?.ticker.add(frame, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
	};
	const stopTicker = () => {
		if (!up) return;
		up = false;
		context.stateApp.pixiApplication?.ticker.remove(frame);
	};

	// ---- the run ----
	let gateArmed = $state(false);
	let press: () => void = () => {};
	/** DEV: when each stage actually ran, ms on the screen's clock */
	const log: { stage: string; t: number }[] = [];
	const mark = (stage: string) => {
		if (import.meta.env.DEV) log.push({ stage, t: Math.round(maxWinElapsed()) });
	};
	/** wait until `ms` after the track started (at once if that moment has passed) */
	const waitUntil = async (ms: number) => {
		const left = ms - maxWinElapsed();
		if (left > 0) await waitForTimeout(left);
	};
	const sound = (name: 'sfx_roar' | typeof MAX_WIN.slamSound) => context.eventEmitter.broadcast({ type: 'soundOnce', name, forcePlay: true });

	let done: (() => void) | undefined;
	let donePromise: Promise<void> | undefined;
	let running = false;

	const run = async () => {
		log.length = 0;
		mark('start');
		// normally in since the round's first reveal; a no-op then (the titles appear whenever it lands)
		void maxWinPrefetch();
		payoutText = bookEventAmountToCurrencyString(maxWinState.payout);
		multText = `${Math.round(bookEventAmountToBetAmountMultiplier(maxWinState.payout)).toLocaleString('en-US')}x`;
		laid = '';
		outAt = 0;
		placeAll();
		const texture = (context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined)?.[MAX_WIN.rain.texture];
		if (texture) rain.build(texture, kind);
		rain.clear();
		for (const s of [mayhemSlot, unleashedSlot, maxSlot]) s.visible = false;
		amountSlot.visible = false;

		// ---- the dim, the lift, the roar ----
		await waitUntil(MAX_WIN.dimAt);
		const dimmedAt = maxWinElapsed();
		maxWinState.phase = 'dim';
		mark('dim');
		void context.eventEmitter.broadcastAsync({ type: 'uiHide', deep: true });
		// the plaque leaves under the dim (its own exit; the wrap up / win screen's later hide finds it gone)
		void stingerPlaque.flow?.hide();
		creatureFront.lift = lift;
		creatureFront.sync();
		root.visible = true;
		startTicker();
		await waitUntil(Math.max(MAX_WIN.roarAt, dimmedAt + (MAX_WIN.roarAt - MAX_WIN.dimAt)));
		mark('roar');
		context.eventEmitter.broadcast({ type: 'featureBeat', beat: 'roar', rows: [] });
		sound('sfx_roar');

		// ---- MAYHEM UNLEASHED ----
		await waitUntil(Math.max(MAX_WIN.unleashedAt, dimmedAt + (MAX_WIN.unleashedAt - MAX_WIN.dimAt)));
		maxWinState.phase = 'unleashed';
		mark('unleashed');
		sound(MAX_WIN.slamSound);

		// ---- MAX WIN ----
		await waitUntil(Math.max(MAX_WIN.slamAt, dimmedAt + (MAX_WIN.slamAt - MAX_WIN.dimAt)));
		maxWinState.phase = 'slam';
		mark('slam');
		sound(MAX_WIN.slamSound);

		// ---- the gate: shut until the track has ended ----
		await maxWinTrackEnded();
		maxWinState.phase = 'gate';
		mark(`gate:${maxWinState.gateBy}`);
		gateArmed = true;
		await Promise.race([waitForResolve((resolve) => (press = resolve)), waitForTimeout(MAX_WIN.autoAdvanceMs)]);
		gateArmed = false;
		press = () => {};

		// ---- out ----
		maxWinState.phase = 'out';
		mark('out');
		outAt = performance.now();
		await waitForTimeout(MAX_WIN.outFadeMs);
		stopTicker();
		root.visible = false;
		rain.clear();
		creatureFront.lift = null;
		creatureFront.sync();
		dropType();
		maxWinRelease();
		mark('done');
		done?.();
	};

	const ensureRunning = () => {
		if (maxWinState.startedAt === 0 || running) return;
		running = true;
		donePromise = new Promise<void>((resolve) => (done = resolve));
		void run();
	};
	// the normal path: the MAX landing on the plaque starts the clock, and this picks it up on the next flush
	$effect(() => {
		void maxWinState.startedAt;
		ensureRunning();
	});

	context.eventEmitter.subscribeOnMount({
		maxWinCinematicPlay: async ({ payout }) => {
			// normally running already (the MAX landing started it). The safety net: a plaque that never showed (its art
			// never arrived, the plain fallback screens) starts the clock, the track and the screen from here
			if (maxWinState.startedAt === 0) maxWinBegin(payout, 'event');
			// synchronously: the effect above only runs on the next flush (Angry Mantis's 2026-09-15 lesson)
			ensureRunning();
			await donePromise;
			running = false;
			maxWinReset();
		},
	});

	onMount(() => {
		// DEV: the screen on its own, without a book (tools/manticore/maxwin_probe.js SHOTS: every layout's stills).
		// Nothing of the round is touched: no amount, no balance, no board; the clock, the music and the screen only.
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			((window as any).__manticore ??= {}).maxWinDemo = (payout = 1000000) => {
				if (maxWinState.startedAt !== 0 || running) return false;
				maxWinBegin(payout, 'event');
				ensureRunning();
				void donePromise?.then(() => {
					running = false;
					maxWinReset();
				});
				return true;
			};
		}
		installMaxWinProbe(() => ({ log: log.slice(), lifted: creatureFront.lift === lift, titlesShown: !!type && maxSlot.visible, layout: kind }));
		return () => {
			stopTicker();
			if (creatureFront.lift === lift) {
				creatureFront.lift = null;
				creatureFront.sync();
			}
			dropType();
			rain.destroy();
			for (const child of root.removeChildren()) if (child !== rain.root && child !== lift) child.destroy({ children: true });
		};
	});
</script>

<!-- the gate only exists once the track has ended: until then nothing here takes a press -->
{#if gateArmed}
	<PressToContinue showText atHudBand onpress={() => press()} />
{/if}
