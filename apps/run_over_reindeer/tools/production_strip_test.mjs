// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/{scripts/production-strip.mjs,scripts/check-production-bundle.mjs,vite.config.js,src/game/columnClipSpec.ts,src/game/assetStamp.ts,scripts/stamp-assets.mjs,src/fixtures/fixtureRgs.ts}; STAGING_ONLY_FILE, stagingOnlyFiles, stripColumnSpec, stripStampTable, sameBookAs
// THE PRODUCTION STRIP TEST (2026-11-23, Corey "CC1"): node only, no browser. From apps/run_over_reindeer:
//   node --experimental-strip-types --no-warnings tools/production_strip_test.mjs
//   (after a build it also reads ./build; BUILD=<dir> for another build folder)
// 1. THE RULE: which files are staging only (the `?rescap=` column densities) and which are not, and that the rule
//    names exactly the d150 / d215 files the column spec has, and every one of them is in static/assets/columns.
// 2. THE TRANSFORMS on the real generated files: src/game/columnClipSpec.ts loses its d150 / d215 tiers and nothing
//    else (the phone and full tiers byte for byte the same values); src/game/assetStamp.ts loses exactly the staging
//    only keys from both tables (scripts/stamp-assets.mjs must have run).
// 3. THE CHECK ITSELF (scripts/check-production-bundle.mjs, run as the deployer runs it) on a small made-up build: right
//    passes; one planted density file fails it, named (a clip's sheet, the cloud still); a staging build with them
//    passes --expect-staging; a showcase book field or a local path in the bundle fails it. stripBuild() takes the
//    planted files out and leaves the rest.
// 4. THE BUILD (./build, when there is one): a production build has no staging only file; a staging build has them all.
// Pass: every line PASS, "0 fail" and exit 0.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const strip = await import(pathToFileURL(join(APP, 'scripts', 'production-strip.mjs')).href);
const CHECK = join(APP, 'scripts', 'check-production-bundle.mjs');
const { STAGING_MARKERS } = await import(pathToFileURL(CHECK).href);

let pass = 0;
let fail = 0;
const check = (ok, what, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${!ok && detail !== undefined ? '\n' + JSON.stringify(detail).slice(0, 600) : ''}`);
};

// ---- 1. the rule ----
const yes = ['columns/reindeer-idle-d150-0.webp', 'columns/grandma-win-d215-12.webp', 'columns/cloud-backdrop-d150.webp', 'columns/cloud-backdrop-d215.webp'];
const no = ['columns/reindeer-idle-0.webp', 'columns/reindeer-idle-phone-0.webp', 'columns/cloud-backdrop.webp', 'columns/cloud-backdrop-phone.webp', 'columns/landing-stills.webp', 'reindeer/roam2-full-0.webp', 'scene/x-d150-0.webp', 'columns/reindeer-idle-d150-0.png'];
check(yes.every(strip.isStagingOnlyFile), 'the rule: the density sheets and the cloud stills at d150 and d215 are staging only', yes.filter((f) => !strip.isStagingOnlyFile(f)));
check(!no.some(strip.isStagingOnlyFile), 'the rule: the phone and full sheets, the other folders and other types are not', no.filter(strip.isStagingOnlyFile));

const specText = readFileSync(join(APP, 'src', 'game', 'columnClipSpec.ts'), 'utf8');
const specFiles = [...specText.matchAll(/"file": "([^"]+)"/g)].map((m) => m[1]);
const specDensity = new Set(specFiles.filter((f) => /-d(?:150|215)\b/.test(f)));
const columnsDir = join(APP, 'static', 'assets', 'columns');
const onDisk = new Set(readdirSync(columnsDir).map((f) => `columns/${f}`).filter(strip.isStagingOnlyFile));
check(specDensity.size > 0 && [...specDensity].every(strip.isStagingOnlyFile), `the rule names every d150 / d215 file of the column spec (${specDensity.size})`, [...specDensity].filter((f) => !strip.isStagingOnlyFile(f)));
check(specFiles.filter((f) => !specDensity.has(f)).every((f) => !strip.isStagingOnlyFile(f)), 'the rule names no phone or full file of the column spec');
check(onDisk.size === specDensity.size && [...specDensity].every((f) => onDisk.has(f)), `static/assets/columns has exactly those files (${onDisk.size} on disk, ${specDensity.size} in the spec)`, { missing: [...specDensity].filter((f) => !onDisk.has(f)).slice(0, 5), extra: [...onDisk].filter((f) => !specDensity.has(f)).slice(0, 5) });

// ---- 2. the transforms ----
const read = (text, head) => {
	const at = text.indexOf(head) + head.length;
	return JSON.parse(text.slice(at, text.indexOf('\n} as const;', at) + 2));
};
const before = read(specText, 'export const COLUMN_CLIPS = ');
const strippedText = strip.stripColumnSpec(specText);
const after = read(strippedText, 'export const COLUMN_CLIPS = ');
check(!/d150|d215/.test(strippedText.slice(strippedText.indexOf('export const COLUMN_CLIPS'))), 'columnClipSpec: no d150 or d215 left in the module text');
const keep = (spec) => {
	const tiers = (t) => ({ full: t.full, phone: t.phone });
	return { ...spec, tierScale: tiers(spec.tierScale), backdrop: { ...spec.backdrop, tiers: tiers(spec.backdrop.tiers) }, clips: Object.fromEntries(Object.entries(spec.clips).map(([k, clips]) => [k, Object.fromEntries(Object.entries(clips).map(([n, c]) => [n, { ...c, tiers: tiers(c.tiers) }]))])) };
};
check(JSON.stringify(after) === JSON.stringify(keep(before)), 'columnClipSpec: everything else (the phone and full tiers, the clips, the landing stills) is unchanged');
check(strippedText.startsWith(specText.slice(0, specText.indexOf('export const COLUMN_CLIPS'))) && strippedText.trimEnd().endsWith('} as const;'), 'columnClipSpec: the module around the object is unchanged');

const stampText = readFileSync(join(APP, 'src', 'game', 'assetStamp.ts'), 'utf8');
const stamps = read(stampText, 'export default ');
const bytes = read(stampText, 'export const fileBytes = ');
const stampOut = strip.stripStampTable(stampText);
const stamps2 = read(stampOut, 'export default ');
const bytes2 = read(stampOut, 'export const fileBytes = ');
const gone = Object.keys(stamps).filter((k) => !(k in stamps2));
check(gone.length === onDisk.size && gone.every(strip.isStagingOnlyFile), `assetStamp: the hash table loses exactly the ${onDisk.size} staging only keys (${gone.length} gone)`, gone.slice(0, 5));
check(Object.keys(bytes).length - Object.keys(bytes2).length === onDisk.size && !Object.keys(bytes2).some(strip.isStagingOnlyFile), 'assetStamp: fileBytes loses the same keys');
check(Object.entries(stamps2).every(([k, v]) => stamps[k] === v) && stampOut.includes('export const landingSizes = ') && stampOut.includes('export const bootSizes = '), 'assetStamp: every other key keeps its value, the other exports are there');
let threw = false;
try {
	strip.stripColumnSpec('export const SOMETHING_ELSE = {};');
} catch {
	threw = true;
}
check(threw, 'a generated file of another shape stops the build (never a silent pass)');

// ---- 3. the check itself, on a made-up build ----
const HELPER = 'Ee=s=>{const e=s.split("/assets/").pop()??"",t=T1[e],n=s.startsWith("/assets/")?s.slice(1):s;return t?`${n}?v=${t}`:n}';
const make = ({ js = '', plant = [] } = {}) => {
	const dir = mkdtempSync(join(tmpdir(), 'ror-strip-'));
	const w = (p, text) => {
		mkdirSync(dirname(join(dir, p)), { recursive: true });
		writeFileSync(join(dir, p), text);
	};
	w('index.html', `<!doctype html><link rel="icon" href="./favicon.png"><script>var boot={js:'./_app/immutable/bundle.js',css:'./_app/immutable/assets/bundle.css'};</script>`);
	w('favicon.png', 'x');
	w('_app/immutable/assets/bundle.css', '.a{color:red}');
	w('_app/immutable/bundle.js', `const T1={"columns/a-0.webp":"deadbeef"},${HELPER};const A=new URL("../../assets/columns/a-0.webp",import.meta.url).href,B=Ee("/assets/columns/a-0.webp");${js}`);
	w('assets/columns/a-0.webp', 'x');
	for (const f of plant) w(`assets/${f}`, 'x');
	return dir;
};
const runCheck = (dir, flags = []) => {
	const r = spawnSync(process.execPath, [CHECK, dir, ...flags], { encoding: 'utf8' });
	return { status: r.status, out: `${r.stdout}${r.stderr}` };
};
const STAGING_JS = `const M=[${STAGING_MARKERS.map((m) => JSON.stringify(m)).join(',')}];`;
const cases = [
	['a right production build', {}, [], 0, /PASS/],
	['a production build with a clip sheet at d150', { plant: ['columns/reindeer-idle-d150-3.webp'] }, [], 1, /staging only file.*\n\s+assets\/columns\/reindeer-idle-d150-3\.webp/],
	['a production build with the cloud still at d215', { plant: ['columns/cloud-backdrop-d215.webp'] }, [], 1, /assets\/columns\/cloud-backdrop-d215\.webp/],
	['a staging build with the densities (--expect-staging)', { js: STAGING_JS, plant: ['columns/reindeer-idle-d150-3.webp', 'columns/cloud-backdrop-d215.webp'] }, ['--expect-staging'], 0, /staging build confirmed.*2 staging only files/],
	['a production build carrying the showcase books', { js: 'const R=[{name:"plain_line_win",sameBookAs:null}];' }, [], 1, /sameBookAs/],
	['a production build carrying a Desktop path', { js: 'const L={file:"x.webp",note:"~/Desktop/Run Over Reindeer/x.png"};' }, [], 1, /Desktop\//],
	['a production build carrying a /Users/ path', { js: 'const L="/Users/someone/x.png";' }, [], 1, /\/Users\//],
	['a staging build carrying a local path (--expect-staging)', { js: `${STAGING_JS}const L="~/Desktop/x.png";` }, ['--expect-staging'], 1, /dev server only code found \(Desktop\/\)/],
];
for (const [name, opts, flags, want, re] of cases) {
	const dir = make(opts);
	const r = runCheck(dir, flags);
	rmSync(dir, { recursive: true, force: true });
	check(r.status === want && re.test(r.out), `check: ${name}: exit ${r.status} (want ${want})`, r.out.split('\n').slice(0, 6));
}
{
	const dir = make({ plant: ['columns/reindeer-idle-d150-3.webp', 'columns/cloud-backdrop-d215.webp'] });
	const r = strip.stripBuild(dir);
	const left = strip.stagingOnlyFiles(dir);
	const kept = existsSync(join(dir, 'assets', 'columns', 'a-0.webp'));
	const after2 = runCheck(dir);
	rmSync(dir, { recursive: true, force: true });
	check(r.files === 2 && left.length === 0 && kept && after2.status === 0, `stripBuild: the planted files go (${r.files}), the rest stays, the check then passes`, { r, left, kept, out: after2.out });
}

// ---- 4. the build ----
const BUILD = process.env.BUILD || join(APP, 'build');
const bundleDir = join(BUILD, '_app', 'immutable');
if (!existsSync(join(BUILD, 'index.html')) || !existsSync(bundleDir)) console.log(`  (no build at ${BUILD}: part 4 skipped)`);
else {
	const js = readdirSync(bundleDir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(bundleDir, f), 'utf8')).join('\n');
	const staging = js.includes('ROR_STAGING_BUILD');
	const found = strip.stagingOnlyFiles(BUILD);
	if (staging) check(found.length === onDisk.size, `the build (staging): all ${onDisk.size} density files are in it (${found.length})`);
	else {
		check(found.length === 0, `the build (production): no staging only file in it (${found.length})`, found.slice(0, 5));
		check(!/-d(?:150|215)-\d+\.webp|cloud-backdrop-d(?:150|215)/.test(js), 'the build (production): no density file name in its bundle');
		check(!js.includes('sameBookAs'), 'the build (production): no showcase book in its bundle');
	}
}
console.log(`production_strip_test: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
