<script lang="ts">
	// THE REINDEER PATH EDITOR (staging and dev server only: it lives in the tune panel, which a production build never
	// carries; scripts/check-production-bundle.mjs). The roaming reindeer's path for the layout on screen now
	// (game/roamPaths.ts), drawn over the live game: its waypoints drag (mouse or touch), a waypoint is added after the one
	// picked or removed, the entry point's height drags at the screen's edge, the side switches. The shaded boxes are where
	// he must never be (the road, the HUD, the LED strip, the logo, the bonus round's counter plate, the top line); the thin
	// box at each waypoint is his body there. Every change is live (the roamer re-reads his path) and nothing is stored: the
	// read back below is the path as JSON, to copy. The walking speed and the idle times are the group's values above.
	import { onMount } from 'svelte';

	import { roamEdit } from './roamEdit.svelte';

	import { roamDev, type RoamZone } from '../../game/road/roam';
	import { roamBox } from '../../game/road/roamFrames';
	import { ROAM_EDIT, ROAM_PATHS, ROAM_PATHS_DEFAULT, roamFracX, roamFracY, roamX, roamY, type RoamAnchorX, type RoamPath, type RoamPoint } from '../../game/roamPaths';
	import type { LayoutKind } from '../../game/layoutSpec';

	const CLASS_LABEL: Record<LayoutKind, string> = { landscape: 'desktop and tablet', phone: 'phone held sideways', portrait: 'upright' };
	const W = 1536;

	type Props = { part: 'controls' | 'overlay' };
	const { part }: Props = $props();
	let msg = $state('');
	let area = $state<HTMLTextAreaElement | null>(null);

	type View = NonNullable<ReturnType<NonNullable<typeof roamDev.view>>>;
	const view = (): View | null => roamDev.view?.() ?? null;

	// redrawn a few times a second while shown (the screen may change size; the roamer moves): the overlay's own clock
	onMount(() => {
		if (part !== 'overlay') return;
		const id = setInterval(() => {
			if (roamEdit.shown) roamEdit.tick++;
		}, 250);
		return () => clearInterval(id);
	});

	const geo = $derived.by(() => {
		void roamEdit.tick;
		const v = view();
		if (!v) return null;
		const P: RoamPath = ROAM_PATHS[v.kind];
		const css = (x: number, y: number) => ({ x: v.ox + x * v.k, y: v.oy + y * v.k });
		const pts = P.points.map((p) => css(roamX(p.ax, p.x, v.rect), roamY(p.ay, p.y, v.rect)));
		const s = (roamDev.roam?.scale() ?? 0.72) * v.k;
		const b = roamBox('walk');
		const side = Math.max(b.anchorX, 1 - b.anchorX) * b.width * s;
		const enterY = v.oy + roamY(P.enter.ay, P.enter.y, v.rect) * v.k;
		const enterX = P.side === 'left' ? 6 : window.innerWidth - 6;
		const zones: RoamZone[] = roamDev.zones?.() ?? [];
		const me = roamDev.roam?.snapshot();
		return { v, P, pts, side, height: b.height * s, enterX, enterY, zones, me: me && me.visible ? css(me.x, me.y) : null };
	});
	const json = $derived.by(() => {
		void roamEdit.tick;
		return JSON.stringify(ROAM_PATHS, null, 1);
	});

	const edited = () => {
		ROAM_EDIT.version++;
		roamEdit.tick++;
	};

	// ---- dragging (pointer and touch: pointer events, captured) ----------------------------------------------------
	let drag: { id: number; what: number | 'enter' } | null = null;
	const down = (e: PointerEvent, what: number | 'enter') => {
		e.preventDefault();
		e.stopPropagation();
		drag = { id: e.pointerId, what };
		if (typeof what === 'number') roamEdit.picked = what;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	};
	const move = (e: PointerEvent) => {
		if (!drag || e.pointerId !== drag.id) return;
		const v = view();
		if (!v) return;
		const P = ROAM_PATHS[v.kind];
		const rx = (e.clientX - v.ox) / v.k;
		const ry = (e.clientY - v.oy) / v.k;
		if (drag.what === 'enter') {
			P.enter.y = roamFracY(P.enter.ay, ry, v.rect);
		} else {
			const p = P.points[drag.what];
			if (!p) return;
			// a point keeps its anchors; across the picture's edge its x takes the picture or that side's room
			let ax: RoamAnchorX = p.ax;
			if (ax === 'picture' && rx < 0 && v.rect.left < -1) ax = 'left';
			else if (ax === 'picture' && rx > W && v.rect.right > W + 1) ax = 'right';
			else if (ax !== 'picture' && rx >= 0 && rx <= W) ax = 'picture';
			p.ax = ax;
			p.x = roamFracX(ax, rx, v.rect);
			p.y = roamFracY(p.ay, ry, v.rect);
		}
		edited();
	};
	const up = (e: PointerEvent) => {
		if (drag && e.pointerId === drag.id) drag = null;
	};

	// ---- the panel's buttons ---------------------------------------------------------------------------------------
	const kindNow = () => view()?.kind ?? 'landscape';
	const add = () => {
		const v = view();
		if (!v) return;
		const P = ROAM_PATHS[v.kind];
		const i = Math.max(0, Math.min(roamEdit.picked, P.points.length - 1));
		const a = P.points[i];
		const b = P.points[i + 1];
		const ax = roamX(a.ax, a.x, v.rect);
		const ay = roamY(a.ay, a.y, v.rect);
		// midway to the next one, or 80 road px in from the last toward the board
		const nx = b ? (ax + roamX(b.ax, b.x, v.rect)) / 2 : ax + (P.side === 'right' ? -80 : 80);
		const ny = b ? (ay + roamY(b.ay, b.y, v.rect)) / 2 : ay;
		let pax: RoamAnchorX = a.ax;
		if (nx >= 0 && nx <= W) pax = 'picture';
		const p: RoamPoint = { ax: pax, x: roamFracX(pax, nx, v.rect), ay: a.ay, y: roamFracY(a.ay, ny, v.rect) };
		P.points.splice(i + 1, 0, p);
		roamEdit.picked = i + 1;
		msg = `waypoint ${i + 2} added`;
		edited();
	};
	const remove = () => {
		const P = ROAM_PATHS[kindNow()];
		if (P.points.length <= 1) {
			msg = 'a path keeps at least one waypoint';
			return;
		}
		const i = Math.max(0, Math.min(roamEdit.picked, P.points.length - 1));
		P.points.splice(i, 1);
		roamEdit.picked = Math.max(0, i - 1);
		msg = `waypoint ${i + 1} removed`;
		edited();
	};
	const flipSide = () => {
		const P = ROAM_PATHS[kindNow()];
		P.side = P.side === 'left' ? 'right' : 'left';
		msg = `he lives on the ${P.side} now (enters and strikes from there)`;
		edited();
	};
	const reset = () => {
		const k = kindNow();
		ROAM_PATHS[k] = JSON.parse(JSON.stringify(ROAM_PATHS_DEFAULT[k]));
		roamEdit.picked = 0;
		msg = 'this layout’s path is back to its default';
		edited();
	};
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(json);
			msg = 'copied';
		} catch {
			area?.select();
			msg = 'selected: copy it by hand';
		}
	};
	const walkIn = () => {
		roamDev.roam?.walkInSoon(0);
		msg = 'a new one walks in';
	};
	const place = () => {
		roamDev.roam?.placeNow();
		msg = 'he stands at a waypoint';
	};
</script>

{#if part === 'controls'}
<div class="roam-ed">
	<div class="actions">
		<button class="sw" class:on={roamEdit.shown} onclick={() => (roamEdit.shown = !roamEdit.shown)} aria-label="Show the path over the game" aria-pressed={roamEdit.shown}></button>
		<span>Show the path over the game</span>
	</div>
	{#if geo}
		<div class="msg">Editing the path for: <b>{CLASS_LABEL[geo.v.kind]}</b> (each layout has its own; rotate or resize to edit another). He lives on the <b>{geo.P.side}</b>.</div>
	{/if}
	<div class="actions">
		<button class="small" onclick={add}>Add a waypoint after {roamEdit.picked + 1}</button>
		<button class="small" onclick={remove}>Remove waypoint {roamEdit.picked + 1}</button>
		<button class="small" onclick={flipSide}>Switch side</button>
		<button class="small" onclick={reset}>Reset this path</button>
		<button class="small" onclick={walkIn}>Walk a new one in</button>
		<button class="small" onclick={place}>Stand him at a waypoint</button>
	</div>
	<div class="sub">Read back (every layout's path, JSON)</div>
	<textarea bind:this={area} readonly rows="6" value={json} data-roam-json></textarea>
	<div class="actions"><button class="small" onclick={copy}>Copy</button><span class="msg">{msg}</span></div>
	<div class="msg">The path stays over the game while the panel is hidden (Hide), so it can be dragged on a phone.</div>
</div>
{/if}

{#if part === 'overlay' && roamEdit.shown && geo}
	<div class="roam-overlay" data-roam-overlay>
		<svg width="100%" height="100%">
			{#each geo.zones as z, i (i)}
				<rect x={z.x0} y={z.y0} width={z.x1 - z.x0} height={z.y1 - z.y0} class="zone" />
				<text x={z.x0 + 3} y={z.y0 + 11} class="zt">{z.name}</text>
			{/each}
			{#if geo.pts.length}
				<line x1={geo.enterX} y1={geo.enterY} x2={geo.pts[0].x} y2={geo.pts[0].y} class="enter" />
			{/if}
			<polyline points={geo.pts.map((p) => `${p.x},${p.y}`).join(' ')} class="path" />
			{#each geo.pts as p, i (i)}
				<rect x={p.x - geo.side} y={p.y - geo.height} width={geo.side * 2} height={geo.height} class="body" class:picked={i === roamEdit.picked} />
			{/each}
			{#if geo.me}<circle cx={geo.me.x} cy={geo.me.y} r="4" class="me" />{/if}
		</svg>
		{#each geo.pts as p, i (i)}
			<button class="wp" class:picked={i === roamEdit.picked} style="left:{p.x}px;top:{p.y}px" onpointerdown={(e) => down(e, i)} onpointermove={move} onpointerup={up} onpointercancel={up} aria-label="Waypoint {i + 1}" data-roam-wp={i}>{i + 1}</button>
		{/each}
		<button class="wp enter" style="left:{geo.enterX}px;top:{geo.enterY}px" onpointerdown={(e) => down(e, 'enter')} onpointermove={move} onpointerup={up} onpointercancel={up} aria-label="Where he walks in" data-roam-enter>in</button>
	</div>
{/if}
