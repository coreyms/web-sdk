<script lang="ts">
	import { onMount, untrack, type Snippet } from 'svelte';
	import * as PIXI from 'pixi.js';

	import { getContextApp } from '../context.svelte';
	import { getProcessed } from '../assetLoad';
	import type { LoadedAssets, RawAsset } from '../types';

	type Props = { children: Snippet };

	const props: Props = $props();
	const context = getContextApp();

	let preLoaded = $state(false);

	const assetNameList = $derived(
		context.stateApp.assets
			? Object.keys(context.stateApp.assets).filter(
					(key) => Boolean(context.stateApp.assets?.[key].preload) === false,
				)
			: [],
	);

	const preAssetNameList = $derived(
		context.stateApp.assets
			? Object.keys(context.stateApp.assets).filter(
					(key) => context.stateApp.assets?.[key].preload === true,
				)
			: [],
	);

	// ── progress ───────────────────────────────────────────────────────────────────────────────────
	// One tick per asset OUR OWN Promise.all settles, across BOTH phases (pre + post) — not Pixi's
	// onProgress. That callback is per-load-call and every asset here is a single url, so it fires
	// exactly once, at the end of that asset, with no intermediate value; the old handler also only
	// counted the post phase, so a game marking every asset `preload: true` sat at LOADING · 0% for
	// its entire load (measured: a full 3-minute Slow-3G run) and then jumped straight to done.
	// Counting settled promises is monotonic and honest; `loadedKeys` is a Set so a retried asset is
	// only ever counted once.
	const loadedKeys = new Set<string>();
	const reportProgress = () => {
		const total = preAssetNameList.length + assetNameList.length;
		if (total <= 0) return;
		context.stateApp.loadingProgress = Math.min(100, (loadedKeys.size / total) * 100);
	};

	// ── retry / failure ────────────────────────────────────────────────────────────────────────────
	// A dropped download used to be swallowed (console.error, carry on), so the game entered playable
	// with missing textures and no message. Now each asset gets three retries with backoff and, if it
	// still will not load, the phase STOPS: `loaded` stays false and the failed keys are published on
	// stateApp so the app's loading screen can offer a retry (stateApp.retryFailedAssets re-runs ONLY
	// those keys — Pixi drops a rejected promise from its cache, so the attempt really does refetch).
	const RETRY_DELAYS = [1000, 2000, 4000];
	const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	const loadOne = async (key: string) => {
		const { type, src } = context.stateApp.assets![key];
		const loadSrc =
			type === 'spine' ? Object.values(src).filter((item) => typeof item === 'string') : src;
		const rawAsset = await PIXI.Assets.load<RawAsset>(loadSrc);
		return getProcessed({ key, rawAsset, type, src });
	};

	/** the processed asset, or undefined once the retries are spent */
	const loadWithRetry = async (key: string) => {
		for (let attempt = 0; ; attempt += 1) {
			try {
				return await loadOne(key);
			} catch (error) {
				console.error(`[AssetsLoader] "${key}" failed (attempt ${attempt + 1})`, error);
				if (attempt >= RETRY_DELAYS.length) return undefined;
				await wait(RETRY_DELAYS[attempt]);
			}
		}
	};

	// Audio is the one class a game is expected to survive without: the app owns the audiosprite
	// fetch and deliberately lets the player in silently when it dies (see the game's sound module),
	// so a dead audio manifest keeps the OLD swallow-and-continue behaviour instead of raising the
	// retry gate. Everything else is a texture the game would draw as a hole.
	const blocksLoad = (key: string) => context.stateApp.assets?.[key].type !== 'audio';

	const loadAssets = async (nameList: string[]) => {
		const failed: string[] = [];
		const processedList = await Promise.all(
			nameList.map(async (key) => {
				const processed = await loadWithRetry(key);
				if (processed || !blocksLoad(key)) loadedKeys.add(key);
				else failed.push(key);
				reportProgress();
				return processed;
			}),
		);

		const loaded = processedList.reduce(
			(acc, cur) => ({
				...acc,
				...cur,
			}),
			{} as LoadedAssets,
		);

		return { loaded, failed };
	};

	// keys each phase still owes; a retry re-runs only these, never the whole manifest
	let prePending: string[] | undefined;
	let postPending: string[] | undefined;
	let running = false;
	let retryToken = $state(0);

	const run = async () => {
		if (running) return;
		running = true;
		try {
			if (!preLoaded) {
				if (prePending === undefined) prePending = preAssetNameList;
				if (prePending.length > 0) {
					const { loaded, failed } = await loadAssets(prePending);
					context.stateApp.loadedAssets = { ...context.stateApp.loadedAssets, ...loaded };
					prePending = failed;
					if (failed.length > 0) {
						context.stateApp.failedAssets = failed;
						return;
					}
				}
				preLoaded = true;
			}

			if (!context.stateApp.loaded) {
				if (postPending === undefined) postPending = assetNameList;
				if (postPending.length > 0) {
					const { loaded, failed } = await loadAssets(postPending);
					context.stateApp.loadedAssets = { ...context.stateApp.loadedAssets, ...loaded };
					postPending = failed;
					if (failed.length > 0) {
						context.stateApp.failedAssets = failed;
						return;
					}
				}
				context.stateApp.loaded = true;
			}
		} finally {
			running = false;
		}
	};

	$effect(() => {
		retryToken; // a retry tap re-enters run(); `running` guards genuine re-entry
		if (!context.stateApp.loaded) void run();
	});

	onMount(() => {
		context.stateApp.retryFailedAssets = () => {
			if (context.stateApp.failedAssets.length === 0) return;
			context.stateApp.failedAssets = [];
			// read-modify-write of shared $state — untracked so it can never subscribe a caller
			untrack(() => (retryToken += 1));
		};
		return () => {
			context.stateApp.retryFailedAssets = undefined;
		};
	});
</script>

{#if preLoaded}
	{@render props.children()}
{/if}
