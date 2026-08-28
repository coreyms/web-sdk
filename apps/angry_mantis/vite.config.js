// @ts-ignore
import config from 'config-vite';

const base = config();
const spineStub = new URL('./src/spineStub.ts', import.meta.url).pathname;

// Angry Mantis loads no Spine assets; pixi-svelte's top-level spine import would
// otherwise ship the whole @esotericsoftware runtime in the bundle (licence-bearing
// dead weight). See src/spineStub.ts.
export default {
	...base,
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
