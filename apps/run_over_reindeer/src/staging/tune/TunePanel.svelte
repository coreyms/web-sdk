<script lang="ts">
	// THE TUNING PANEL (`?tune=1`, or `?tune=<group>`; dev server and PUBLIC_STAGING=1 builds only, never production:
	// routes/+layout.svelte imports it behind STAGING_TOOLS, scripts/check-production-bundle.mjs fails a production build
	// that carries ROR_TUNE_PANEL). An HTML box over the game, not Pixi. It lists TUNE (game/constants.ts) by reflection
	// and writes straight into that live object, the same one the dev hook hands out as window.__reindeer.tune; the
	// labels, ranges and "when it shows" notes come from tuneMeta.ts. Nothing is sent. Since 2026-11-17 the changed values
	// are REMEMBERED across a reload (tuneStore.ts, one localStorage key, applied by routes/+layout.svelte before the board
	// is built, so the 'applies after a reload' values can be tried); "Reset all to defaults" clears them and reloads. The
	// "changed values" box is the read back: one line per value that differs from its default.
	//
	// STYLES: mountTune.ts injects them (a Svelte <style> block would be extracted into the shared stylesheet).
	import { onMount } from 'svelte';

	import { TUNE } from '../../game/constants';
	import { rememberedApplied, tuneDefaults, writeRemembered } from './tuneStore';
	import { GROUP_ACTIONS, GROUP_META, GROUP_ORDER, WHEN_LABEL, isColor, metaFor, rangeFor, whenFor, type Meta, type When } from './tuneMeta';

	type Props = { group: string | null };
	const { group: startGroup }: Props = $props();

	type Kind = 'number' | 'bool' | 'string' | 'color' | 'select' | 'null';
	type Leaf = { path: string[]; id: string; kind: Kind; def: unknown; meta: Meta; when: When };
	type Block = { id: string; title: string | null; leaves: Leaf[] };
	type Group = { key: string; label: string; when: When; blocks: Block[]; leaves: Leaf[] };

	const isBranch = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';
	const clone = (v: unknown): unknown => (Array.isArray(v) ? v.map(clone) : isBranch(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);
	const getAt = (root: unknown, path: string[]) => path.reduce<unknown>((o, k) => (isBranch(o) ? o[k] : undefined), root);
	const setAt = (root: unknown, path: string[], v: unknown) => {
		const parent = getAt(root, path.slice(0, -1));
		if (isBranch(parent)) parent[path[path.length - 1]] = v;
	};

	/** the defaults, as the page loaded them (before the remembered values and any change from here or the console) */
	const DEFAULTS = (tuneDefaults() ?? clone(TUNE)) as Record<string, unknown>;

	const kindOf = (path: string[], v: unknown, meta: Meta): Kind => {
		if (meta.options) return 'select';
		if (v === null) return 'null';
		if (typeof v === 'boolean') return 'bool';
		if (typeof v === 'string') return 'string';
		if (isColor(path, v)) return 'color';
		return 'number';
	};

	const walk = (v: unknown, path: string[], out: Leaf[]) => {
		if (isBranch(v)) {
			for (const [k, x] of Object.entries(v)) walk(x, [...path, k], out);
			return;
		}
		if (typeof v === 'function' || v === undefined) return;
		const meta = metaFor(path);
		out.push({ path, id: path.join('.'), kind: kindOf(path, v, meta), def: v, meta, when: whenFor(path) });
	};

	const keys = [...GROUP_ORDER.filter((k) => k in TUNE), ...Object.keys(TUNE).filter((k) => !GROUP_ORDER.includes(k))];
	const groups: Group[] = keys.map((key) => {
		const leaves: Leaf[] = [];
		walk(DEFAULTS[key], [key], leaves);
		const blocks: Block[] = [];
		for (const leaf of leaves) {
			const parent = leaf.path.slice(0, -1);
			const id = parent.join('.');
			let b = blocks.find((x) => x.id === id);
			if (!b) {
				const label = parent.length > 1 ? metaFor(parent).label : undefined;
				const name = parent.slice(1).join('.');
				b = { id, title: parent.length > 1 ? (label ? `${label} (${name})` : name) : null, leaves: [] };
				blocks.push(b);
			}
			b.leaves.push(leaf);
		}
		return { key, label: GROUP_META[key]?.label ?? key, when: GROUP_META[key]?.when ?? 'unknown', blocks, leaves };
	});
	const allLeaves = groups.flatMap((g) => g.leaves);

	// ---- the values, mirrored for the page (TUNE is a plain object; the mirror is what the page redraws from) ------
	let vals = $state<Record<string, unknown>>(Object.fromEntries(allLeaves.map((l) => [l.id, getAt(TUNE, l.path)])));
	const write = (leaf: Leaf, v: unknown) => {
		setAt(TUNE, leaf.path, v);
		vals[leaf.id] = v;
	};
	/** a change made in the console shows here too (read once a second while the panel is open) */
	const pull = () => {
		for (const l of allLeaves) {
			const v = getAt(TUNE, l.path);
			if (vals[l.id] !== v) vals[l.id] = v;
		}
	};

	const hex = (n: number) => `#${(n >>> 0).toString(16).padStart(6, '0')}`;
	const show = (leaf: Leaf, v: unknown) => (v === null ? 'null' : leaf.kind === 'color' && typeof v === 'number' ? hex(v) : typeof v === 'number' ? String(+v.toPrecision(6)) : String(v));
	const changed = $derived(allLeaves.filter((l) => vals[l.id] !== l.def));
	const changedText = $derived(changed.map((l) => `${l.id}: ${show(l, l.def)} to ${show(l, vals[l.id])}`).join('\n'));
	const changedIn = (g: Group) => changed.filter((l) => l.path[0] === g.key).length;

	const resetLeaves = (leaves: Leaf[]) => {
		for (const l of leaves) if (vals[l.id] !== l.def) write(l, l.def);
	};
	// THE MEMORY: every change is kept (the values that differ from their defaults), and comes back after a reload
	$effect(() => {
		writeRemembered(Object.fromEntries(changed.map((l) => [l.id, vals[l.id]])));
	});
	const remembered = rememberedApplied();
	const resetAndReload = () => {
		writeRemembered({});
		location.reload();
	};

	// ---- inputs ----------------------------------------------------------------------------------------------------
	const onNumber = (leaf: Leaf, text: string) => {
		const v = parseFloat(text);
		if (Number.isFinite(v)) write(leaf, v);
	};
	const onNullable = (leaf: Leaf, text: string) => {
		const t = text.trim();
		if (t === '' || t === 'null') write(leaf, null);
		else if (Number.isFinite(parseFloat(t))) write(leaf, parseFloat(t));
	};
	const onColor = (leaf: Leaf, text: string) => {
		const m = /^#?([0-9a-f]{6})$/i.exec(text.trim());
		if (m) write(leaf, parseInt(m[1], 16));
	};
	const onSelect = (leaf: Leaf, text: string) => {
		const opt = leaf.meta.options?.find((o) => String(o) === text);
		if (opt !== undefined) write(leaf, opt);
	};
	const rangeOf = (leaf: Leaf) => {
		const r = rangeFor(leaf.path, leaf.def as number);
		const v = Number(vals[leaf.id]);
		return { min: Math.min(r.min, v), max: Math.max(r.max, v), step: r.step };
	};

	// ---- the replay helper: only if the fixture rounds' dev hook is there (dev server, staging) -------------------------
	type Fixtures = { next: (name: string, sticky?: boolean) => string; log: () => { plays: { name: string }[] } };
	const fixtures = () => (window as unknown as { __reindeer?: { fixtures?: Fixtures } }).__reindeer?.fixtures;
	const hasReplay = typeof window !== 'undefined' && !!fixtures();
	let replayMsg = $state('');
	const replayLast = () => {
		const f = fixtures();
		const last = f?.log().plays.at(-1);
		replayMsg = !f ? 'no fixture rounds on this page' : !last ? 'no round played yet' : `${f.next(last.name)}: press Spin`;
	};

	let actionMsg = $state<Record<string, string>>({});
	const act = (key: string, a: { label: string; run: () => string | void }) => {
		const r = a.run();
		actionMsg[key] = r ? `${a.label}: ${r}` : `${a.label}: playing`;
	};

	let copyMsg = $state('');
	let area = $state<HTMLTextAreaElement | null>(null);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(changedText);
			copyMsg = 'copied';
		} catch {
			area?.select();
			copyMsg = 'selected: copy it by hand';
		}
	};

	// ---- open, collapsed, docked, dragged ----------------------------------------------------------------------------
	const groupKey = startGroup && keys.find((k) => k.toLowerCase() === startGroup.toLowerCase());
	let open = $state(!!groupKey);
	let side = $state<'left' | 'right'>('right');
	let top = $state(typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.3) : 100);
	let dragX = $state<number | null>(null);
	let opened = $state<Record<string, boolean>>(groupKey ? { [groupKey]: true } : {});

	let drag: { id: number; x0: number; y0: number; top0: number; moved: boolean; tab: boolean } | null = null;
	const down = (e: PointerEvent, tab: boolean) => {
		if (e.button !== 0) return;
		if ((e.target as HTMLElement).closest('button') && !tab) return; // the header's own buttons are taps
		drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, top0: top, moved: false, tab };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	};
	const move = (e: PointerEvent) => {
		if (!drag || e.pointerId !== drag.id) return;
		const dx = e.clientX - drag.x0;
		const dy = e.clientY - drag.y0;
		if (!drag.moved && Math.hypot(dx, dy) < 6) return;
		drag.moved = true;
		top = Math.max(4, Math.min(window.innerHeight - 44, drag.top0 + dy));
		dragX = e.clientX;
	};
	const up = (e: PointerEvent) => {
		if (!drag || e.pointerId !== drag.id) return;
		const d = drag;
		drag = null;
		if (d.moved) {
			side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
			justDragged = d.tab;
		}
		dragX = null;
	};
	/** the tab opens on a click (a mouse click or a touch tap), but not on the click that ends a drag */
	let justDragged = false;
	const tabClick = () => {
		if (justDragged) justDragged = false;
		else open = true;
	};
	const place = $derived(dragX !== null ? `left:${Math.max(4, dragX - 40)}px;top:${top}px` : `${side}:8px;top:${top}px`);

	onMount(() => {
		const id = setInterval(() => open && pull(), 1000);
		return () => clearInterval(id);
	});

	// the game's own hotkeys (Space to spin) and board taps must not see what is typed or pressed in the panel
	const stop = (e: Event) => e.stopPropagation();
</script>

<div class="ror-tune" style={place} onkeydown={stop} onkeyup={stop} onwheel={stop} role="presentation">
	{#if !open}
		<button class="tab" onclick={tabClick} onpointerdown={(e) => down(e, true)} onpointermove={move} onpointerup={up} onpointercancel={up} aria-label="Open the tuning panel">
			Tune{#if changed.length}<span class="n">{changed.length}</span>{/if}
		</button>
	{:else}
		<div class="box" style="max-height:min(78vh, calc(100vh - {top}px - 8px))">
			<div class="head" onpointerdown={(e) => down(e, false)} onpointermove={move} onpointerup={up} onpointercancel={up} role="presentation">
				<span class="title">Tune</span>
				<button onclick={() => (side = 'left')} aria-label="Dock left">Left</button>
				<button onclick={() => (side = 'right')} aria-label="Dock right">Right</button>
				<button onclick={() => (open = false)} aria-label="Collapse">Hide</button>
			</div>
			<div class="scroll">
				<div class="changes">
					<div><b>Changed values</b> <span class="msg">({changed.length}, remembered across a reload; {remembered} came back with this page)</span></div>
					{#if changed.length}
						<textarea bind:this={area} readonly rows={Math.min(8, changed.length + 1)} value={changedText}></textarea>
					{/if}
					<div class="actions">
						<button class="small" onclick={copy} disabled={!changed.length}>Copy</button>
						<button class="small" onclick={() => resetLeaves(allLeaves)} disabled={!changed.length}>Reset all</button>
						<button class="small" onclick={resetAndReload}>Reset all to defaults (and reload)</button>
						{#if hasReplay}<button class="small" onclick={replayLast}>Queue the last round again</button>{/if}
						<span class="msg">{copyMsg || replayMsg}</span>
					</div>
				</div>
				{#each groups as g (g.key)}
					<details open={!!opened[g.key]} ontoggle={(e) => (opened[g.key] = (e.currentTarget as HTMLDetailsElement).open)}>
						<summary>
							<span class="g">{g.label}{changedIn(g) ? ` (${changedIn(g)} changed)` : ''}</span>
							<span class="when" class:reload={g.when === 'reload'}>{WHEN_LABEL[g.when]}</span>
						</summary>
						{#if opened[g.key]}
							<div class="rows">
								<div class="actions"><button class="small" onclick={() => resetLeaves(g.leaves)} disabled={!changedIn(g)}>Reset group</button></div>
								{#if GROUP_ACTIONS[g.key]}
									<div class="actions">
										{#each GROUP_ACTIONS[g.key] as a (a.label)}<button class="small" onclick={() => act(g.key, a)}>{a.label}</button>{/each}
										<span class="msg">{actionMsg[g.key] ?? ''}</span>
									</div>
								{/if}
								{#each g.blocks as b (b.id)}
									{#if b.title}<div class="sub">{b.title}</div>{/if}
									{#each b.leaves as l (l.id)}
										<div class="row" class:changed={vals[l.id] !== l.def} data-path={l.id}>
											<span class="k">
												{l.meta.label ?? l.path[l.path.length - 1]}{#if l.meta.unit}<span class="u">{` ${l.meta.unit}`}</span>{/if}
												{#if l.when !== g.when}<span class="when" class:reload={l.when === 'reload'}>{` ${WHEN_LABEL[l.when]}`}</span>{/if}
												{#if vals[l.id] !== l.def}<button class="small" onclick={() => write(l, l.def)} aria-label="reset {l.id}">reset</button>{/if}
											</span>
											{#if l.kind === 'bool'}
												<button class="sw" class:on={vals[l.id] === true} onclick={() => write(l, !vals[l.id])} aria-label={l.id} aria-pressed={vals[l.id] === true}></button>
											{:else if l.kind === 'select'}
												<select value={String(vals[l.id])} onchange={(e) => onSelect(l, e.currentTarget.value)} aria-label={l.id}>
													{#each l.meta.options ?? [] as o (o)}<option value={String(o)}>{o}</option>{/each}
												</select>
											{:else if l.kind === 'color'}
												<span class="color">
													<span class="chip" style="background:{hex(Number(vals[l.id]))}"></span>
													<input type="text" value={hex(Number(vals[l.id]))} onchange={(e) => onColor(l, e.currentTarget.value)} aria-label={l.id} spellcheck="false" />
												</span>
											{:else if l.kind === 'string'}
												<input type="text" value={String(vals[l.id])} onchange={(e) => write(l, e.currentTarget.value)} aria-label={l.id} spellcheck="false" />
											{:else if l.kind === 'null'}
												<input type="text" value={show(l, vals[l.id])} onchange={(e) => onNullable(l, e.currentTarget.value)} aria-label={l.id} />
											{:else}
												{@const r = rangeOf(l)}
												<input type="number" step="any" value={show(l, vals[l.id])} onchange={(e) => onNumber(l, e.currentTarget.value)} aria-label={l.id} />
												<input type="range" min={r.min} max={r.max} step={r.step} value={Number(vals[l.id])} oninput={(e) => onNumber(l, e.currentTarget.value)} aria-label="{l.id} slider" />
											{/if}
										</div>
									{/each}
								{/each}
							</div>
						{/if}
					</details>
				{/each}
			</div>
		</div>
	{/if}
</div>
