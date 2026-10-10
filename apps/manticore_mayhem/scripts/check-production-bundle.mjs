// @ts-nocheck — node build script, not app code (svelte-check picks up .mjs files)
// PRODUCTION BUNDLE CHECK (docs/device-quality-plan-v2-review.md S9). REQUIRED before every submission build
// is uploaded to Stake.
//
// The staging measurement tools (the `?rescap=` switch and the `?perf=1` readout, src/game/staging.ts and
// src/staging/) are compiled in only when the build was made with PUBLIC_STAGING=1. The only thing between
// that flag and Stake is whoever runs the build, so this script reads the build that was actually produced
// and FAILS (exit 1) if any trace of the staging code is in it:
//
//     node scripts/check-production-bundle.mjs [build dir, default ./build]
//
// With --expect-staging it checks the opposite (a staging build really has the tools; exit 1 if not), so
// the deployer can confirm the flag took.
//
// The markers are strings that exist ONLY in the staging code and survive minification (property names,
// DOM ids and attributes, query parameter names, button copy). Add one here whenever staging code grows.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

export const STAGING_MARKERS = [
	'MM_STAGING_BUILD', // game/staging.ts: window.__mmBuild
	'__mmBuild',
	'MM_STAGING_PERF_READOUT', // staging/PerfReadout.svelte: the box's data attribute
	'mm-staging-perf', // staging/mountPerf.ts: the host element's id
	'mm-perf', // the readout's class (also catches any of its styles in a stylesheet)
	'Copy results', // the readout's button
	'rescap', // game/deviceTier.ts: the resolution cap override's query parameter
	'getHighEntropyValues', // staging/PerfReadout.svelte: nothing in the game asks for device details
];
const TEXT = new Set(['.js', '.mjs', '.css', '.html', '.json', '.map', '.txt', '.svg']);

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));

export const scan = (build) => {
	const hits = [];
	let files = 0;
	let bytes = 0;
	for (const file of walk(build)) {
		// the game's art, audio and data are not code: only what a browser parses as text is scanned
		if (!TEXT.has(extname(file)) || relative(build, file).startsWith('assets/')) continue;
		const text = readFileSync(file, 'utf8');
		files += 1;
		bytes += statSync(file).size;
		for (const marker of STAGING_MARKERS) {
			const at = text.indexOf(marker);
			if (at >= 0) hits.push({ file: relative(build, file), marker, context: text.slice(Math.max(0, at - 40), at + marker.length + 40).replace(/\s+/g, ' ') });
		}
	}
	return { hits, files, bytes };
};

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
	const args = process.argv.slice(2);
	const expectStaging = args.includes('--expect-staging');
	const build = args.find((a) => !a.startsWith('--')) ?? new URL('../build/', import.meta.url).pathname;
	if (!existsSync(join(build, 'index.html'))) {
		console.error(`[check-production-bundle] no build at ${build} (index.html missing)`);
		process.exit(2);
	}
	const { hits, files, bytes } = scan(build);
	const found = [...new Set(hits.map((h) => h.marker))];
	if (expectStaging) {
		const missing = STAGING_MARKERS.filter((m) => !found.includes(m));
		if (missing.length) {
			console.error(`[check-production-bundle] --expect-staging: this is NOT a complete staging build. Missing: ${missing.join(', ')}. Was it built with PUBLIC_STAGING=1?`);
			process.exit(1);
		}
		console.log(`[check-production-bundle] staging build confirmed: all ${STAGING_MARKERS.length} markers present (${files} files, ${(bytes / 1024).toFixed(0)} KB scanned). DO NOT UPLOAD THIS BUILD TO STAKE.`);
		process.exit(0);
	}
	if (hits.length) {
		console.error(`[check-production-bundle] FAIL: staging code found in ${build}. This build must not be uploaded to Stake.`);
		for (const h of hits.slice(0, 20)) console.error(`  ${h.marker}  in ${h.file}:  ...${h.context}...`);
		console.error('Rebuild WITHOUT PUBLIC_STAGING (and without a turbo cache hit from a staging build: pnpm turbo run build --filter=manticore_mayhem... --force).');
		process.exit(1);
	}
	console.log(`[check-production-bundle] PASS: no staging code in ${build} (${files} files, ${(bytes / 1024).toFixed(0)} KB scanned, ${STAGING_MARKERS.length} markers).`);
}
