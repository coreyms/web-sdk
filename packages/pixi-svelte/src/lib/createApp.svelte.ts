import * as PIXI from 'pixi.js';

import type { LoadedAssets, Assets } from './types';

export function createApp({ assets }: { assets: Assets }) {
	const reset = () => {
		stateApp.loaded = false;
		stateApp.preLoaded = false;
		stateApp.loadingProgress = 0;
		stateApp.loadedAssets = {};
		stateApp.failedAssets = [];
		stateApp.pixiApplication = undefined as PIXI.Application | undefined;
	};

	const stateApp = $state({
		reset,
		assets,
		loaded: false,
		// true once every `preload: true` asset is in; the remaining keys keep loading in the
		// background and `loaded` flips when they are in too. A game can open its landing on this
		// and gate only the features that need the deferred keys on `loaded`.
		preLoaded: false,
		// 0..100 over the preload phase, then pinned to 100 while the deferred phase runs
		loadingProgress: 0,
		loadedAssets: {} as LoadedAssets,
		// Assets that exhausted their retries in AssetsLoader. Non-empty means the load is STOPPED,
		// not finished — `loaded` stays false and the app's loading screen should offer a retry.
		failedAssets: [] as string[],
		// Set by AssetsLoader while it is mounted: re-runs only the failed keys.
		retryFailedAssets: undefined as (() => void) | undefined,
		pixiApplication: undefined as PIXI.Application | undefined,
	});

	return {
		stateApp,
	};
}

export type App = ReturnType<typeof createApp>;
