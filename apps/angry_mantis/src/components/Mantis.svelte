<script lang="ts" module>
	import type { Striker, BonusHost, PayingSymbolName, Position } from '../game/types';
	import type { RigReaction } from '../game/constants';

	export type EmitterEventMantis =
		| { type: 'mantisShow'; host: BonusHost }
		| { type: 'mantisWalkOut' }
		| { type: 'mantisHide' }
		| { type: 'mantisStrike'; striker: Striker; trigger: 'auto' | 'glowingLeaf'; position?: Position }
		| { type: 'mantisEat'; striker: Striker; symbol: PayingSymbolName | null; from?: Position | null }
		| { type: 'mantisReact'; kind: RigReaction };
</script>

<script lang="ts">
	// Bonus-session mantises on the BoneRutter rig: Marty (default art, stands right, faces left)
	// and Marky ('Marky' skin, stands left, mirrored to face right). One Strike clip carries the
	// whole strike-and-eat performance — wind-up, claw impact at RIG.strike.hitFrame, then
	// recovery/chomp playing out underneath the insect's flight to the mouth (see constants.ts).
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { Sprite, BaseSprite, Container, Circle } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { nextSymbolToEat } from '../game/stateGame.svelte';
	import GameText from './GameText.svelte';
	import { TIMINGS, SYMBOL_SIZE, CELL_FILL, RIG, SFX_TRANSIENT, reactionPoolFor, reactionVoice, strikeVoice, eatVoice } from '../game/constants';
	import { bellPose } from '../game/bell';
	import { BELL_GLOW, bellGlowPose, bellHaloTexture, bellRaysTexture, bellRingTexture } from '../game/bellGlow';
	import { MARTY, MASTER, layoutKind, martyFor } from '../game/layoutSpec';
	import type { Rig } from '../bonerutter';
	import { rigPointInHost, playClip, playIdle, currentClip, isIdling } from '../game/mantisRig';
	import BoneRig from './BoneRig.svelte';

	const context = getContext();

	// Bonus mantises match the base-game Marty exactly (Corey 2026-08-26): marty stands in the SAME
	// spot/size as the base-game Marty; marky mirrors him across the master centre.
	const mantisPlace = () => {
		const kind = layoutKind(context.stateLayoutDerived.layoutType());
		const vw = context.stateLayoutDerived.canvasSizes().width / context.stateLayoutDerived.mainLayout().scale;
		const m = martyFor(kind, vw); // portrait y tracks the frame bottom, like MartyArt
		return { marty: { x: m.x, y: m.y }, marky: { x: MASTER[kind].width - m.x, y: m.y }, size: m.size };
	};

	let show = $state(false);
	let host = $state<BonusHost>('marty');
	let eating = $state<{ striker: Striker; symbol: PayingSymbolName | null } | null>(null);
	let chomp = $state(false);
	let martyRig = $state<Rig | null>(null);
	let markyRig = $state<Rig | null>(null);
	// eaten symbol: flies from the centre tray to the striker's mouth (offsets are relative to the mantis)
	const fly = new Tween({ x: 0, y: 0, s: 1 }, { duration: Math.round(TIMINGS.eat * 0.6), easing: cubicIn });
	// fallback mouth position (fractions of the placeholder body) for the frame-perfect-race case
	// where a strike lands before the rig finishes loading
	const mouthOffset = (isMarty: boolean, size: number) => ({ x: isMarty ? -size * 0.15 : size * 0.22, y: isMarty ? -size * 0.3 : -size * 0.23 });
	// Every course is served at the board centre (Corey 2026-09-10): once the bell has rung — in its
	// cell for a board strike, or on the hero bell that drops in first for an opening bite — the
	// tray with the meal drops to the centre, the strike launches at it and the tray fades away
	// as the insect is taken. game/bell.ts has the frame sequence.
	let heroBell = $state(false);
	let bellRing = $state<number | null>(null);
	let bellRaf = 0;
	let heroTray = $state<PayingSymbolName | null>(null);
	const dropMs = Math.round(TIMINGS.strike * 0.6);
	const bellDrop = new Tween(0, { duration: dropMs, easing: cubicIn });
	const bellFade = new Tween(1, { duration: dropMs, easing: cubicOut });
	const trayDrop = new Tween(0, { duration: dropMs, easing: cubicIn });
	const trayFade = new Tween(1, { duration: Math.round(TIMINGS.eat * 0.6), easing: cubicOut });
	// bonus-intro spotlight: everything but the mantises + bell + tray dims during the opening
	// auto-bites, so the plate ceremony reads as "this is what the bonus does" (player feedback:
	// the meal got lost against the background). HTML UI sits above the canvas, untouched.
	const TRAY_HERO = 1.5; // the centre bell and tray are oversized for the same reason
	const aboveBoard = () => {
		const layout = context.stateGameDerived.boardLayout();
		return -(layout.height * layout.scale) / 2 - 140;
	};
	// hero bell press: frames over TIMINGS.ring (raw ms, same span ReelSymbol plays a board bell)
	const ringHeroBell = () =>
		new Promise<void>((resolve) => {
			const t0 = performance.now();
			cancelAnimationFrame(bellRaf);
			const step = (now: number) => {
				const p = (now - t0) / TIMINGS.ring;
				if (p >= 1) {
					bellRing = null;
					bellRaf = 0;
					resolve();
					return;
				}
				bellRing = p;
				bellRaf = requestAnimationFrame(step);
			};
			bellRaf = requestAnimationFrame(step);
		});
	$effect(() => () => cancelAnimationFrame(bellRaf));
	// glow under the hero bell (game/bellGlow.ts): the app ticker advances one clock while the
	// bell is up; `dingAt` marks the ring for the ripple. Alpha/rotation only — nothing re-rasters.
	let glowT = $state(0);
	let dingAt: number | null = null;
	let glowDing = $state<number | null>(null);
	$effect(() => {
		if (!heroBell) return;
		const ticker = context.stateApp.pixiApplication?.ticker;
		const t0 = performance.now();
		dingAt = null;
		const tick = () => {
			const now = performance.now();
			glowT = now - t0;
			glowDing = dingAt === null ? null : now - dingAt;
		};
		ticker?.add(tick);
		return () => {
			ticker?.remove(tick);
			glowT = 0;
			glowDing = null;
		};
	});
	let spotlight = $state(false);
	const spot = new Tween(0, { duration: 350 });
	$effect(() => {
		spot.set(spotlight ? 0.55 : 0);
	});

	const rigOf = (striker: Striker) => (striker === 'marty' ? martyRig : markyRig);
	// test hook (house rules: extend __angryMantis, never a new global): which clip each host is on
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		Object.assign(((window as any).__angryMantis ??= {}), {
			rigClips: () => ({ marty: martyRig ? currentClip(martyRig) : null, marky: markyRig ? currentClip(markyRig) : null }),
		});
	}

	// a striking/eating mantis must not be interrupted by a reaction (the strike clip owns the arc)
	const busy: Record<Striker, boolean> = $state({ marty: false, marky: false });

	// walk entrances/exits (2026-08-29 export): only MARKY walks — Marty is already standing in
	// this exact slot from the base game (MartyArt hands off in place; Corey 2026-08-29: "he's
	// already there"), so walking him in would mean he vanishes and re-enters. Marky enters from
	// the left edge with Walking (he's mirrored, so it reads forward) and backs out with Walking
	// Backwards. Strikes await walkDone so an opening auto-bite can never fire mid-entrance.
	const WALK_MS = 1200;
	const walkOff = { marty: new Tween(0), marky: new Tween(0) };
	const walkDone: Record<Striker, Promise<void>> = { marty: Promise.resolve(), marky: Promise.resolve() };
	const offscreenDist = (name: Striker) => {
		const kind = layoutKind(context.stateLayoutDerived.layoutType());
		const m = MARTY[kind];
		const d = MASTER[kind].width - m.x + m.size;
		return name === 'marty' ? d : -d;
	};
	const walkIn = () => {
		const targets = (host === 'both' ? (['marty', 'marky'] as Striker[]) : [host]).filter(
			(name) => name === 'marky',
		);
		targets.forEach((name, i) => {
			walkDone[name] = (async () => {
				busy[name] = true;
				walkOff[name].set(offscreenDist(name), { duration: 0 });
				for (let t = 0; t < 30 && !rigOf(name); t++) await waitForTimeout(100); // rig loads async
				const rig = rigOf(name);
				if (!rig) {
					walkOff[name].set(0, { duration: 0 });
					busy[name] = false;
					return;
				}
				if (i) await waitForTimeout(180); // the pair never moves in lockstep
				playClip(rig, RIG.walk.forward, { loop: true, speed: RIG.walkSpeed });
				await walkOff[name].set(0, { duration: WALK_MS });
				playIdle(rig);
				busy[name] = false;
			})();
		});
	};

	// finishing-touches item 2: hosts react to spin outcomes. Feast desync rule (Corey): when both
	// react to the same beat they pull DIFFERENT clips from the pool, staggered so they never move
	// in lockstep.
	const react = (kind: RigReaction) => {
		const targets = (host === 'both' ? (['marty', 'marky'] as Striker[]) : [host]).filter(
			(name) => !busy[name] && rigOf(name),
		);
		if (targets.length === 0) return;
		// one voice for the beat, not one per rig — both hosts reacting is still a single sound
		context.eventEmitter.broadcast({ type: 'soundOnce', name: reactionVoice(kind) });
		let taken: string | null = null;
		targets.forEach((name, i) => {
			// each skin picks from ITS OWN pool (RIG_SKIN_EXCLUDE), avoiding the clip the other host
			// just took so both reacting still never move in lockstep
			const own = reactionPoolFor(kind, name);
			const choices = own.filter((c) => c !== taken);
			const from = choices.length ? choices : own;
			const clip = from[Math.floor(Math.random() * from.length)];
			if (!clip) return; // nothing this skin may play for the beat: stay idle
			taken = clip;
			const start = () => {
				const rig = rigOf(name);
				if (busy[name] || !rig) return;
				playClip(rig, clip, {
					loop: false,
					onComplete: () => {
						const r = rigOf(name);
						if (r) playIdle(r);
					},
				});
			};
			if (i === 0) start();
			else setTimeout(start, 120 + Math.random() * 120);
		});
	};

	context.eventEmitter.subscribeOnMount({
		mantisShow: ({ host: h }) => {
			host = h;
			if (!show) {
				show = true;
				walkIn();
			}
		},
		// bonus end (Corey 2026-09-05): only MARKY leaves. Marty keeps standing through the door
		// drop and the outro; MartyArt takes his slot back at mantisHide, which freeSpinEnd fires
		// in the same flush as gameType -> 'basegame' so he never blinks out. Super (Marky solo)
		// empties the stage here; MartyArt walks Marty back in on its own.
		mantisWalkOut: async () => {
			const walkers = activeHosts.filter((name) => name === 'marky' && rigOf(name));
			if (walkers.length === 0) {
				if (host === 'marky') show = false;
				return;
			}
			await Promise.all(
				walkers.map(async (name, i) => {
					await walkDone[name];
					const rig = rigOf(name);
					if (!rig) return;
					busy[name] = true;
					if (i) await waitForTimeout(180);
					playClip(rig, RIG.walk.backward, { loop: true, speed: RIG.walkSpeed });
					await walkOff[name].set(offscreenDist(name), { duration: WALK_MS });
					busy[name] = false;
				}),
			);
			if (host === 'marky') show = false;
			else host = 'marty';
			walkOff.marky.set(0, { duration: 0 });
		},
		// instant: the rig layer leaves in the same frame MartyArt returns (no walk, no fade)
		mantisHide: () => {
			show = false;
			host = 'marty';
			(['marty', 'marky'] as Striker[]).forEach((n) => walkOff[n].set(0, { duration: 0 }));
		},
		mantisReact: ({ kind }) => react(kind),
		mantisStrike: async ({ striker, position }) => {
			show = true;
			await walkDone[striker]; // never strike mid-entrance
			busy[striker] = true;
			if (!position) {
				spotlight = true;
				// opening bite: no bell on the board, so a hero bell drops to the centre and rings there
				heroBell = true;
				bellFade.set(1, { duration: 0 });
				bellDrop.set(aboveBoard(), { duration: 0 });
				await bellDrop.set(0);
				await waitForTimeout(TIMINGS.bellSettle); // let the bell land and sit before the ding
				context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_service_bell' });
				dingAt = performance.now(); // the glow's ripple rides the ding
				await ringHeroBell();
			} else {
				// board bell: ReelSymbol plays the press in its cell off pendingStrikePos; the ding is ours
				context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_service_bell' });
				await waitForTimeout(TIMINGS.ring);
			}
			// order up: the tray with the next course drops to the board centre (the hero bell, if
			// any, fades under it); the strike launches at the tray
			const symbol = nextSymbolToEat();
			if (symbol) {
				heroTray = symbol;
				trayFade.set(1, { duration: 0 });
				trayDrop.set(aboveBoard(), { duration: 0 });
				if (heroBell) bellFade.set(0);
				await trayDrop.set(0);
			}
			// speed maps the claw impact onto TIMINGS.strike; the 2s recovery/chomp tail keeps
			// playing under the eat phase and hands back to idle on its own
			const rig = rigOf(striker);
			if (rig) {
				const speed = (RIG.strike.hitFrame / RIG.strike.fps) * 1000 / TIMINGS.strike;
				playClip(rig, RIG.strike[striker], {
					loop: false,
					speed,
					onComplete: () => {
						const r = rigOf(striker);
						if (r) playIdle(r);
					},
				});
			}
			// The strike voice belongs to the LUNGE, not to the book event: it used to be broadcast in
			// bookEventHandlerMap the instant the strike event arrived, i.e. at the start of the wind-up
			// (and, on an auto bite, before the tray had even finished dropping), which read as
			// the sting happening while the insect was still on its plate. Fire it late enough that its
			// impact transient lands on the claw hit at TIMINGS.strike — the arms are travelling forward
			// through this window. Total wait is unchanged, so the eat beat still follows immediately.
			await waitForTimeout(TIMINGS.strike - SFX_TRANSIENT.martyStrike);
			context.eventEmitter.broadcast({ type: 'soundOnce', name: strikeVoice(striker) });
			await waitForTimeout(SFX_TRANSIENT.martyStrike);
		},
		mantisEat: async ({ striker, symbol, from }) => {
			const place = mantisPlace();
			const layout = context.stateGameDerived.boardLayout();
			const isMarty = striker === 'marty';
			const me = isMarty ? place.marty : place.marky;
			eating = { striker, symbol };
			if (symbol) {
				// the flight starts on the tray at the board centre, where mantisStrike just served it
				// (`from`, the bell's cell, only matters to the board-side bookkeeping now)
				void from;
				const startRel = { x: layout.x - me.x, y: layout.y - me.y };
				const pickup = ((SYMBOL_SIZE * CELL_FILL) / 90) * TRAY_HERO;
				const rig = rigOf(striker);
				fly.set({ ...startRel, s: pickup }, { duration: 0 });
				trayFade.set(0); // the tray empties as the insect lifts off
				// ...and the eat voice goes with the pluck, chained straight behind the strike impact
				// that just landed (it was broadcast from bookEventHandlerMap before). Only a real meal
				// sounds: a cosmetic strike reaches mantisEat with symbol null and stays silent, exactly
				// as it did before. Plain soundOnce, so Feast's two hosts plucking together share one
				// voice instead of doubling — same guard philosophy as the reaction sounds.
				context.eventEmitter.broadcast({ type: 'soundOnce', name: eatVoice(striker) });

				// claw-catch (finishing-touches): this fires right at the strike clip's impact frame
				// (mantisStrike maps the claw hit onto the end of TIMINGS.strike), so the insect snaps
				// to whichever claw is nearer the meal, rides it through the recovery arc, then
				// vanishes into the chomp. Frame constants become rig `grab`/`mouth` event markers
				// once Corey's next export carries them.
				const mirror = !isMarty;
				const claw = (() => {
					if (!rig) return null;
					const pts = (['Right Claw', 'Left Claw'] as const).map((name) => ({ name, p: rigPointInHost(rig, name, mirror) }));
					const near = pts
						.filter((c): c is { name: (typeof pts)[number]['name']; p: { x: number; y: number } } => c.p !== null)
						.sort((a, b) => Math.hypot(a.p.x - startRel.x, a.p.y - startRel.y) - Math.hypot(b.p.x - startRel.x, b.p.y - startRel.y));
					return near[0] ?? null;
				})();
				if (rig && claw) {
					await fly.set({ ...claw.p, s: pickup * 0.85 }, { duration: 130, easing: cubicIn });
					// carry: pin to the claw per frame while the recovery pulls it in
					const ticker = context.stateApp.pixiApplication?.ticker;
					const carryMs = TIMINGS.eat * 0.45;
					const t0 = performance.now();
					const tick = () => {
						const pt = rigPointInHost(rig, claw.name, mirror);
						if (!pt) return;
						const k = Math.min(1, (performance.now() - t0) / carryMs);
						fly.set({ ...pt, s: pickup * 0.85 + (0.55 - pickup * 0.85) * k }, { duration: 0 });
					};
					ticker?.add(tick);
					await waitForTimeout(carryMs);
					ticker?.remove(tick);
				} else {
					// rig not ready (frame-perfect race): the old direct mouth flight
					const mouth = mouthOffset(isMarty, place.size);
					await fly.set({ ...mouth, s: 0.55 });
				}
				chomp = true; // insect vanishes; the strike clip's chomp tail sells the swallow
				await waitForTimeout(TIMINGS.eat * 0.5);
				chomp = false;
			} else {
				await waitForTimeout(TIMINGS.eat);
			}
			eating = null;
			heroTray = null;
			heroBell = false;
			spotlight = false;
			busy[striker] = false;
		},
	});

	// hosts on stage ('visible' would shadow the Pixi visible prop passed below)
	const activeHosts = $derived.by(() => {
		if (!show) return [] as Striker[];
		if (host === 'both') return ['marty', 'marky'] as Striker[];
		return [host] as Striker[];
	});

	// retrigger tease: hosts lean in while a reel anticipates, back to idle when it resolves
	$effect(() => {
		const anticipating = context.stateGame.board.some((reel) => reel.reelState.anticipating);
		for (const name of activeHosts) {
			const rig = rigOf(name);
			if (!rig || busy[name]) continue;
			if (anticipating && isIdling(rig)) playClip(rig, RIG.anticipation, { loop: true });
			else if (!anticipating && currentClip(rig) === RIG.anticipation) playIdle(rig);
		}
	});
</script>

<!-- NOTE: the WHOLE layer stays ALWAYS-mounted (visible-toggled, DoorSteel precedent) — a
     lazily-mounted node joins the stage as the LAST child, so a `{#if show}` around this put the
     rigs ABOVE ComboWin and the presentation stack on every bonus, and the spotlight dim above
     the rigs it must sit UNDER. Mounted at game start, Game.svelte template order holds: dim
     below the mantises, mantises below the floaters/presentations, above board/frame/plaque.
     The rigs stay lazy — BoneRig mounts only while hosts are on stage (activeHosts), and inner
     mount order is local to this container, so it cannot leak into stage stacking. -->
<CanvasSizeRectangle
	backgroundColor={0x000000}
	backgroundAlpha={spot.current}
	visible={show && spot.current > 0}
/>
<MainContainer visible={show}>
	{@const place = mantisPlace()}
	{#each activeHosts as name (name)}
		{@const isMarty = name === 'marty'}
		{@const me = isMarty ? place.marty : place.marky}
		<Container x={me.x + walkOff[name].current} y={me.y}>
			{#if isMarty}
				<BoneRig bind:rig={martyRig} size={place.size} />
			{:else}
				<BoneRig bind:rig={markyRig} size={place.size} mirror skin="Marky" />
			{/if}
			{#if eating?.striker === name}
				{#if eating.symbol}
					{#if !chomp}
						<Sprite anchor={0.5} x={fly.current.x} y={fly.current.y} width={90 * fly.current.s} height={90 * fly.current.s} key="{eating.symbol}_insect.png" />
					{/if}
				{:else}
					<GameText y={-140} text="..."  preset="silver" size={36} />
				{/if}
			{/if}
		</Container>
	{/each}
	{#if heroBell}
		{@const layout = context.stateGameDerived.boardLayout()}
		<!-- opening-bite hero bell: drops to the board centre, rings (press frames), fades under the tray -->
		{@const glow = bellGlowPose(glowT, glowDing)}
		{@const bellW = SYMBOL_SIZE * CELL_FILL}
		<Container x={layout.x} y={layout.y + bellDrop.current} alpha={bellFade.current} scale={TRAY_HERO}>
			<!-- glow (bellGlow.ts): halo breathing under a slowly turning ray wheel, plus the ding
			     ripple; all additive, tinted white textures -->
			<BaseSprite texture={bellRaysTexture()} anchor={0.5} width={bellW * BELL_GLOW.size} height={bellW * BELL_GLOW.size} rotation={glow.raysRotation} tint={BELL_GLOW.color} alpha={glow.raysAlpha} blendMode="add" />
			<BaseSprite texture={bellHaloTexture()} anchor={0.5} width={bellW * BELL_GLOW.size * BELL_GLOW.haloScale} height={bellW * BELL_GLOW.size * BELL_GLOW.haloScale} tint={BELL_GLOW.color} alpha={glow.haloAlpha} blendMode="add" />
			{#if glow.ring}
				<BaseSprite texture={bellRingTexture()} anchor={0.5} width={bellW * glow.ring.size} height={bellW * glow.ring.size} tint={BELL_GLOW.color} alpha={glow.ring.alpha} blendMode="add" />
			{/if}
			<Circle x={0} y={SYMBOL_SIZE * CELL_FILL * 0.42} diameter={SYMBOL_SIZE * CELL_FILL} backgroundColor={0x000000} backgroundAlpha={0.35} anchor={0.5} scale={{ x: 1, y: 0.32 }} />
			{@const pose = bellPose(bellRing ?? 0, TIMINGS.ring)}
			<Sprite anchor={{ x: 0.5, y: 1 }} y={(SYMBOL_SIZE * CELL_FILL) / 2} width={SYMBOL_SIZE * CELL_FILL * pose.scaleX} height={SYMBOL_SIZE * CELL_FILL * pose.scaleY} rotation={pose.rotation} key={pose.key} />
		</Container>
	{/if}
	{#if heroTray}
		{@const layout = context.stateGameDerived.boardLayout()}
		<!-- the course: plate + insect drop to the board centre; the insect hides once the eat
		     flight takes over (which starts at this exact spot and size), the plate fades after it -->
		<Container x={layout.x} y={layout.y + trayDrop.current} alpha={trayFade.current} scale={TRAY_HERO}>
			<!-- grounding shadow (flattened circle, not a filter) separates the plate from the dim -->
			<Circle x={0} y={SYMBOL_SIZE * CELL_FILL * 0.42} diameter={SYMBOL_SIZE * CELL_FILL} backgroundColor={0x000000} backgroundAlpha={0.35} anchor={0.5} scale={{ x: 1, y: 0.32 }} />
			<Sprite anchor={0.5} width={SYMBOL_SIZE * CELL_FILL} height={SYMBOL_SIZE * CELL_FILL} key="{heroTray}_eaten.png" />
			{#if !eating}
				<Sprite anchor={0.5} width={SYMBOL_SIZE * CELL_FILL} height={SYMBOL_SIZE * CELL_FILL} key="{heroTray}_insect.png" />
			{/if}
		</Container>
	{/if}
</MainContainer>
