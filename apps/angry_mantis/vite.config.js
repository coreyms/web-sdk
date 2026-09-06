// @ts-ignore
import config from 'config-vite';

const base = config();
const spineStub = new URL('./src/spineStub.ts', import.meta.url).pathname;

// Angry Mantis loads no Spine assets; pixi-svelte's top-level spine import would
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
	// A plugin hook rather than a package.json step because `vite build` does not exit on its own here.
	plugins: [
		...(base.plugins ?? []),
		{ name: 'angry-mantis-prune-build', closeBundle: { sequential: true, order: 'post', handler: () => pruneBuild(new URL('./build/', import.meta.url).pathname) } },
	],
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
