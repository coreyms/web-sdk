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
// DOM ids and attributes, query parameter names, button copy). Add one here whenever staging code grows. A marker
// may be a RegExp where the bare word is also in the game (match the staging code's own READ of it then). The
// Armoury's `?armoury=` switch and its regex marker went with the old menu at the switch-over (2026-10-14).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

export const STAGING_MARKERS = [
	'MM_STAGING_BUILD', // game/staging.ts: window.__mmBuild
	'__mmBuild',
	'MM_STAGING_PERF_READOUT', // staging/PerfReadout.svelte: the box's data attribute
	'mm-staging-perf', // staging/mountPerf.ts: the host element's id
	'mm-perf', // the readout's class (also catches any of its styles in a stylesheet)
	'worstFramesLater', // staging/PerfReadout.svelte: the copied report's worst-frame list (game/staging.ts perfMark feeds it)
	'Copy results', // the readout's button
	'rescap', // game/deviceTier.ts: the resolution cap override's query parameter
	'getHighEntropyValues', // staging/PerfReadout.svelte: nothing in the game asks for device details
];
/** strings that must be in NO build, production or staging: dev server only code (a staging build is not expected to
 *  carry them, so --expect-staging does not ask for them) */
export const NEVER_MARKERS = [
	'audiodiag', // ui/MenuButton.svelte: the iOS audio readout's query parameter, DEV only since 2026-10-21 (Corey "no longer needed")
];
/** strings the SHIPPED index.html must not carry, production or staging (Corey 2026-10-21 on src/app.html's developer
 *  comments: "they shouldn't be in the production or staging builds"; scripts/prune-build.mjs strips them). The
 *  tokenizer of prune-build also has to find no comment left (a `//` line comment has no safe plain-text marker). */
export const SHELL_MARKERS = [
	'<!--', // an HTML comment
	'/*', // a CSS or JS block comment (none of the shell's strings, regexes or font data URIs has one)
	'/Users/', // a local path
	'Desktop', // a local folder
];
/** a marker's name in the report */
const label = (m) => (typeof m === 'string' ? m : m.source);
/** where a marker is in a text, or -1 */
const find = (text, m) => (typeof m === 'string' ? text.indexOf(m) : text.search(m));
const TEXT = new Set(['.js', '.mjs', '.css', '.html', '.json', '.map', '.txt', '.svg']);

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));

/** the shipped shell's comment hits: the markers above, and any comment prune-build's tokenizer still finds */
export const scanShell = async (build) => {
	const hits = [];
	const text = readFileSync(join(build, 'index.html'), 'utf8');
	for (const m of SHELL_MARKERS) {
		const at = text.indexOf(m);
		if (at >= 0) hits.push({ file: 'index.html', marker: m, context: text.slice(Math.max(0, at - 40), at + 60).replace(/\s+/g, ' ') });
	}
	const { stripShellComments } = await import('./prune-build.mjs');
	const st = stripShellComments(text);
	const left = st.html ? st.removed.html + st.removed.css + st.removed.js : -1;
	if (left !== 0) hits.push({ file: 'index.html', marker: 'comment', context: left < 0 ? `the comment tokenizer failed: ${st.why}` : `${left} comments left (${JSON.stringify(st.removed)})` });
	return hits;
};

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
		for (const m of [...STAGING_MARKERS, ...NEVER_MARKERS]) {
			const at = find(text, m);
			const marker = label(m);
			if (at >= 0) hits.push({ file: relative(build, file), marker, context: text.slice(Math.max(0, at - 40), at + 60).replace(/\s+/g, ' ') });
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
	const shellHits = await scanShell(build);
	if (shellHits.length) {
		console.error(`[check-production-bundle] FAIL: the shipped index.html in ${build} carries developer comments or local paths. No build may carry them (scripts/prune-build.mjs strips them; did it warn?).`);
		for (const h of shellHits.slice(0, 20)) console.error(`  ${h.marker}  in ${h.file}:  ...${h.context}...`);
		process.exit(1);
	}
	if (expectStaging) {
		const missing = STAGING_MARKERS.map(label).filter((m) => !found.includes(m));
		const never = hits.filter((h) => NEVER_MARKERS.map(label).includes(h.marker));
		if (never.length) {
			console.error(`[check-production-bundle] --expect-staging: dev server only code found (${[...new Set(never.map((h) => h.marker))].join(', ')}); no build may carry it.`);
			process.exit(1);
		}
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
	console.log(`[check-production-bundle] PASS: no staging code in ${build} (${files} files, ${(bytes / 1024).toFixed(0)} KB scanned, ${STAGING_MARKERS.length + NEVER_MARKERS.length} markers; index.html has no comments).`);
}
