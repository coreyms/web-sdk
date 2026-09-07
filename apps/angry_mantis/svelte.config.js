// @ts-ignore
import config from 'config-svelte';

/** Stake serves the game at https://<team>.live.engine.io/<game>/v<n>/ (any path, no index.html).
 *  With the default pathname router SvelteKit matches that path against the app's routes, finds
 *  nothing, logs "Not found: /<game>/v<n>/" and mounts its 404 page inside the layout on every
 *  launch (seen on the first engine.io publish, 2026-09-07). Hash routing ignores the pathname, so
 *  the single shell resolves wherever the build is hosted. Hash routing has no prerendering, so
 *  the shell is written as adapter-static's fallback page instead of a prerendered "/". */
const base = config({ adapter: { fallback: 'index.html' } });

export default { ...base, kit: { ...base.kit, router: { type: 'hash' } } };
