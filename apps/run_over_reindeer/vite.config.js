// @ts-ignore
import config from 'config-vite';

const base = config();
const spineStub = new URL('./src/spineStub.ts', import.meta.url).pathname;

// Run Over Reindeer loads no Spine assets; pixi-svelte's top-level spine import would
// otherwise ship the whole @esotericsoftware runtime in the bundle (licence-bearing
// dead weight). See src/spineStub.ts.
import { readFileSync } from 'node:fs';
import { pruneBuild } from './scripts/prune-build.mjs';
import { productionStripPlugin } from './scripts/production-strip.mjs';
import { loadEnv } from 'vite';

// the version shown in Game Info → Version comes from package.json at build time (never a
// hand-typed string; review 2026-09-05)
const APP_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

// a production build (no PUBLIC_STAGING=1) leaves the `?rescap=` column densities out: their files, their stamp table keys
// and their spec tiers (scripts/production-strip.mjs; Corey 2026-11-23 "CC1"). A staging build keeps them.
const BUILD_DIR = new URL('./build/', import.meta.url).pathname;
const productionStrip = productionStripPlugin({ loadEnv, build: BUILD_DIR });

export default {
	...base,
	// after adapter-static has written build/: drop the un-inlined chunk copies (scripts/prune-build.mjs).
	// A plugin hook rather than a package.json step because `vite build` did not exit on its own then (fixed by the
	// Sass api below, 2026-10-23).
	plugins: [
		productionStrip,
		...(base.plugins ?? []),
		{
			name: 'run-over-reindeer-prune-build',
			closeBundle: {
				sequential: true,
				order: 'post',
				handler: () => {
					pruneBuild(BUILD_DIR);
					productionStrip.stripBuilt();
				},
			},
		},
	],
	// Sass runs one-shot ('modern'), not config-vite's long-lived 'modern-compiler' (Corey 2026-10-23: "Yes"). Nothing
	// disposes that compiler after a production build, so its two child processes kept node alive: `vite build` never
	// exited on the Mac and ended with status 1 on decimus. The compiled CSS is byte-identical (bundle.PASbv4QW.css).
	css: {
		...(base.css ?? {}),
		preprocessorOptions: {
			...(base.css?.preprocessorOptions ?? {}),
			scss: { ...(base.css?.preprocessorOptions?.scss ?? {}), api: 'modern' },
		},
	},
	define: { ...(base.define ?? {}), __APP_VERSION__: JSON.stringify(APP_VERSION) },
	resolve: {
		...(base.resolve ?? {}),
		alias: {
			...(base.resolve?.alias ?? {}),
			'@esotericsoftware/spine-pixi-v8': spineStub,
		},
	},
	optimizeDeps: {
		...(base.optimizeDeps ?? {}),
		exclude: [...(base.optimizeDeps?.exclude ?? []), '@esotericsoftware/spine-pixi-v8'],
	},
};
