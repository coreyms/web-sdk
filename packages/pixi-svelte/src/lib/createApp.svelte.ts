import * as PIXI from 'pixi.js';

import type { LoadedAssets, Assets } from './types';

export function createApp({ assets }: { assets: Assets }) {
	const reset = () => {
		stateApp.loaded = false;
		stateApp.loadingProgress = 0;
		stateApp.loadedAssets = {};
		stateApp.failedAssets = [];
		stateApp.pixiApplication = undefined as PIXI.Application | undefined;
	};

	const stateApp = $state({
		reset,
		assets,
		loaded: false,
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
