// @ts-nocheck — node build script, not app code (svelte-check picks up .mjs files)
// POST-BUILD SHELL REWRITE (2026-09-15).
//
// The site used to be built with bundleStrategy 'inline' (config-svelte): build/index.html carried
// the whole app as one ~1.2 MB inline <script>. The body held only the mount point, so NOTHING
// painted until that entire file had downloaded AND executed — 43 s to the first pixel on Chrome's
// Slow 4G. It is now bundleStrategy 'single' (svelte.config.js): one external module plus one
// stylesheet, and src/app.html paints a static PolyMath splash from the head's own CSS while that
// module streams in behind it.
//
// Three things have to happen to the kit's generated index.html for that to work:
//   1. the <link rel="stylesheet"> comes OUT of <head>. A render-blocking stylesheet would hold the
//      splash's first paint hostage to a 55 KB file; the shell's bootstrap injects it instead.
//   2. the kit's own starter <script> (which does `import(bundle).then(app => app.start(el))`) comes
//      out, because the bootstrap fetches that same module with a streaming reader so the green bar
//      can report real bytes, then executes the text itself.
//   3. every URL the kit wrote root-absolute ("/_app/…", "/favicon.svg") becomes document-relative.
//      Stake serves the game at https://<team>.cdn.stake-engine.com/<game>/<version>/, where a
//      leading slash resolves against the CDN root and 404s (seen on the first engine.io publish,
//      2026-09-07). The inline strategy never hit this because it shipped no URLs at all.
// The extracted values are handed to the shell as window.__AM_BOOT.
//
// It also drops anything under _app/immutable that index.html and the bundle do not reference
// (SvelteKit emits a second, unused copy of the layout CSS), so the upload Stake measures against
// its size guidance carries no dead weight (review 2026-09-05).
//
// EVERY step is guarded: if a pattern does not match, index.html is left exactly as the kit wrote
// it and the build still works — the shell's bootstrap no-ops without __AM_BOOT and the kit's own
// starter runs. You lose the bundle-phase progress, not the game. The warning says so.
import { readFileSync, writeFileSync, existsSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const walk = (dir) =>
	readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
		d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
	);

export const pruneBuild = (build) => {
	const indexPath = join(build, 'index.html');
	const immutable = join(build, '_app', 'immutable');
	if (!existsSync(indexPath) || !existsSync(immutable)) return;

	let html = readFileSync(indexPath, 'utf8');

	const cssMatch = /[ \t]*<link href="([^"]+\.css)" rel="stylesheet">\n?/.exec(html);
	const jsMatch = /[ \t]*<link rel="modulepreload" href="([^"]+\.js)">\n?/.exec(html);
	// the kit's starter, e.g.  <script> { __sveltekit_h8yxbw = {…}; … import("/_app/…").then(…) } </script>
	const starterMatch = /[ \t]*<script>\s*\{\s*(__sveltekit_[a-z0-9]+)\s*=[\s\S]*?<\/script>\n?/.exec(html);

	if (!cssMatch || !jsMatch || !starterMatch) {
		console.warn(
			'[prune-build] index.html does not look like a bundleStrategy:"single" shell ' +
				`(css=${!!cssMatch} js=${!!jsMatch} starter=${!!starterMatch}) — left as-is; ` +
				'the splash will run without bundle-phase progress.',
		);
		return;
	}

	const rel = (href) => (href.startsWith('/') ? `.${href}` : href);
	const js = rel(jsMatch[1]);
	const css = rel(cssMatch[1]);
	const kitVar = starterMatch[1];
	const jsBytes = statSync(join(build, jsMatch[1].replace(/^\//, ''))).size;
	const cssBytes = statSync(join(build, cssMatch[1].replace(/^\//, ''))).size;
	// The green bar spans BOTH phases — the bundle download and then the landing assets
	// (game/boot.svelte.ts) — so it needs the full denominator from its very first frame, or it
	// reaches 99 % on the bundle alone and then snaps back to 50 % when the app reports its own
	// total (seen on the first throttled run, 2026-09-15). scripts/stamp-assets.mjs already measured
	// those files; read its output rather than keeping a second copy of the list here.
	let assetBytes = 0;
	let preloadBytes = 0;
	let audioBytes = 0;
	try {
		const stampTs = readFileSync(join(build, '..', 'src', 'game', 'assetStamp.ts'), 'utf8');
		const sizes = /export const landingSizes = (\{[\s\S]*?\n\}) as const;/.exec(stampTs);
		if (sizes) assetBytes = Object.values(JSON.parse(sizes[1])).reduce((a, b) => a + b, 0);
		const phases = /export const bootSizes = (\{[^}]*\}) as const;/.exec(stampTs);
		if (phases) ({ preload: preloadBytes, audio: audioBytes } = JSON.parse(phases[1]));
	} catch {
		/* the bar just weights the bundle alone */
	}

	html = html.replace(cssMatch[0], '').replace(jsMatch[0], '').replace(starterMatch[0], '');

	// __AM_BOOT has to exist before the shell's bootstrap IIFE runs, and the bootstrap sits right
	// after the splash markup so the splash parses first — so this goes immediately before it.
	const anchor = html.indexOf('/* ── splash fit');
	const insertAt = anchor >= 0 ? html.lastIndexOf('<script>', anchor) : -1;
	if (insertAt < 0) {
		console.warn('[prune-build] could not find the shell bootstrap in index.html — left as-is');
		return;
	}
	const bootTag =
		`<script>window.__AM_BOOT=${JSON.stringify({ js, css, jsBytes, cssBytes, assetBytes, preloadBytes, audioBytes, kitVar })};</script>\n\t\t`;
	html = html.slice(0, insertAt) + bootTag + html.slice(insertAt);

	// root-absolute leftovers from app.html's %sveltekit.assets% (favicon, and anything else)
	html = html.replace(/(\s(?:href|src)=")\/(?!\/)/g, '$1./');

	writeFileSync(indexPath, html);

	// drop un-referenced emitted chunks (SvelteKit writes an extra, unused layout CSS)
	const bundleText = readFileSync(join(build, jsMatch[1].replace(/^\//, '')), 'utf8');
	let freed = 0;
	for (const file of walk(immutable)) {
		const name = relative(immutable, file).split('/').pop();
		if (file.endsWith(jsMatch[1].replace(/^\//, '').split('/').pop())) continue;
		if (html.includes(name) || bundleText.includes(name)) continue;
		freed += statSync(file).size;
		rmSync(file);
	}

	console.log(
		`[prune-build] shell rewired: ${js} (${(jsBytes / 1024).toFixed(0)} KB) + ${css} ` +
			`(${(cssBytes / 1024).toFixed(0)} KB), index.html ${html.length} B` +
			(freed ? `, dropped ${(freed / 1024).toFixed(0)} KB of unreferenced chunks` : ''),
	);
};

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
	pruneBuild(new URL('../build/', import.meta.url).pathname);
}
