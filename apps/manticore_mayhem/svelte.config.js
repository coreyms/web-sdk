// @ts-ignore
import config from 'config-svelte';

/** Stake serves the game at https://<team>.live.engine.io/<game>/v<n>/ (any path, no index.html).
 *  With the default pathname router SvelteKit matches that path against the app's routes, finds
 *  nothing, logs "Not found: /<game>/v<n>/" and mounts its 404 page inside the layout on every
 *  launch (seen on the first engine.io publish, 2026-09-07). Hash routing ignores the pathname, so
 *  the single shell resolves wherever the build is hosted. Hash routing has no prerendering, so
 *  the shell is written as adapter-static's fallback page instead of a prerendered "/". */
/*  bundleStrategy: config-svelte sets 'inline', which puts the whole ~1.2 MB app into index.html as
 *  one inline <script>. The body then holds nothing but the mount point, so the first pixel waits on
 *  the entire file downloading AND executing — 43 s on Chrome's Slow 4G (Corey, 2026-09-15). 'single'
 *  emits one external module + one stylesheet instead, so src/app.html can paint its own static
 *  PolyMath splash from the head's CSS immediately and stream the bundle behind it with a real
 *  progress bar. scripts/prune-build.mjs rewires the emitted shell for that (and makes the kit's
 *  root-absolute /_app/ URLs document-relative, which the inline strategy never had to care about). */
const base = config({ adapter: { fallback: 'index.html' } });

export default {
	...base,
	kit: { ...base.kit, output: { ...base.kit.output, bundleStrategy: 'single' }, router: { type: 'hash' } },
};
