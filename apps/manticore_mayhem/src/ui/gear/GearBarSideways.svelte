<script lang="ts" module>
	import { hubArrowSvg } from './gearArt';
	const ARROW = hubArrowSvg();
</script>

<script lang="ts">
	// THE GEAR BAR ON A PHONE HELD SIDEWAYS (2026-11-22; Corey's export corey_phone_sideways_r3_2026-11-22.json, his own
	// placing on an iPhone 17 Pro; mock Desktop "Manticore Mayhem/phone_sideways_r3_2026-11-22"): a chain from the board
	// frame's own top right wheel: Auto on the wheel, Turbo on Auto, the Play on Turbo at the right. Corey: "I'd still
	// like the gears to be connected to the board gears, even if it's through a chain of the other smaller buttons" and
	// "Play on the right, so it's not covering the tail". Menu and the Armoury are the war standards under the logo, Win
	// over Balance stands at the bottom left and the amount with its gold < and > at the bottom right
	// (ui/gear/gearLayout.ts sidewaysLayout: the places, the one rule for every sideways phone, the moves from his export).
	//
	// A RE-SKIN, as on desktop and upright: HudSpin inside the Play gear, HudReadout, HudStep, HudMenuPanel, GearKey and
	// GearStandard over the dock keys' own rules, in the dock's two planes at the window's own CSS px. Real text.
	//
	// THE CHAIN IS DRIVEN BY THE FRAME'S WHEEL: the wheel's own angle from the board's haul (game/frameGears.ts, in
	// BoardFrame's tick; gearLayout wheelAngle: its tooth at rest and 45 degrees a link), Auto from the wheel, Turbo from
	// Auto, the Play from Turbo, each the other way at the ratio of the teeth, phased so a tooth sits in a gap on every
	// line of centers. A CSS rotate on each turning layer; nothing laid out or painted.
	import { onMount, untrack } from 'svelte';
	import { stateUi } from 'state-shared';
	import { getContext } from '../../game/context';
	import { frameGears, gearRing, onFrameGears, ringAt, RING_COLOR, type RingKind } from '../../game/frameGears';
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
	import { GEAR_PAD, playGearArt, spinWordSvg } from './gearArt';
	import { fold, smallAngle, wheelAngle, type SidewaysLayout } from './gearLayout';
	import { hubNow } from './hubNow';
	import './gear.css';

	type Props = { controls: Controls; hud: HudFrame; layout: SidewaysLayout };
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
	const geo = (id: 'auto' | 'turbo') => ({ R: L.gears[id].R, teeth: L.gears[id].teeth, dep: L.tooth.height, word: L.text.word });
	const chain = $derived(Math.max(0, B.menu.y - L.chainTop));

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
	// THE HELP MENU: the dock's own sideways panel at the dock's scale, hanging under the standards
	const panel = $derived({ w: 138, h: 107, x: B.menu.x, y: B.menu.y + B.menu.h + 4 });

	// ---- THE TURN: the frame's wheel turns Auto, Auto turns Turbo, Turbo turns the Play ----
	type Gear = 'play' | 'auto' | 'turbo';
	type Turn = { el: HTMLElement; gear: Gear; period: number };
	let host: HTMLDivElement | undefined = $state();
	let turns: Turn[] = [];
	let reduced = false;
	const angles = { links: 0, wheel: 0, auto: 0, turbo: 0, play: 0 };
	const apply = (links: number) => {
		const G = L.gears;
		angles.links = links;
		angles.wheel = wheelAngle(reduced ? 0 : links);
		angles.auto = smallAngle(angles.wheel, G.auto.deg, L.wheel.teeth, G.auto.teeth);
		angles.turbo = smallAngle(angles.auto, G.turbo.deg, G.auto.teeth, G.turbo.teeth);
		angles.play = smallAngle(angles.turbo, G.play.deg, G.turbo.teeth, G.play.teeth);
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
			const gear = k.split(':')[0] as Gear;
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

	// DEV: the bar as the rule placed it, the gears' angles now (the frame wheel's too) and the ring (the main repo's
	// tools/manticore/gear_bar_probe.js). The same shape as the desktop bar's hook. Not in a production build.
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		const hook = ((window as unknown as { __manticore?: Record<string, unknown> }).__manticore ??= {});
		hook.gearBar = () => {
			const r = ringAt(performance.now());
			const copy = (o: Record<string, object>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...v }]));
			return {
				table: L.table,
				window: [L.vw, L.vh],
				scale: { gears: L.s, ...L.scale },
				hud: L.s,
				safe: { ...L.safe },
				/** the frame's top right wheel the chain starts on; the Play against his own size, how far it reaches under
				 *  the Manticore's top edge (CSS px), and how the amount and its arrows are laid out */
				wheel: { ...L.wheel },
				playScale: L.playScale,
				coverPx: L.coverPx,
				how: L.how,
				/** the clear px from the foot of Win's number down to Balance's box */
				winToBal: L.winToBal,
				/** every piece's drawn box and its press box (the arrows': 44 px round the drawn arrow), CSS px */
				box: copy(L.box),
				press: copy(L.press),
				gears: { ...copy(L.gears), hubR: L.hubR },
				tooth: { ...L.tooth },
				fitW: { ...L.fitW },
				text: { ...L.text },
				angles: { ...angles, reduced },
				drawn: turns.map((t) => ({ layer: t.el.dataset.turn, period: t.period, transform: t.el.style.transform })),
				ring: { kind: ringKind, pulse: r.kind, color: r.level > 0 ? hex(r.rgb) : null, level: r.level },
				hub: hubNow(host),
			};
		};
	}
</script>

<!-- the base plane: the standards, WIN, the chain and the help menu (under THE ARMOURY's tint) -->
<div bind:this={host} class="hudp hud-group v-gear v-up v-side" class:menu-open={stateUi.menuOpen} data-plane="base" data-bar="gear" style={plane}>
	<GearStandard kind="menu" {controls} box={B.menu} {chain} />
	{#if !replay && !controls.jurisdiction().disabledBuyFeature}<GearStandard kind="arm" {controls} box={B.arm} {chain} />{/if}
	<div class="gsc keep" data-piece="win" style={at('win')}>
		<HudReadout label="WIN" pre={hs.winPre()} value={controls.winText()} odo={controls.winOdoText()} x={0} y={0} w={B.win.w} h={B.win.h} nominal={L.text.win} pad={B.win.w - L.fitW.win} cls="pt win {lit ? 'is-lit' : ''} {hs.winBig() ? 'is-big' : ''}" hud="win" keep />
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
	<div class="gsc gmp" style="left:{panel.x}px;top:{panel.y}px;width:{panel.w}px;height:{panel.h}px;transform:scale({hud.u})">
		<HudMenuPanel {controls} x={0} y={0} W={panel.w} H={panel.h} tip={24} up T={0} cls="pls" />
	</div>
</div>

<!-- what THE ARMOURY keeps lit above its tint: BALANCE and the amount with its < and > (ui/Chrome.svelte) -->
<div class="hudp hud-group v-gear v-up v-side stats" class:menu-open={stateUi.menuOpen} data-plane="lit" style={plane}>
	{#if !replay}
		<div class="gsc" data-piece="bal" style={at('bal')}><HudReadout label="BALANCE" value={controls.balanceText()} x={0} y={0} w={B.bal.w} h={B.bal.h} nominal={L.text.bal} pad={B.bal.w - L.fitW.bal} cls="pt bal" hud="balance" lit /></div>
	{:else if rh && !rh.isBase}
		<div class="gsc" data-piece="bal" style={at('bal')}><HudReadout label="BASE AMOUNT" value={rh.base} x={0} y={0} w={B.bal.w} h={B.bal.h} nominal={L.text.bal} pad={B.bal.w - L.fitW.bal} cls="pt bal" hud="balance" lit /></div>
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
