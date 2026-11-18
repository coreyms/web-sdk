<script lang="ts">
	// THE REINDEER AREA EDITOR (staging and dev server only: it lives in the tune panel, which a production build never
	// carries; scripts/check-production-bundle.mjs). The roaming reindeer's area for the layout on screen now
	// (game/roamPaths.ts), drawn over the live game: its corners drag (mouse or touch), a corner is added after the one
	// picked or removed, the side he walks in from switches. The area (yellow) is where his feet may stand; the red boxes
	// are where his body never goes (the road under his feet, the HUD, the LED strip, the logo, the top line). The dashed
	// box is his body where he stands now, the dot his next spot. Every change is live (he re-reads the area) and is
	// REMEMBERED in this browser (one localStorage key, as the tune store keeps the values); the read back is every
	// layout's area as JSON, to copy, and a pasted one can be applied (the first build's waypoint paths are left out).
	// The walk speed, the stops and the walk lengths are the group's values below.
	import { onMount } from 'svelte';

	import { roamEdit } from './roamEdit.svelte';
	import { ROAM_REACH, roamDev, type RoamZone } from '../../game/road/roam';
	import { ROAM_AREAS, ROAM_AREAS_DEFAULT, ROAM_EDIT, roamAreasFrom, type RoamArea, type RoamCorner } from '../../game/roamPaths';
	import type { LayoutKind } from '../../game/layoutSpec';

	type Props = { part: 'controls' | 'overlay' };
	const { part }: Props = $props();

	const CLASS_LABEL: Record<LayoutKind, string> = { landscape: 'desktop and tablet', phone: 'phone held sideways', portrait: 'upright' };
	const round = (v: number) => Math.round(v * 10) / 10;
	const STORE_KEY = 'ror-roam-area-v1';

	let msg = $state('');
	let pasted = $state('');
	let area = $state<HTMLTextAreaElement | null>(null);

	type View = NonNullable<ReturnType<NonNullable<typeof roamDev.view>>>;
	const view = (): View | null => roamDev.view?.() ?? null;

	const remember = () => {
		try {
			globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(ROAM_AREAS));
		} catch {
			/* storage blocked: this page only */
		}
	};
	const take = (raw: unknown): number => {
		const got = roamAreasFrom(raw);
		for (const [k, a] of Object.entries(got)) ROAM_AREAS[k as LayoutKind] = a as RoamArea;
		return Object.keys(got).length;
	};

	// the overlay (always mounted with the panel) brings back the remembered areas, and redraws a few times a second while
	// shown (the screen may change size; he moves)
	onMount(() => {
		if (part !== 'overlay') return;
		try {
			const raw = globalThis.localStorage?.getItem(STORE_KEY);
			if (raw && take(JSON.parse(raw))) ROAM_EDIT.version++;
		} catch {
			/* a broken or old entry: ignored */
		}
		const id = setInterval(() => {
			if (roamEdit.shown) roamEdit.tick++;
		}, 250);
		return () => clearInterval(id);
	});

	const geo = $derived.by(() => {
		void roamEdit.tick;
		const v = view();
		if (!v) return null;
		const A: RoamArea = ROAM_AREAS[v.kind];
		const css = (x: number, y: number) => ({ x: v.ox + x * v.k, y: v.oy + y * v.k });
		const pts = A.corners.map((p) => css(p.x, p.y));
		// the snow beyond the art's sides, where the area allows it (road px 44 past the picture's edges)
		const beyond = A.beyond ? [css(Math.min(-44, v.rect.left), v.rect.top), css(-44, v.rect.bottom), css(1536 + 44, v.rect.top), css(Math.max(1580, v.rect.right), v.rect.bottom)] : null;
		const me = roamDev.roam?.snapshot();
		const s = (me?.scale ?? 0.72) * v.k;
		const zones: RoamZone[] = roamDev.zones?.() ?? [];
		const at = me && me.visible ? css(me.x, me.y) : null;
		// the tunnel mouths' keep-out polygons (road px, game/roamPaths.ts ROAM_TUNNELS)
		const mouths = ((me?.tunnels ?? []) as { x: number; y: number }[][]).map((P) => P.map((q) => css(q.x, q.y)));
		const route = ((me?.route ?? []) as { x: number; y: number }[]).map((q) => css(q.x, q.y));
		return { v, A, pts, beyond, mouths, route, side: ROAM_REACH.side * s, height: ROAM_REACH.up * s, zones, at, to: me ? css(me.to.x, me.to.y) : null, relaxed: !!me?.relaxed, capacity: me?.capacity ?? 0 };
	});
	const json = $derived.by(() => {
		void roamEdit.tick;
		return JSON.stringify(ROAM_AREAS, null, 1);
	});

	const edited = () => {
		ROAM_EDIT.version++;
		roamEdit.tick++;
		remember();
	};

	// ---- dragging (pointer and touch: pointer events, captured) ----------------------------------------------------
	let drag: { id: number; i: number } | null = null;
	const down = (e: PointerEvent, i: number) => {
		e.preventDefault();
		e.stopPropagation();
		drag = { id: e.pointerId, i };
		roamEdit.picked = i;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	};
	const move = (e: PointerEvent) => {
		if (!drag || e.pointerId !== drag.id) return;
		const v = view();
		if (!v) return;
		const p = ROAM_AREAS[v.kind].corners[drag.i];
		if (!p) return;
		// road px: the scene's own coordinates (the corner stays on the same snow at every window shape)
		p.x = round((e.clientX - v.ox) / v.k);
		p.y = round((e.clientY - v.oy) / v.k);
		ROAM_EDIT.version++;
		roamEdit.tick++;
	};
	const up = (e: PointerEvent) => {
		if (drag && e.pointerId === drag.id) {
			drag = null;
			remember();
		}
	};

	// ---- the panel's buttons ---------------------------------------------------------------------------------------
	const kindNow = () => view()?.kind ?? 'landscape';
	const add = () => {
		const v = view();
		if (!v) return;
		const C = ROAM_AREAS[v.kind].corners;
		const i = Math.max(0, Math.min(roamEdit.picked, C.length - 1));
		const a = C[i];
		const b = C[(i + 1) % C.length];
		const p: RoamCorner = { x: round((a.x + b.x) / 2), y: round((a.y + b.y) / 2) };
		C.splice(i + 1, 0, p);
		roamEdit.picked = i + 1;
		msg = `corner ${i + 2} added`;
		edited();
	};
	const remove = () => {
		const C = ROAM_AREAS[kindNow()].corners;
		if (C.length <= 3) {
			msg = 'an area keeps at least three corners';
			return;
		}
		const i = Math.max(0, Math.min(roamEdit.picked, C.length - 1));
		C.splice(i, 1);
		roamEdit.picked = Math.max(0, i - 1);
		msg = `corner ${i + 1} removed`;
		edited();
	};
	const flipSide = () => {
		const A = ROAM_AREAS[kindNow()];
		A.side = A.side === 'left' ? 'right' : 'left';
		msg = `he walks in (and strikes) from the ${A.side} now`;
		edited();
	};
	const reset = () => {
		const k = kindNow();
		ROAM_AREAS[k] = JSON.parse(JSON.stringify(ROAM_AREAS_DEFAULT[k]));
		roamEdit.picked = 0;
		msg = "this layout's area is back to its default";
		edited();
	};
	const apply = () => {
		try {
			const n = take(JSON.parse(pasted));
			msg = n ? `${n} layout area(s) applied` : 'nothing to apply (an old waypoint path is left out)';
			if (n) edited();
		} catch {
			msg = 'that is not JSON';
		}
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
		msg = 'he stands at a new spot';
	};
</script>

{#if part === 'controls'}
	<div class="roam-ed">
		<div class="actions">
			<button class="sw" class:on={roamEdit.shown} onclick={() => (roamEdit.shown = !roamEdit.shown)} aria-label="Show the area over the game" aria-pressed={roamEdit.shown}></button>
			<span>Show the area over the game</span>
		</div>
		{#if geo}
			<div class="msg">Editing the area for: <b>{CLASS_LABEL[geo.v.kind]}</b> (each layout has its own; rotate or resize to edit another). It is fixed to the scene, so it holds at every window shape. He walks in from the <b>{geo.A.side}</b>. Yellow: where his feet may stand{geo.A.beyond ? ' (with the snow past the tunnels, lighter)' : ''}. Red: where his body never goes. This window: {geo.capacity} spots 12% of the width apart{geo.relaxed ? ', too few: widened to all the free snow' : ''}.</div>
		{/if}
		<div class="actions">
			<button class="small" onclick={add}>Add a corner after {roamEdit.picked + 1}</button>
			<button class="small" onclick={remove}>Remove corner {roamEdit.picked + 1}</button>
			<button class="small" onclick={flipSide}>Switch side</button>
			<button class="small" onclick={reset}>Reset this area</button>
			<button class="small" onclick={walkIn}>Walk a new one in</button>
			<button class="small" onclick={place}>Stand him somewhere new</button>
		</div>
		<div class="sub">Read back (every layout's area, JSON; remembered in this browser)</div>
		<textarea bind:this={area} readonly rows="6" value={json} data-roam-json></textarea>
		<div class="actions"><button class="small" onclick={copy}>Copy</button><span class="msg">{msg}</span></div>
		<div class="sub">Apply an area (paste JSON)</div>
		<textarea rows="2" bind:value={pasted} spellcheck="false"></textarea>
		<div class="actions"><button class="small" onclick={apply}>Apply</button></div>
		<div class="msg">The area stays over the game while the panel is hidden (Hide), so a corner can be dragged on a phone.</div>
	</div>
{/if}

{#if part === 'overlay' && roamEdit.shown && geo}
	<div class="roam-overlay" data-roam-overlay>
		<svg width="100%" height="100%">
			{#each geo.zones as z, i (i)}
				<rect x={z.x0} y={z.y0} width={z.x1 - z.x0} height={z.y1 - z.y0} class="zone" />
				<text x={z.x0 + 3} y={z.y0 + 11} class="zt">{z.name}</text>
			{/each}
			{#if geo.beyond}
				<rect x={geo.beyond[0].x} y={geo.beyond[0].y} width={geo.beyond[1].x - geo.beyond[0].x} height={geo.beyond[1].y - geo.beyond[0].y} class="area beyond" />
				<rect x={geo.beyond[2].x} y={geo.beyond[2].y} width={geo.beyond[3].x - geo.beyond[2].x} height={geo.beyond[3].y - geo.beyond[2].y} class="area beyond" />
			{/if}
			<polygon points={geo.pts.map((p) => `${p.x},${p.y}`).join(' ')} class="area" data-roam-area />
			{#each geo.mouths as M, i (i)}
				<polygon points={M.map((p) => `${p.x},${p.y}`).join(' ')} class="zone" data-roam-mouth={i} />
			{/each}
			{#if geo.route.length > 1}<polyline points={geo.route.map((p) => `${p.x},${p.y}`).join(' ')} class="path" />{/if}
			{#if geo.at}
				<rect x={geo.at.x - geo.side} y={geo.at.y - geo.height} width={geo.side * 2} height={geo.height} class="body" />
				<circle cx={geo.at.x} cy={geo.at.y} r="4" class="me" />
			{/if}
			{#if geo.to}<circle cx={geo.to.x} cy={geo.to.y} r="3" class="to" />{/if}
		</svg>
		{#each geo.pts as p, i (i)}
			<button class="wp" class:picked={i === roamEdit.picked} style="left:{p.x}px;top:{p.y}px" onpointerdown={(e) => down(e, i)} onpointermove={move} onpointerup={up} onpointercancel={up} aria-label="Corner {i + 1}" data-roam-wp={i}>{i + 1}</button>
		{/each}
	</div>
{/if}
