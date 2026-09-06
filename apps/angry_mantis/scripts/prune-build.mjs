// The site is built with bundleStrategy 'inline' (config-svelte): build/index.html carries the whole
// app as inline <script>/<style>. SvelteKit still emits the un-inlined copies under
// build/_app/immutable (≈1.2 MB of JS + CSS no client ever fetches — the only mentions inside
// index.html are `import.meta.url` fallbacks that use the chunk's PATH as a base for asset URLs,
// never as a request). They only inflate the upload Stake measures against its size guidance
// (review 2026-09-05). Removed after the build; _app/version.json and env.js stay (SvelteKit polls
// version.json). Guard: a real <script src>/<link href> into _app/ leaves everything in place.
import { readFileSync, existsSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const pruneBuild = (build) => {
	const index = join(build, 'index.html');
	const immutable = join(build, '_app', 'immutable');
	if (!existsSync(index) || !existsSync(immutable)) return;
	const html = readFileSync(index, 'utf8');
	if (/<(script|link)[^>]+(src|href)=["'][^"']*_app\//.test(html)) {
		console.log('[prune-build] index.html loads from _app/: left in place');
		return;
	}
	const size = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((n, d) => n + (d.isDirectory() ? size(join(dir, d.name)) : statSync(join(dir, d.name)).size), 0);
	const bytes = size(immutable);
	rmSync(immutable, { recursive: true, force: true });
	console.log(`[prune-build] removed build/_app/immutable (${(bytes / 1024 / 1024).toFixed(2)} MB of un-inlined chunks)`);
};

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
	pruneBuild(new URL('../build/', import.meta.url).pathname);
}
