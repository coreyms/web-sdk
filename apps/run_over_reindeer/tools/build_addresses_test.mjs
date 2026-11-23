// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/{scripts/build-addresses.mjs,scripts/check-production-bundle.mjs,src/game/assets.ts,src/game/assetStamp.ts,src/app.html,scripts/prune-build.mjs}; sweepAddresses, stamp, import.meta.url
// THE BUILD'S ADDRESSES TEST (2026-11-23): node only, no browser. Run it after a build:
//   node scripts/stamp-assets.mjs && pnpm build && node tools/build_addresses_test.mjs      (from apps/run_over_reindeer)
//   BUILD=<dir> node tools/build_addresses_test.mjs                                          (another build folder)
// 1. THE BUILD (./build): every address the built game can ask the network for (scripts/build-addresses.mjs: new
//    URL(..., import.meta.url), the stamped /assets/ paths, the stamp table, the page's links, stylesheets, the JSON
//    data's file names, written-out fetch / import / worker calls) is resolved as a browser would with the game at
//    file:///x/y/game/ (the bundle at file:///x/y/game/_app/immutable/bundle.js), stays inside that folder, and names a
//    file the build has.
// 2. THE GUARD ITSELF: a small made-up build that is right passes; the same build with one fault planted fails, with
//    that fault named, for each fault it must catch (a climb of three folders from the bundle, a file that is not
//    there, a root address in a script, in the page, in a stylesheet and in a data file, an import.meta.url the sweep
//    cannot read, a table key with no file). A guard that stops seeing one of these fails here.
// Pass: every line PASS, "0 fail" and exit 0.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const { sweepAddresses, problemLines, GAME_AT } = await import(pathToFileURL(join(APP, 'scripts', 'build-addresses.mjs')).href);

let pass = 0;
let fail = 0;
const check = (ok, what, detail) => {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${!ok && detail !== undefined ? '\n' + (Array.isArray(detail) ? detail.join('\n') : JSON.stringify(detail).slice(0, 600)) : ''}`);
};

// ---- 1. the build ----
const BUILD = process.env.BUILD || join(APP, 'build');
if (!existsSync(join(BUILD, 'index.html'))) {
	check(false, `a build at ${BUILD} (run: node scripts/stamp-assets.mjs && pnpm build)`);
} else {
	const r = sweepAddresses(BUILD);
	console.log(`  the build: ${r.checked} addresses in ${r.files} files (${Object.entries(r.byKind).map(([k, n]) => `${k} ${n}`).join(', ')}), the game at ${GAME_AT}`);
	check(r.problems.length === 0, `the build: every address stays inside the game's folder and names a file in the build (${r.checked} read)`, problemLines(r.problems));
	const bundle = r.list.filter((e) => e.kind === 'bundle');
	check(bundle.length > 0 && bundle.every((e) => e.ok && e.target.startsWith('assets/')), `the build: ${bundle.length} new URL(..., import.meta.url) addresses, each resolved from _app/immutable/ into assets/`, bundle.filter((e) => !e.ok).map((e) => e.raw));
	check((r.byKind.table ?? 0) > 0 && (r.byKind.page ?? 0) >= 2 && (r.byKind.stamped ?? 0) > 0, `the build: the stamp table (${r.byKind.table}), the page's own links (${r.byKind.page}) and the stamped paths (${r.byKind.stamped}) were all found`, r.byKind);
}

// ---- 2. the guard, on a made-up build ----
const HELPER = 'Ee=s=>{const e=s.split("/assets/").pop()??"",t=T1[e],n=s.startsWith("/assets/")?s.slice(1):s;return t?`${n}?v=${t}`:n}';
const make = ({ js = '', html = '', css = '', json = null, table = '"a/x.webp":"deadbeef","a/y-phone.webp":"deadbee0"', skip = [], helper = true } = {}) => {
	const dir = mkdtempSync(join(tmpdir(), 'ror-addresses-'));
	const w = (p, text) => {
		mkdirSync(dirname(join(dir, p)), { recursive: true });
		writeFileSync(join(dir, p), text);
	};
	w('index.html', `<!doctype html><link rel="icon" href="./favicon.png"><script>var boot={js:'./_app/immutable/bundle.js',css:'./_app/immutable/assets/bundle.css'};</script>${html}`);
	w('favicon.png', 'x');
	w('_app/immutable/assets/bundle.css', `.a{color:red}${css}`);
	w('_app/immutable/bundle.js', helper ? `const T1={${table}},${HELPER};const A=new URL("../../assets/a/x.webp",import.meta.url).href,B=Ee("/assets/a/x.webp"),C=k=>Ee(\`/assets/a/y-\${k}.webp\`),D=f=>Ee(\`/assets/\${f.file}\`);${js}` : `const A=new URL("../../assets/a/x.webp",import.meta.url).href;${js}`);
	for (const f of ['assets/a/x.webp', 'assets/a/y-phone.webp', 'assets/a/atlas.webp']) if (!skip.includes(f)) w(f, 'x');
	w('assets/a/atlas.json', JSON.stringify(json ?? { meta: { image: 'atlas.webp' }, src: ['./assets/a/x.webp?v=1'] }));
	return dir;
};
const run = (name, opts, want) => {
	const dir = make(opts);
	const r = sweepAddresses(dir);
	rmSync(dir, { recursive: true, force: true });
	if (want === null) return check(r.problems.length === 0, `guard: ${name}: passes (${r.checked} addresses)`, problemLines(r.problems));
	const hit = r.problems.filter((p) => want.test(`${p.kind} ${p.raw} ${p.why}`));
	check(hit.length > 0, `guard: ${name}: caught (${hit[0] ? `${hit[0].kind} ${hit[0].raw}: ${hit[0].why}` : 'NOT CAUGHT'})`, problemLines(r.problems));
};
run('a right build', {}, null);
run('three folders up from the bundle (the sister game\'s fault)', { js: 'const X=new URL("../../../assets/a/x.webp",import.meta.url).href;' }, /bundle \.\.\/\.\.\/\.\.\/assets\/a\/x\.webp .*climbs out of the game's folder/);
run('a bundle address whose file is not in the build', { js: 'const X=new URL("../../assets/a/gone.webp",import.meta.url).href;' }, /bundle .*gone\.webp .*no file assets\/a\/gone\.webp/);
run('a root address in a script, not through the stamp helper', { js: 'const X=load("/assets/a/x.webp");' }, /root \/assets\/a\/x\.webp .*root address/);
run('a root address fetched', { js: 'fetch("/assets/a/x.webp");' }, /\/assets\/a\/x\.webp .*root address/);
run('a root _app address', { js: 'const X="/_app/version.json";' }, /root \/_app\/version\.json/);
run('a root address of any other file', { js: 'const X=new Audio("/sounds/hit.mp3");' }, /root \/sounds\/hit\.mp3 .*root address/);
run('a stamped path whose file is not in the build', { js: 'const X=Ee("/assets/a/nope.webp");' }, /stamped .*nope\.webp .*no file assets\/a\/nope\.webp/);
run('a stamped template no file matches', { js: 'const X=k=>Ee(`/assets/a/z-${k}.webp`);' }, /stamped .*z-\*\.webp .*no file in the build matches/);
run('a stamp table key with no file', { skip: ['assets/a/y-phone.webp'] }, /a\/y-phone\.webp .*no file/);
run('an import.meta.url the sweep cannot read', { js: 'const X=p=>new URL(p,import.meta.url).href;' }, /bundle .*cannot read/);
run('a page-relative address that climbs', { js: 'const X=img("../assets/a/x.webp");' }, /page \.\.\/assets\/a\/x\.webp .*climbs out/);
run('a root address in the page', { html: '<script type="module" src="/_app/immutable/bundle.js"></script>' }, /page \/_app\/immutable\/bundle\.js .*root address in the page/);
run('a stylesheet that climbs out', { css: '.b{background:url(../../../../assets/a/x.webp)}' }, /css .*climbs out/);
run('a stylesheet with a root address', { css: '.b{background:url(/assets/a/x.webp)}' }, /css \/assets\/a\/x\.webp .*root or outside address/);
run('a data file naming a picture that is not there', { json: { meta: { image: 'atlas-2.webp' } } }, /json atlas-2\.webp .*no file assets\/a\/atlas-2\.webp/);
run('a data file with a root address', { json: { src: ['/assets/a/x.webp'] } }, /json \/assets\/a\/x\.webp .*root address in a data file/);
run('a script whose /assets/ paths go through a helper the sweep does not know', { helper: false, js: 'const st=s=>s.slice(1),X=st("/assets/a/x.webp");' }, /stamp helper was not found/);
console.log(`build_addresses_test: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
