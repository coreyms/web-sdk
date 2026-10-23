// @ts-ignore
import config from 'config-vite';

const base = config();
const spineStub = new URL('./src/spineStub.ts', import.meta.url).pathname;

// Manticore Mayhem loads no Spine assets; pixi-svelte's top-level spine import would
// otherwise ship the whole @esotericsoftware runtime in the bundle (licence-bearing
// dead weight). See src/spineStub.ts.
import { readFileSync } from 'node:fs';
import { pruneBuild } from './scripts/prune-build.mjs';

// the version shown in Game Info → Version comes from package.json at build time (never a
// hand-typed string; review 2026-09-05)
const APP_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

export default {
	...base,
	// after adapter-static has written build/: drop the un-inlined chunk copies (scripts/prune-build.mjs).
	// A plugin hook rather than a package.json step because `vite build` did not exit on its own then (fixed by the
	// Sass api below, 2026-10-23).
	plugins: [
		...(base.plugins ?? []),
		{ name: 'manticore-mayhem-prune-build', closeBundle: { sequential: true, order: 'post', handler: () => pruneBuild(new URL('./build/', import.meta.url).pathname) } },
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
