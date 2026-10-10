<script lang="ts">
	// THE STAGING READOUT (`?perf=1`; docs/device-quality-plan-v2.md A2). MM_STAGING_PERF_READOUT
	// A small HTML box in a corner: what this device is, how the page is being drawn, and how the frames
	// have paced over the last fifteen minutes, with one plain line of verdict and a button that copies the
	// lot as text for a message. It is NOT part of the game's HUD (src/ui) and it is never in a production
	// bundle (game/staging.ts; scripts/check-production-bundle.mjs).
	//
	// STYLES: src/staging/mountPerf.ts injects them (a Svelte <style> block would be extracted into the
	// production stylesheet even though the component itself is dropped; the class names are global and all
	// live under .mm-perf).
	//
	// Cost: the measuring is src/staging/perfMeter.ts (one rAF listener, no allocation). This component only
	// reads it on a ONE SECOND timer and writes the DOM then. The box takes taps only on itself.
	import { onMount } from 'svelte';

	import { stateApp } from '../game/stateApp';
	import { PHONE_TIER, renderResolutionCap } from '../game/deviceTier';
	import { STAGING } from '../game/staging';
	import { LABEL_CAPS } from '../game/labelGlyphs';
	import { labelFont } from '../game/clusterLabel';
	import { plaqueGate } from '../game/assetGate';
	import { meter, startMeter, stopMeter, watchCanvas, recentMedianMs, currentMinute, finishedMinutes, worst, WORST_MIN_MS, MARK_LOOKBACK_MS, verdictOf, LONG_FACTOR, MINUTES_KEPT, type MinuteRow, type Verdict } from './perfMeter';

	/** how often the box is redrawn, ms */
	const REFRESH_MS = 1000;

	type Snapshot = {
		verdict: Verdict;
		intervalMs: number;
		hz: number;
		minutes: number;
		rows: MinuteRow[];
		now: MinuteRow;
		firstMinuteMs: number;
		contextLost: number;
		contextRestored: number;
		visibilityChanges: number;
		/** the three worst frames after the first minute, each with the last label before it ended */
		worstLine: string;
		draw: Record<string, string | number | boolean | null>;
	};
	let snap = $state<Snapshot | null>(null);
	/** on a narrow screen the open box would cover the top of the board for the whole session: it starts
	 *  as its one line header there (tap it to open) */
	const START_OPEN_MIN_WIDTH = 700;
	let open = $state(typeof window !== 'undefined' && window.innerWidth >= START_OPEN_MIN_WIDTH);
	let copied = $state('');
	let fallbackText = $state('');
	let area = $state<HTMLTextAreaElement | null>(null);

	// ---- the device, read once -------------------------------------------------------------------------
	const device: Record<string, string | number | boolean | null> = {};
	const readDevice = () => {
		const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string; mobile?: boolean; getHighEntropyValues?: (h: string[]) => Promise<Record<string, unknown>> } };
		device.userAgent = nav.userAgent;
		device.cores = nav.hardwareConcurrency ?? null;
		device.deviceMemoryGB = nav.deviceMemory ?? null;
		device.touchPoints = nav.maxTouchPoints ?? 0;
		device.uaPlatform = nav.userAgentData?.platform ?? null;
		device.uaMobile = nav.userAgentData?.mobile ?? null;
		void nav.userAgentData
			?.getHighEntropyValues?.(['model', 'platformVersion', 'architecture', 'uaFullVersion'])
			.then((v) => {
				device.model = (v.model as string) || null;
				device.platformVersion = (v.platformVersion as string) || null;
				device.architecture = (v.architecture as string) || null;
				device.browserVersion = (v.uaFullVersion as string) || null;
			})
			.catch(() => {});
	};
	/** the GPU facts, read once from the game's own context (never a second context) */
	let gpuRead = false;
	const readGpu = () => {
		const gl = (stateApp.pixiApplication?.renderer as { gl?: WebGL2RenderingContext } | undefined)?.gl;
		if (!gl || gpuRead) return;
		gpuRead = true;
		try {
			const dbg = gl.getExtension('WEBGL_debug_renderer_info');
			device.gpuVendor = dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR));
			device.gpuRenderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
			device.webgl = String(gl.getParameter(gl.VERSION));
			device.maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
			device.antialiasSamples = Number(gl.getParameter(gl.SAMPLES));
			device.antialias = gl.getContextAttributes()?.antialias ?? null;
		} catch {
			device.gpuRenderer = 'unreadable';
		}
	};
	const inFrame = (): boolean => {
		try {
			return window.self !== window.top;
		} catch {
			return true;
		}
	};

	// ---- once a second ---------------------------------------------------------------------------------
	const r1 = (v: number) => Math.round(v * 10) / 10;
	const read = () => {
		const app = stateApp.pixiApplication;
		// app.canvas throws until the renderer exists (the readout mounts before the game does)
		const canvas = (app?.renderer ? app.canvas : undefined) as HTMLCanvasElement | undefined;
		watchCanvas(canvas);
		readGpu();
		const rows = finishedMinutes();
		const now = currentMinute();
		const live = recentMedianMs();
		const w = canvas?.width ?? 0;
		const h = canvas?.height ?? 0;
		snap = {
			verdict: verdictOf(rows, now, live),
			intervalMs: live,
			hz: live ? 1000 / live : 0,
			minutes: (performance.now() - meter.startedAt) / 60000,
			rows,
			now,
			firstMinuteMs: meter.firstMinuteMedian,
			contextLost: meter.contextLost,
			contextRestored: meter.contextRestored,
			visibilityChanges: meter.visibilityChanges,
			worstLine: worst.later.slice(0, 3).map((f) => `${f.ms} ms ${f.marks.split(' ').pop() || '(no label)'}`).join('; '),
			draw: {
				rendererResolution: app?.renderer?.resolution ?? null,
				resolutionCap: renderResolutionCap(),
				canvasPx: `${w} x ${h}`,
				canvasMP: r1((w * h) / 1e6),
				devicePixelRatio: window.devicePixelRatio,
				viewportCss: `${window.innerWidth} x ${window.innerHeight}`,
				screenCss: `${window.screen?.width ?? '?'} x ${window.screen?.height ?? '?'}`,
				inIframe: inFrame(),
				phoneTier: PHONE_TIER,
				artTier: PHONE_TIER ? 'half (128 px cells)' : 'full (256 px cells)',
				labelCapPx: labelFont.cap < 0 ? null : LABEL_CAPS[labelFont.cap],
				plaqueReadyAtS: plaqueGate.readyAt ? r1(plaqueGate.readyAt / 1000) : null,
				deferredDone: stateApp.loaded,
				build: STAGING ? 'staging' : 'dev',
			},
		};
	};

	// ---- copy ------------------------------------------------------------------------------------------
	const report = (): string => {
		const s = snap;
		if (!s) return '';
		const row = (m: MinuteRow) => ({ min: m.minute + 1, frames: m.frames, medianMs: r1(m.medianMs), hz: r1(m.hz), long: m.long, longestMs: Math.round(m.longestMs) });
		return JSON.stringify(
			{
				game: 'manticore_mayhem',
				at: new Date().toISOString(),
				url: window.location.href.replace(/sessionID=[^&]+/, 'sessionID=...'),
				verdict: s.verdict.text,
				intervalMs: r1(s.intervalMs),
				hz: r1(s.hz),
				firstMinuteMedianMs: r1(s.firstMinuteMs),
				minutesMeasured: r1(s.minutes),
				minutesSinceLoad: r1(performance.now() / 60000),
				longFrameRule: `longer than ${LONG_FACTOR} x the median of its own minute`,
				perMinute: [...s.rows.map(row), { ...row(s.now), partial: true }],
				worstFramesRule: `frames of ${WORST_MIN_MS} ms or more; marks are the game's labels from ${MARK_LOOKBACK_MS} ms before the frame began to its end, as name@ms into the frame`,
				worstFramesFirstMinute: worst.firstMinute,
				worstFramesLater: worst.later,
				contextLost: s.contextLost,
				contextRestored: s.contextRestored,
				visibilityChanges: s.visibilityChanges,
				draw: s.draw,
				device,
			},
			null,
			1,
		);
	};
	const copy = async () => {
		const text = report();
		fallbackText = '';
		try {
			await navigator.clipboard.writeText(text);
			copied = 'Copied. Paste it into a message.';
		} catch {
			// refused (an iframe without clipboard permission, an old browser): show the text selected, so
			// a long press or Ctrl+C copies it
			fallbackText = text;
			copied = 'Copy was blocked here. The text below is selected: copy it by hand.';
			setTimeout(() => {
				area?.focus();
				area?.select();
				try {
					if (document.execCommand('copy')) copied = 'Copied. Paste it into a message.';
				} catch {
					/* the text stays selected for a manual copy */
				}
			}, 0);
		}
	};

	onMount(() => {
		readDevice();
		startMeter();
		// a reading that fails (the game not up yet) must never stop the next one
		const safe = () => {
			try {
				read();
			} catch {
				/* next second */
			}
		};
		safe();
		const id = setInterval(safe, REFRESH_MS);
		return () => {
			clearInterval(id);
			stopMeter();
		};
	});

	const shown = $derived(snap ? [...snap.rows, snap.now].slice(-MINUTES_KEPT) : []);
</script>

<div class="mm-perf" data-mm="MM_STAGING_PERF_READOUT" class:closed={!open}>
	<button class="head" onclick={() => (open = !open)} aria-label="Show or hide the readout">
		<span class="dot {snap?.verdict.code ?? 'measuring'}"></span>
		<span class="verdict">{snap?.verdict.text ?? 'measuring'}</span>
		<span class="hz">{snap && snap.hz ? `${snap.hz.toFixed(0)} Hz` : ''}</span>
	</button>
	{#if open && snap}
		<div class="body">
			<div class="line">interval {snap.intervalMs.toFixed(1)} ms ({snap.hz.toFixed(1)} Hz), first minute {snap.firstMinuteMs ? snap.firstMinuteMs.toFixed(1) + ' ms' : 'not yet'}</div>
			<div class="line">measured {snap.minutes.toFixed(1)} min, context lost {snap.contextLost} / restored {snap.contextRestored}, tab hidden or shown {snap.visibilityChanges} times</div>
			<table>
				<thead><tr><th>min</th><th>median ms</th><th>Hz</th><th>long</th><th>longest ms</th></tr></thead>
				<tbody>
					{#each shown as m (m.minute)}
						<tr class:partial={m.minute === snap.now.minute}>
							<td>{m.minute + 1}</td><td>{m.medianMs.toFixed(1)}</td><td>{m.hz.toFixed(0)}</td><td>{m.long}</td><td>{m.longestMs.toFixed(0)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if snap.worstLine}
				<div class="line small">worst after minute 1: {snap.worstLine}</div>
			{/if}
			<div class="line">renderer {snap.draw.rendererResolution} (cap {snap.draw.resolutionCap}), canvas {snap.draw.canvasPx} = {snap.draw.canvasMP} MP, DPR {snap.draw.devicePixelRatio}</div>
			<div class="line">viewport {snap.draw.viewportCss}, screen {snap.draw.screenCss}, in iframe: {snap.draw.inIframe ? 'yes' : 'no'}</div>
			<div class="line">phone tier: {snap.draw.phoneTier ? 'yes' : 'no'}, art {snap.draw.artTier}, label cap {snap.draw.labelCapPx ?? 'none'} px, plaque ready {snap.draw.plaqueReadyAtS ?? 'not yet'} s</div>
			<div class="line small">{device.gpuRenderer ?? 'GPU unknown'}; max texture {device.maxTextureSize ?? '?'}, AA samples {device.antialiasSamples ?? '?'}</div>
			<div class="line small">{device.model ? `${device.model}, ` : ''}{device.uaPlatform ?? ''} {device.platformVersion ?? ''} cores {device.cores ?? '?'}, memory {device.deviceMemoryGB ?? '?'} GB</div>
			<div class="line small ua">{device.userAgent}</div>
			<div class="actions">
				<button class="copy" onclick={copy}>Copy results</button>
				<span class="note">{copied}</span>
			</div>
			{#if fallbackText}
				<textarea bind:this={area} readonly rows="5">{fallbackText}</textarea>
			{/if}
		</div>
	{/if}
</div>
