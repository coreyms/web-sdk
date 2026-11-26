<script lang="ts" module>
	import { hubArrowSvg } from './gearArt';
	const ARROW = hubArrowSvg();
</script>

<script lang="ts">
	// THE GEAR BAR ON AN UPRIGHT PHONE (2026-11-22; Corey's export corey_phone_upright_r3_2026-11-22.json, set on an iPhone
	// 17 Pro; mock Desktop "Manticore Mayhem/phone_upright_r3_2026-11-22"): a meshed gear train along the bottom, under
	// the spin amount plaque. The Play gear on the center line, Turbo meshed on its right, and a chain on its left, each
	// gear meshed only with the next: Auto, Menu, the Armoury. Icons only on the small gears; the Armoury carries the
	// game's PolyMath mark. Win, the amount with its gold < and >, and Balance stand round the train where the rule puts
	// them (ui/gear/gearLayout.ts uprightLayout: the places, the rule between windows and every move from his places),
	// always in the band under the plaque. The scene over the train (the board, the Manticore, the logo) is the rule's
	// too since 2026-11-23: ui/gear/uprightScene.ts moves it up, and draws it smaller with the train on a short window.
	//
	// A RE-SKIN, as on desktop (ui/gear/GearBar.svelte): the Play is ui/hud/HudSpin.svelte itself inside the gear, the
	// readouts HudReadout, the arrows HudStep, the help menu HudMenuPanel; the four small gears are ui/gear/GearKey.svelte
	// over the dock keys' own rules. The planes are the dock's two (base, and lit above THE ARMOURY's tint), drawn at the
	// window's own CSS px. The readouts are real text: a 9 px word over a 15 px number, fitted, never abbreviated.
	//
	// THE WHOLE TRAIN TURNS TOGETHER from the board's haul (game/frameGears.ts, called in BoardFrame's own tick): the
	// Play gear two teeth a link against the frame's wheel, every other gear from the gear it meshes with, the other way,
	// at the ratio of their teeth. A CSS rotate on each turning layer; nothing laid out or painted.
	import { onMount, untrack } from 'svelte';
	import { stateUi } from 'state-shared';
	import { getContext } from '../../game/context';
	import { FRAME_RINGS, frameGears, gearRing, onFrameGears, ringAt, RING_COLOR, type RingKind } from '../../game/frameGears';
	import type { Controls } from '../controls.svelte';
	import { replayState } from '../replayState.svelte';
	import type { HudFrame } from '../hud/hudLayout';
	import { createHudState } from '../hud/hudState';
	import HudSpin from '../hud/HudSpin.svelte';
	import HudStep from '../hud/HudStep.svelte';
	import HudReadout from '../hud/HudReadout.svelte';
	import HudMenuPanel from '../hud/HudMenuPanel.svelte';
	import GearKey from './GearKey.svelte';
	import { GEAR_PAD, playGearArt, spinWordSvg } from './gearArt';
	import { fold, playAngle, smallAngle, type MidRowLayout, type TrainGear, type UprightLayout } from './gearLayout';
	import { hubNow } from './hubNow';
	import './gear.css';

	// (THE MIDDLE WINDOWS' ROW, ui/gear/gearLayout.ts midRowLayout: the same train under the desktop board of a window
	// under ratio 1.12, drawn by this same component from ui/ChromeLandscape.svelte; its train is this one mirrored, Turbo
	// on the Play's left and the chain on its right, Corey's "LP1" of 2026-11-26: every gear turns from the gear it
	// meshes with by its own angle, so nothing here depends on the side)
	type Props = { controls: Controls; hud: HudFrame; layout: UprightLayout | MidRowLayout };
	const { controls, hud, layout: L }: Props = $props();
	const context = getContext();
	const hs = createHudState(controls);
	const replay = $derived(controls.isReplay());
	const rh = $derived(hs.replay());
	const ante = $derived(hs.anteLevel());
	const lit = $derived(hs.winLit());
	const B = $derived(L.box);
	const P = $derived(L.gears.play);
	// the drawings, in this window's own px: made again only when the Play gear's size or teeth change
	const playArt = $derived(playGearArt(P.R, P.teeth, L.hubR, L.tooth.height));
	const spinWord = $derived(spinWordSvg(L.text.spin, L.text.spinInk, L.hubR));
	const geo = (id: Exclude<TrainGear, 'play'>) => ({ R: L.gears[id].R, teeth: L.gears[id].teeth, dep: L.tooth.height, word: 0 });

	// ---- THE RING: what the hub's ring shows, for the frame's wheels too ----
	const feature = $derived(controls.freeSpin() !== null && (!replay || replayState.phase === 'playing'));
	const ringKind = $derived<RingKind | null>(feature ? (context.stateGame.bonusMode ?? 'bonus') : null);
	const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
	$effect(() => {
		const k = ringKind;
		untrack(() => (gearRing.kind = k));
		return () => (gearRing.kind = null);
	});
	// THE WIN PULSE: one call lights the frame's wheels' rings (gearRing) and the hub's own ring, halo and pale flash
	// (a class on the gear's drawing, set here in the same turn: gear.css gp-a / gp-b, two names so each win starts the
	// 0.7 s again). Until 2026-11-22 the hub's pulse hung on HudSpin's own win class, which HudSpin sets a frame later.
	let pulseN = $state(0);
	const win = () => {
		gearRing.pulseKind = 'win';
		gearRing.pulseAt = performance.now();
		pulseN += 1;
	};

	const plane = $derived(`width:${L.vw}px;height:${L.vh}px;transform:translate(${-hud.fit.fitLeft / hud.fit.scale}px, ${-hud.fit.top / hud.fit.scale}px) scale(${1 / hud.fit.scale});--hit:44px;--g-count:${L.text.count}px;--g-sub:${L.text.sub}px${ringKind ? `;--ring:${hex(RING_COLOR[ringKind])}` : ''}`);
	const at = (id: 'win' | 'bal' | 'amt') => `left:${B[id].x}px;top:${B[id].y}px;width:${B[id].w}px;height:${B[id].h}px`;
	const amtLabel = $derived(rh ? rh.label : hs.amtLabel());
	const amtValue = $derived(rh ? rh.total : controls.betText());
	// THE HELP MENU: the dock's own panel at the dock's scale, standing just over the train
	const panel = $derived.by(() => {
		const w = Math.min(300, (L.vw - 16) / hud.u);
		return { w, h: 176, x: Math.max(8, Math.min(B.menu.x, L.vw - 8 - w * hud.u)), y: L.band.top - 8 - 176 * hud.u };
	});

	// ---- THE TURN: every turning layer, from the haul's travel, each gear from the gear it meshes with ----
	const ORDER: TrainGear[] = ['play', 'turbo', 'auto', 'menu', 'arm'];
	type Turn = { el: HTMLElement; gear: TrainGear; period: number };
	let host: HTMLDivElement | undefined = $state();
	let turns: Turn[] = [];
	let reduced = false;
	const angles: Record<TrainGear, number> & { links: number } = { links: 0, play: 0, turbo: 0, auto: 0, menu: 0, arm: 0 };
	const slot: Record<TrainGear, number> = { play: 0, turbo: 0, auto: 0, menu: 0, arm: 0 };
	const apply = (links: number) => {
		const G = L.gears;
		angles.links = links;
		// THE FULL TRAIN's angles first (every slot, drawn or not: ui/gear/gearLayout.ts seatBar), then each drawn key
		// turns as the slot it sits in: with Auto gone Menu stands in Auto's slot and turns as Auto did, meshed with the
		// Play gear. A key that changes slot takes the new slot's phase at once (no slip, nothing to animate).
		const F = L.train as Record<TrainGear, (typeof G)[TrainGear]>;
		slot.play = reduced ? 0 : playAngle(links, F.play.teeth);
		for (let i = 1; i < ORDER.length; i += 1) {
			const g = F[ORDER[i]];
			slot[ORDER[i]] = smallAngle(slot[g.parent as TrainGear], g.deg, F[g.parent as TrainGear].teeth, g.teeth);
		}
		angles.play = slot.play;
		for (let i = 1; i < ORDER.length; i += 1) angles[ORDER[i]] = slot[L.seat.as[ORDER[i]] ?? ORDER[i]];
		for (let i = 0; i < turns.length; i += 1) {
			const t = turns[i];
			t.el.style.transform = `rotate(${fold(angles[t.gear], t.period).toFixed(3)}deg)`;
		}
	};
	// the layers are found again whenever a gear comes, goes or is drawn again
	$effect(() => {
		void replay;
		void controls.jurisdiction();
		const G = L.gears;
		const pa = playArt.periods;
		if (!host) return;
		turns = [...host.querySelectorAll<HTMLElement>('[data-turn]')].map((el) => {
			const k = el.dataset.turn as string;
			const gear = k.split(':')[0] as TrainGear;
			return { el, gear, period: gear === 'play' ? pa[k.split(':')[1] as keyof typeof pa] : 360 / G[gear].teeth };
		});
		untrack(() => apply(frameGears.links));
	});
	onMount(() => {
		const q = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
		reduced = !!q?.matches;
		const onQ = () => {
			reduced = !!q?.matches;
			apply(frameGears.links);
		};
		q?.addEventListener('change', onQ);
		const off = onFrameGears(apply);
		apply(frameGears.links);
		return () => {
			off();
			q?.removeEventListener('change', onQ);
		};
	});

	// DEV: the bar as the rule placed it, the gears' angles now and the ring (the main repo's tools/manticore/
	// gear_bar_probe.js). The same shape as the desktop bar's hook. Not in a production build.
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		const hook = ((window as unknown as { __manticore?: Record<string, unknown> }).__manticore ??= {});
		hook.gearBar = () => {
			const r = ringAt(performance.now());
			const copy = (o: Record<string, object>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...v }]));
			return {
				table: L.table,
				window: [L.vw, L.vh],
				scale: { gears: L.k },
				hud: L.k,
				safeBottom: L.safeBottom,
				band: { ...L.band },
				hudTop: L.hudTop,
				/** the scene under the train (ui/gear/uprightScene.ts): the common share u, the board against the shipped one, the
				 *  lift, where the frame art's top and the logo's bottom edge stand, the Manticore's share and his idle top (CSS px;
				 *  under 0: past the top edge), and the band the shipped scene would have left */
				scene: L.table === 'upright' ? { ...L.scene, creature: { ...L.scene.creature }, logo: { ...L.scene.logo } } : JSON.parse(JSON.stringify(L.scene)),
				kBand: L.kBand,
				/** every piece's drawn box and its press box (the arrows': 44 px round the drawn arrow), CSS px */
				box: copy(L.box),
				press: copy(L.press),
				gears: { ...copy(L.gears), hubR: L.hubR },
				tooth: { ...L.tooth },
				where: { ...L.where },
				/** the keys drawn and how they are seated in the full train (gearLayout.ts seatBar): each one's slot, what it
				 *  meshes with; `train`: the full train's gears */
				seat: { present: { ...L.seat.present }, as: { ...L.seat.as }, mesh: { ...L.seat.mesh }, hangers: [...L.seat.hangers] },
				train: copy(L.train),
				label: { win: { track: L.label.win.track, box: { ...L.label.win.box } }, bal: { track: L.label.bal.track, box: { ...L.label.bal.box } } },
				fitW: { ...L.fitW },
				gapSpin: L.gapSpin,
				text: { ...L.text },
				angles: { ...angles, reduced },
				drawn: turns.map((t) => ({ layer: t.el.dataset.turn, period: t.period, transform: t.el.style.transform })),
				ring: { kind: ringKind, pulse: r.kind, color: r.level > 0 ? hex(r.rgb) : null, level: r.level, frame: [...FRAME_RINGS] },
				hub: hubNow(host),
			};
		};
	}
</script>

<!-- the base plane: WIN, the gear train and the help menu (under THE ARMOURY's tint) -->
<div bind:this={host} class="hudp hud-group v-gear v-up" class:menu-open={stateUi.menuOpen} data-plane="base" data-bar="gear" style={plane}>
	<!-- THE ARMOURY reads the bar's top here (ui/armoury/Armoury.svelte measure): the band under the plaque -->
	<i class="gband" data-hud-band style:top="{L.hudTop}px"></i>
	<!-- (FREE SPINS WIN, the long label of a feature: tracked as tight as its row needs, ui/gear/gearLayout.ts label) -->
	<div class="gsc keep" data-piece="win" style="{at('win')};--lab-track:{L.label.win.track.toFixed(3)}em">
		<HudReadout label="WIN" pre={hs.winPre()} value={controls.winText()} odo={controls.winOdoText()} x={0} y={0} w={B.win.w} h={B.win.h} nominal={L.text.number} pad={B.win.w - L.fitW.win} cls="pt win {hs.winPre() ? 'lab-long' : ''} {lit ? 'is-lit' : ''} {hs.winBig() ? 'is-big' : ''}" hud="win" keep />
	</div>
	<HudSpin {controls} x={B.play.x} y={B.play.y} d={B.play.w} hubD={2 * L.hubR} ringArt={ARROW} onwin={win}>
		{#snippet art()}
			<span class="ga" class:gp-a={pulseN % 2 === 1} class:gp-b={pulseN > 0 && pulseN % 2 === 0} style:--pad="{GEAR_PAD}px" style:--nudge="{0.25 * playArt.periods.teeth}deg">
				<span class="glayer glow">{@html playArt.glow}</span>
				<span class="gn">
					<span class="glayer turn" data-turn="play:teeth">{@html playArt.teeth}</span>
					<span class="glayer turn" data-turn="play:spokes">{@html playArt.spokes}</span>
				</span>
				<span class="glayer">{@html playArt.hub}</span>
				<span class="gn"><span class="glayer turn" data-turn="play:bolts">{@html playArt.bolts}</span></span>
				<span class="glayer flash">{@html playArt.flash}</span>
			</span>
			<span class="gw">{@html spinWord}</span>
		{/snippet}
	</HudSpin>
	{#if !controls.jurisdiction().disabledTurbo}<GearKey kind="turbo" {controls} box={B.turbo} geo={geo('turbo')} />{/if}
	{#if !replay && !controls.jurisdiction().disabledAutoplay}<GearKey kind="auto" {controls} box={B.auto} geo={geo('auto')} />{/if}
	<GearKey kind="menu" {controls} box={B.menu} geo={geo('menu')} />
	{#if !replay && !controls.jurisdiction().disabledBuyFeature}<GearKey kind="arm" {controls} box={B.arm} geo={geo('arm')} />{/if}
	<div class="gsc gmp" style="left:{panel.x}px;top:{panel.y}px;width:{panel.w}px;height:{panel.h}px;transform:scale({hud.u})">
		<HudMenuPanel {controls} x={0} y={0} W={panel.w} H={panel.h} tip={24} />
	</div>
</div>

<!-- what THE ARMOURY keeps lit above its tint: BALANCE and the amount with its < and > (ui/Chrome.svelte) -->
<div class="hudp hud-group v-gear v-up stats" class:menu-open={stateUi.menuOpen} data-plane="lit" style={plane}>
	{#if !replay}
		<div class="gsc" data-piece="bal" style={at('bal')}><HudReadout label="BALANCE" value={controls.balanceText()} x={0} y={0} w={B.bal.w} h={B.bal.h} nominal={L.text.number} pad={B.bal.w - L.fitW.bal} cls="pt bal" hud="balance" lit /></div>
	{:else if rh && !rh.isBase}
		<div class="gsc" data-piece="bal" style="{at('bal')};--lab-track:{L.label.bal.track.toFixed(3)}em"><HudReadout label="BASE AMOUNT" value={rh.base} x={0} y={0} w={B.bal.w} h={B.bal.h} nominal={L.text.number} pad={B.bal.w - L.fitW.bal} cls="pt bal lab-long" hud="balance" lit /></div>
	{/if}
	{#if !replay || rh}
		<div class="gsc" data-piece="amt" style={at('amt')}>
			<HudReadout
				label={amtLabel}
				value={amtValue}
				x={0}
				y={0}
				w={B.amt.w}
				h={B.amt.h}
				nominal={L.text.number}
				pad={B.amt.w - L.fitW.amt}
				cls="pt amt {!replay && hs.modeOn() ? 'ante' : ''} {ante === 2 ? 'sante' : ''} {!replay && controls.betDisabled() ? 'is-locked' : ''}"
				onclick={replay ? undefined : controls.openDenom}
				disabled={replay || controls.betDisabled()}
				hud="amount"
				lit
			/>
		</div>
	{/if}
	{#if !replay}
		<HudStep dir={-1} {controls} x={B.down.x} y={B.down.y} d={B.down.w} chev />
		<HudStep dir={1} {controls} x={B.up.x} y={B.up.y} d={B.up.w} chev />
	{/if}
</div>
