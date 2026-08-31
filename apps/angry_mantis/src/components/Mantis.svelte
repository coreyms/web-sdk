<script lang="ts" module>
	import type { Striker, BonusHost, PayingSymbolName, Position } from '../game/types';
	import type { RigReaction } from '../game/constants';

	export type EmitterEventMantis =
		| { type: 'mantisShow'; host: BonusHost }
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
	import { Sprite, Container, Circle } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { nextSymbolToEat } from '../game/stateGame.svelte';
	import GameText from './GameText.svelte';
	import { TIMINGS, SYMBOL_SIZE, CELL_FILL, RIG } from '../game/constants';
	import { getSymbolX, getSymbolY } from '../game/utils';
	import { MARTY, MASTER, layoutKind } from '../game/layoutSpec';
	import type { Rig } from '../bonerutter';
	import { rigPointInHost, playClip, playIdle, currentClip, isIdling } from '../game/mantisRig';
	import BoneRig from './BoneRig.svelte';

	const context = getContext();

	// Bonus mantises match the base-game Marty exactly (Corey 2026-08-26): marty stands in the SAME
	// spot/size as the base-game Marty; marky mirrors him across the master centre.
	const mantisPlace = () => {
		const kind = layoutKind(context.stateLayoutDerived.layoutType());
		const m = MARTY[kind];
		return { marty: { x: m.x, y: m.y }, marky: { x: MASTER[kind].width - m.x, y: m.y }, size: m.size };
	};

	let show = $state(false);
	let host = $state<BonusHost>('marty');
	let eating = $state<{ striker: Striker; symbol: PayingSymbolName | null } | null>(null);
	let chomp = $state(false);
	let martyRig = $state<Rig | null>(null);
	let markyRig = $state<Rig | null>(null);
	// eaten symbol: flies from the leaf cell to the striker's mouth (offsets are relative to the mantis)
	const fly = new Tween({ x: 0, y: 0, s: 1 }, { duration: Math.round(TIMINGS.eat * 0.6), easing: cubicIn });
	// fallback mouth position (fractions of the placeholder body) for the frame-perfect-race case
	// where a strike lands before the rig finishes loading
	const mouthOffset = (isMarty: boolean, size: number) => ({ x: isMarty ? -size * 0.15 : size * 0.22, y: isMarty ? -size * 0.3 : -size * 0.23 });
	// opening auto-bites have no board leaf, so a dinner leaf drops to the board centre carrying the
	// meal; the strike launches from it and the leaf fades away once the insect is taken
	let autoLeaf = $state<PayingSymbolName | null>(null);
	const leafDrop = new Tween(0, { duration: Math.round(TIMINGS.strike * 0.6), easing: cubicIn });
	const leafFade = new Tween(1, { duration: Math.round(TIMINGS.eat * 0.6), easing: cubicOut });
	// bonus-intro spotlight: everything but the mantises + dinner leaf dims during the opening
	// auto-bites, so the plate ceremony reads as "this is what the bonus does" (player feedback:
	// the leaf got lost against the background). HTML UI sits above the canvas, untouched.
	const LEAF_HERO = 1.5; // the intro dinner leaf is oversized for the same reason
	let spotlight = $state(false);
	const spot = new Tween(0, { duration: 350 });
	$effect(() => {
		spot.set(spotlight ? 0.55 : 0);
	});

	const rigOf = (striker: Striker) => (striker === 'marty' ? martyRig : markyRig);

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
				playClip(rig, RIG.walk.forward, { loop: true });
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
		const pool = RIG.reactions[kind];
		const targets = (host === 'both' ? (['marty', 'marky'] as Striker[]) : [host]).filter(
			(name) => !busy[name] && rigOf(name),
		);
		if (targets.length === 0) return;
		const first = Math.floor(Math.random() * pool.length);
		targets.forEach((name, i) => {
			const clip = pool[(first + i) % pool.length]; // distinct clips when both react
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
		mantisHide: async () => {
			const walkers = visible.filter((name) => name === 'marky' && rigOf(name));
			if (walkers.length === 0) {
				show = false;
				return;
			}
			await Promise.all(
				walkers.map(async (name, i) => {
					await walkDone[name];
					const rig = rigOf(name);
					if (!rig) return;
					busy[name] = true;
					if (i) await waitForTimeout(180);
					playClip(rig, RIG.walk.backward, { loop: true });
					await walkOff[name].set(offscreenDist(name), { duration: WALK_MS });
					busy[name] = false;
				}),
			);
			show = false;
			(['marty', 'marky'] as Striker[]).forEach((n) => walkOff[n].set(0, { duration: 0 }));
		},
		mantisReact: ({ kind }) => react(kind),
		mantisStrike: async ({ striker, position }) => {
			show = true;
			await walkDone[striker]; // never strike mid-entrance
			busy[striker] = true;
			if (!position) {
				spotlight = true;
				// auto bite: bring the meal in on a dinner leaf before the lunge, same read as a board leaf
				const symbol = nextSymbolToEat();
				if (symbol) {
					const layout = context.stateGameDerived.boardLayout();
					autoLeaf = symbol;
					leafFade.set(1, { duration: 0 });
					leafDrop.set(-(layout.height * layout.scale) / 2 - 140, { duration: 0 });
					await leafDrop.set(0);
				}
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
			await waitForTimeout(TIMINGS.strike);
		},
		mantisEat: async ({ striker, symbol, from }) => {
			const place = mantisPlace();
			const layout = context.stateGameDerived.boardLayout();
			const isMarty = striker === 'marty';
			const me = isMarty ? place.marty : place.marky;
			eating = { striker, symbol };
			if (symbol) {
				// start at the dinner leaf's cell (board-local -> master via the board transform);
				// opening bites launch from the board centre, where their own leaf just dropped in
				const start = from
					? {
							x: layout.x + (getSymbolX(from.reel) - layout.width / 2) * layout.scale,
							y: layout.y + (getSymbolY(from.row) - layout.height / 2) * layout.scale,
						}
					: { x: layout.x, y: layout.y };
				const startRel = { x: start.x - me.x, y: start.y - me.y };
				const pickup = ((SYMBOL_SIZE * CELL_FILL) / 90) * (autoLeaf ? LEAF_HERO : 1);
				const rig = rigOf(striker);
				fly.set({ ...startRel, s: pickup }, { duration: 0 });
				if (autoLeaf) leafFade.set(0); // the leaf empties as the insect lifts off

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
			autoLeaf = null;
			spotlight = false;
			busy[striker] = false;
		},
	});

	const visible = $derived.by(() => {
		if (!show) return [] as Striker[];
		if (host === 'both') return ['marty', 'marky'] as Striker[];
		return [host] as Striker[];
	});

	// retrigger tease: hosts lean in while a reel anticipates, back to idle when it resolves
	$effect(() => {
		const anticipating = context.stateGame.board.some((reel) => reel.reelState.anticipating);
		for (const name of visible) {
			const rig = rigOf(name);
			if (!rig || busy[name]) continue;
			if (anticipating && isIdling(rig)) playClip(rig, RIG.anticipation, { loop: true });
			else if (!anticipating && currentClip(rig) === RIG.anticipation) playIdle(rig);
		}
	});
</script>

{#if show}
	<!-- NOTE: the spotlight dim stays MOUNTED (alpha/visible-toggled, DoorSteel precedent) — a
	     lazily-mounted node joins the stage as the LAST child, i.e. ABOVE the MainContainer below
	     and therefore above the rigs/leaf/eat flight it must sit UNDER. Mounted together with the
	     MainContainer, template order holds: dim below the mantises, above everything mounted at
	     game start (board, frame, background). -->
	<CanvasSizeRectangle
		backgroundColor={0x000000}
		backgroundAlpha={spot.current}
		visible={spot.current > 0}
	/>
	<MainContainer>
		{@const place = mantisPlace()}
		{#each visible as name (name)}
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
		{#if autoLeaf}
			{@const layout = context.stateGameDerived.boardLayout()}
			<!-- auto-bite dinner leaf: drops to the board centre with the insect riding it; the insect
			     hides once the eat flight takes over (which starts at this exact spot and size) -->
			<Container x={layout.x} y={layout.y + leafDrop.current} alpha={leafFade.current} scale={LEAF_HERO}>
				<!-- grounding shadow (flattened circle, not a filter) separates the plate from the dim -->
				<Circle x={0} y={SYMBOL_SIZE * CELL_FILL * 0.42} diameter={SYMBOL_SIZE * CELL_FILL} backgroundColor={0x000000} backgroundAlpha={0.35} anchor={0.5} scale={{ x: 1, y: 0.32 }} />
				<Sprite anchor={0.5} width={SYMBOL_SIZE * CELL_FILL} height={SYMBOL_SIZE * CELL_FILL} key="GL.png" />
				{#if !eating}
					<Sprite anchor={0.5} width={SYMBOL_SIZE * CELL_FILL} height={SYMBOL_SIZE * CELL_FILL} key="{autoLeaf}_insect.png" />
				{/if}
			</Container>
		{/if}
	</MainContainer>
{/if}
