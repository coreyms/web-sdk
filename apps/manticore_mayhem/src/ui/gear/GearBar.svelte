<script lang="ts" module>
	import { hubArrowSvg, playGearArt, spinWordSvg, GEAR_PAD } from './gearArt';
	import { DESKTOP, DESKTOP_GEARS } from './gearLayout';
	// the Play gear's drawing: the table's own px (it scales to its box), made once
	const PG = DESKTOP_GEARS.play;
	const PLAY_ART = playGearArt(PG.R, PG.teeth, PG.R * DESKTOP.play.hub);
	const ARROW = hubArrowSvg();
	const SPIN_WORD = spinWordSvg();
</script>

<script lang="ts">
	// THE GEAR BAR (2026-11-22; the approved mock Desktop "Manticore Mayhem/desktop_r6_2026-11-22", every other desktop
	// window by desktop_r7_sizes_2026-11-22): Play as a gear beside the frame's top right wheel with Auto and Turbo
	// meshed on it, the amount with its bare < and > at the bottom right, Balance at the bottom left, Win on the center
	// line, Menu and the Armoury as war standards hung under the logo. Corey: "these gears look awesome", "The spin
	// button is good in all states", "Let's go with it".
	//
	// A RE-SKIN. Every control is the dock's own, over the same state and the same handlers (ui/controls.svelte.ts):
	// the Play is ui/hud/HudSpin.svelte itself (its faces, its ring driver, its counts) drawn inside the gear; the
	// readouts are HudReadout, the steppers HudStep, the help menu HudMenuPanel; Auto, Turbo and the standards are new
	// faces on HudKey's and HudArmoury's rules. Places: ui/gear/gearLayout.ts, never a number here.
	//
	// THE PLANES are the dock's two (base, and lit above THE ARMOURY's tint: Balance and the amount with < and >), but
	// drawn at the window's own CSS px: the plane undoes the chrome's fit, so the gears are rasterized once at their true
	// size. The pieces borrowed from the dock are drawn in the dock's mock px inside a scaled box each.
	//
	// THE GEARS TURN WITH THE FRAME'S WHEELS (Corey: "we'll need to make sure those gears spin whenever the board gear
	// spins (like on refilling symbols or nudges)"): components/BoardFrame.svelte reports the haul's travel each tick it
	// moves (game/frameGears.ts) and the five layers marked data-turn are turned here in that same tick: a CSS rotate on
	// a layer of its own, nothing laid out, nothing painted, no SVG touched. Two teeth a link, the Play gear against the
	// frame's wheel and the small gears against the Play gear (gearLayout playAngle, smallAngle). A press hauls the
	// chain, so a Spin press turns them as in the mock; so does every free spin, War Standard nudge and run.
	//
	// THE RING (Corey: "a light ring around the button with different colors for win, Bonus, Super, Epic ... match that
	// up with the smaller gears on both sides of the board"): the hub's ring takes the feature's color while its free
	// spins play and its halo pulses as a win lands; game/frameGears.ts gearRing carries the same to the frame's wheels.
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
	import GearStandard from './GearStandard.svelte';
	import { fold, playAngle, smallAngle, type GearBarLayout } from './gearLayout';
	import { hubNow } from './hubNow';
	import './gear.css';

	type Props = { controls: Controls; hud: HudFrame; layout: GearBarLayout };
	const { controls, hud, layout: L }: Props = $props();
	const context = getContext();
	const hs = createHudState(controls);
	const replay = $derived(controls.isReplay());
	const rh = $derived(hs.replay());
	const ante = $derived(hs.anteLevel());
	const lit = $derived(hs.winLit());
	const B = $derived(L.box);

	// ---- THE RING: what the hub's ring shows, for the frame's wheels too ----
	const feature = $derived(controls.freeSpin() !== null && (!replay || replayState.phase === 'playing'));
	const ringKind = $derived<RingKind | null>(feature ? (context.stateGame.bonusMode ?? 'bonus') : null);
	const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
	// the plane: the window itself, in CSS px (the chrome's fit undone); the hub ring's color where a feature sets it
	const plane = $derived(`width:${L.vw}px;height:${L.vh}px;transform:translate(${-hud.fit.fitLeft / hud.fit.scale}px, ${-hud.fit.top / hud.fit.scale}px) scale(${1 / hud.fit.scale});--hit:44px;--g-count:${L.text.count}px;--g-sub:${L.text.sub}px${ringKind ? `;--ring:${hex(RING_COLOR[ringKind])}` : ''}`);
	// the dock's readouts in their mock px (the mock's base boxes and type sizes), each scaled to its box
	const RO = { bal: { w: 186, h: 40, n: 21 }, amt: { w: 124, h: 40, n: 21 }, win: { w: 190, h: 42, n: 24 } } as const;
	const box = (id: 'bal' | 'amt' | 'win') => `left:${B[id].x}px;top:${B[id].y}px;width:${RO[id].w}px;height:${RO[id].h}px;transform:scale(${B[id].w / RO[id].w})`;
	const amtLabel = $derived(rh ? rh.label : hs.amtLabel());
	const amtValue = $derived(rh ? rh.total : controls.betText());
	// THE HELP MENU: under the standards, over the scenery left of the board (the dock's own panel, at the dock's scale;
	// its narrow form where the column is too narrow for the wide one)
	const panel = $derived.by(() => {
		const wide = L.scene.artLeft - 16 >= 272 * L.u;
		const P = wide ? { w: 272, h: 176, nar: false } : { w: 178, h: 158, nar: true };
		const x = Math.max(8, Math.min(B.menu.x, L.scene.artLeft - 8 - P.w * L.u));
		return { ...P, x, y: B.menu.y + B.menu.h + 8 * L.h };
	});
	const chain = $derived(Math.max(0, B.menu.y - L.chainTop));

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

	// ---- THE TURN: the five layers, from the haul's travel ----
	type Turn = { el: HTMLElement; gear: 'play' | 'auto' | 'turbo'; period: number };
	let host: HTMLDivElement | undefined = $state();
	let turns: Turn[] = [];
	let reduced = false;
	const angles = { links: 0, play: 0, auto: 0, turbo: 0 };
	const NS = DESKTOP_GEARS.auto.teeth;
	const apply = (links: number) => {
		const a = reduced ? 0 : playAngle(links, PG.teeth);
		angles.links = links;
		angles.play = a;
		angles.auto = smallAngle(a, DESKTOP.small.autoDeg, PG.teeth, NS);
		angles.turbo = smallAngle(a, DESKTOP.small.turboDeg, PG.teeth, NS);
		for (let i = 0; i < turns.length; i += 1) {
			const t = turns[i];
			t.el.style.transform = `rotate(${fold(angles[t.gear], t.period).toFixed(3)}deg)`;
		}
	};
	// the layers are found again whenever a gear comes or goes (a replay, an operator's switches)
	$effect(() => {
		void replay;
		void controls.jurisdiction();
		if (!host) return;
		const P = PLAY_ART.periods;
		const period: Record<string, number> = { 'play:teeth': P.teeth, 'play:spokes': P.spokes, 'play:bolts': P.bolts, auto: 360 / NS, turbo: 360 / NS };
		turns = [...host.querySelectorAll<HTMLElement>('[data-turn]')].map((el) => {
			const k = el.dataset.turn as string;
			return { el, gear: k.split(':')[0] as Turn['gear'], period: period[k] };
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

	// DEV: the bar as the rule placed it, the gears' angles now and the ring (the main repo's tools/manticore/hud_probe.js
	// section `gear`). Not in a production build.
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		const hook = ((window as unknown as { __manticore?: Record<string, unknown> }).__manticore ??= {});
		hook.gearBar = () => {
			const r = ringAt(performance.now());
			return {
				table: L.table,
				window: [L.vw, L.vh],
				scale: { ...L.scale },
				hud: L.h,
				/** every piece's box, and its press box (the same box; the gears': the square round their tips), CSS px */
				box: Object.fromEntries(Object.entries(L.box).map(([k, v]) => [k, { ...v }])),
				press: Object.fromEntries(Object.entries(L.box).map(([k, v]) => [k, { ...v }])),
				gears: { play: { ...L.gears.play }, auto: { ...L.gears.auto }, turbo: { ...L.gears.turbo }, hubR: L.hubR },
				wheel: { ...L.scene.wheel },
				mesh: { ...L.mesh },
				text: { ...L.text },
				/** the haul's travel in links and each gear's true angle (degrees clockwise); `drawn`: the transform on each
				 *  turning layer now */
				angles: { ...angles, reduced },
				drawn: turns.map((t) => ({ layer: t.el.dataset.turn, period: t.period, transform: t.el.style.transform })),
				/** the hub ring's state: its kind (null: brass), its color, and the strength the frame's wheels draw it at */
				ring: { kind: ringKind, pulse: r.kind, color: r.level > 0 ? hex(r.rgb) : null, level: r.level, frame: [...FRAME_RINGS] },
				/** the hub's ring as drawn now: its colored ring, halo and pale flash (opacities), the ring's color */
				hub: hubNow(host),
			};
		};
	}
</script>

<!-- the base plane: the standards, WIN, the gears and the help menu (under THE ARMOURY's tint) -->
<div bind:this={host} class="hudp hud-group v-desktop v-gear" data-plane="base" data-bar="gear" style={plane}>
	<GearStandard kind="menu" {controls} box={B.menu} {chain} />
	{#if !replay && !controls.jurisdiction().disabledBuyFeature}<GearStandard kind="arm" {controls} box={B.arm} {chain} />{/if}
	<div class="gsc keep" data-piece="win" style={box('win')}>
		<HudReadout label="WIN" pre={hs.winPre()} value={controls.winText()} odo={controls.winOdoText()} x={0} y={0} w={RO.win.w} h={RO.win.h} nominal={RO.win.n} cls="win {hs.winPre() ? 'fsw' : ''} {lit ? 'is-lit' : ''} {hs.winBig() ? 'is-big' : ''}" hud="win" keep />
	</div>
	<HudSpin {controls} x={B.play.x} y={B.play.y} d={B.play.w} hubD={2 * L.hubR} ringArt={ARROW} onwin={win}>
		{#snippet art()}
			<span class="ga" class:gp-a={pulseN % 2 === 1} class:gp-b={pulseN > 0 && pulseN % 2 === 0} style:--pad="{(GEAR_PAD * B.play.w) / (2 * PG.R)}px" style:--nudge="{0.25 * PLAY_ART.periods.teeth}deg">
				<span class="glayer glow">{@html PLAY_ART.glow}</span>
				<span class="gn">
					<span class="glayer turn" data-turn="play:teeth">{@html PLAY_ART.teeth}</span>
					<span class="glayer turn" data-turn="play:spokes">{@html PLAY_ART.spokes}</span>
				</span>
				<span class="glayer">{@html PLAY_ART.hub}</span>
				<span class="gn"><span class="glayer turn" data-turn="play:bolts">{@html PLAY_ART.bolts}</span></span>
				<span class="glayer flash">{@html PLAY_ART.flash}</span>
			</span>
			<span class="gw">{@html SPIN_WORD}</span>
		{/snippet}
	</HudSpin>
	{#if !replay && !controls.jurisdiction().disabledAutoplay}<GearKey kind="auto" {controls} box={B.auto} />{/if}
	{#if !controls.jurisdiction().disabledTurbo}<GearKey kind="turbo" {controls} box={B.turbo} />{/if}
	<div class="gsc gmp" class:is-open={stateUi.menuOpen} style="left:{panel.x}px;top:{panel.y}px;width:{panel.w}px;height:{panel.h}px;transform:scale({L.u})">
		<HudMenuPanel {controls} x={0} y={0} W={panel.w} H={panel.h} tip={24} up T={0} cls={panel.nar ? 'nar' : ''} />
	</div>
</div>

<!-- what THE ARMOURY keeps lit above its tint: BALANCE and the amount with its < and > (ui/Chrome.svelte) -->
<div class="hudp hud-group v-desktop v-gear" data-plane="lit" style={plane}>
	<div class="trio dc">
		<div class="cell left dc">
			{#if !replay}
				<div class="gsc" data-piece="bal" style={box('bal')}><HudReadout label="BALANCE" value={controls.balanceText()} x={0} y={0} w={RO.bal.w} h={RO.bal.h} nominal={RO.bal.n} cls="bal" hud="balance" lit /></div>
			{:else if rh && !rh.isBase}
				<div class="gsc" data-piece="bal" style={box('bal')}><HudReadout label="BASE AMOUNT" value={rh.base} x={0} y={0} w={RO.bal.w} h={RO.bal.h} nominal={RO.bal.n} cls="bal" hud="balance" lit /></div>
			{/if}
		</div>
		<div class="cell right dc">
			{#if !replay}<HudStep dir={-1} {controls} x={B.down.x} y={B.down.y} d={B.down.w} chev />{/if}
			{#if !replay || rh}
				<div class="gsc" data-piece="amt" style={box('amt')}>
					<HudReadout
						label={amtLabel}
						value={amtValue}
						x={0}
						y={0}
						w={RO.amt.w}
						h={RO.amt.h}
						nominal={RO.amt.n}
						cls="amt {!replay && hs.modeOn() ? 'ante' : ''} {ante === 2 ? 'sante' : ''} {!replay && controls.betDisabled() ? 'is-locked' : ''}"
						onclick={replay ? undefined : controls.openDenom}
						disabled={replay || controls.betDisabled()}
						hud="amount"
						lit
					/>
				</div>
			{/if}
			{#if !replay}<HudStep dir={1} {controls} x={B.up.x} y={B.up.y} d={B.up.w} chev />{/if}
		</div>
	</div>
</div>
