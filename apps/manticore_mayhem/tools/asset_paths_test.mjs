// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// THE ASSET ADDRESS CHECK'S OWN TEST (scripts/check-asset-paths.mjs, 2026-11-24). No browser, no dev server.
//   node --experimental-strip-types --no-warnings tools/asset_paths_test.mjs
// 1. made-up builds: a right one passes; each wrong address fails with its own reason (a third '../', an absolute
//    path, a path not handed to stamp(), a file that is not in the build, an address that is not a literal, a
//    stylesheet's and the shell's addresses, an atlas without its picture)
// 2. made-up sources: '../../assets/' passes only in a file two folders deep; '/assets/' only inside stamp()
// 3. this app's sources: clean; the War Standard's sixteen files are written in game/bannerFiles.ts, two folders deep,
//    each names a file of static/assets/ui/banner, and game/banner/spec.ts writes no address itself
// 4. this app's build, if ./build is there (after `pnpm build`): clean, and every address the bundle writes from
//    import.meta.url, resolved from file:///srv/a/b/game/_app/immutable/<bundle>, is a file under /srv/a/b/game/
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scanBuiltAddresses, scanSourceAddresses, RAW_TABLES } from '../scripts/check-asset-paths.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const check = (name, ok, detail) => {
	if (!ok) failed += 1;
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail !== undefined ? `\n     ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
};
const tmp = mkdtempSync(join(tmpdir(), 'asset-paths-'));
const put = (root, files) => {
	for (const [rel, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, rel)), { recursive: true });
		writeFileSync(join(root, rel), text);
	}
	return root;
};

// ---- 1. made-up builds ----
const STAMP = 'const Q={},ee=r=>{const e=r.split("/assets/").pop()??"",t=Q[e],s=r.startsWith("/assets/")?r.slice(1):r;return t?`${s}?v=${t}`:s};';
const GOOD_JS = `${STAMP}const a=new URL("../../assets/ui/a.webp",import.meta.url).href,w=new Worker(new URL("workers/w-1.js",import.meta.url).href,import.meta.url),d=new URL("data:application/json;base64,e30=",import.meta.url).href,f=ee("/assets/fonts/f.woff2"),t=k=>ee(\`/assets/tiles/\${k}.webp\`),T={pic:"/assets/ui/table.webp",hero:k=>\`/assets/ui/hero-\${k}.webp\`};`;
const base = {
	'index.html': '<!doctype html><link rel="icon" href="./favicon.png"><script>window.__AM_BOOT={"js":"./_app/immutable/bundle.1.js","css":"./_app/immutable/assets/bundle.1.css"};</script>',
	'favicon.png': 'x',
	'_app/immutable/bundle.1.js': GOOD_JS,
	'_app/immutable/workers/w-1.js': 'self.onmessage=()=>{};',
	'_app/immutable/assets/bundle.1.css': '.a{background:url(data:image/png;base64,AAAA)}.b{background:url("assets/ui/a.webp")}',
	'assets/ui/a.webp': 'x',
	'assets/ui/table.webp': 'x',
	'assets/ui/hero-a.webp': 'x',
	'assets/fonts/f.woff2': 'x',
	'assets/tiles/h1.webp': 'x',
	'assets/ui/sheet.json': '{"frames":{},"meta":{"image":"a.webp"}}',
	'assets/audio/sounds.json': '{"sprite":{},"src":["./assets/audio/sounds.ogg?v=1"]}',
	'assets/audio/music.json': '{"tracks":{"bgm":{"src":["./assets/audio/sounds.ogg?v=1"]}}}',
	'assets/audio/sounds.ogg': 'x',
};
// (the sources the made-up builds were "made from": one stamped table, as RAW_TABLES names them)
const tableFile = Object.keys(RAW_TABLES)[0];
const fakeSrc = put(join(tmp, 'src-for-builds'), { [tableFile]: "export const T = { pic: '/assets/ui/table.webp', hero: (k) => `/assets/ui/hero-${k}.webp` };\n" });
let n = 0;
const build = (change) => put(join(tmp, `build-${(n += 1)}`), { ...base, ...change });
{
	const r = scanBuiltAddresses(build({}), fakeSrc);
	check('a right build passes: two folders up into assets/, a worker beside the bundle, an inlined file, stamped and tabled /assets paths, a page relative stylesheet address, an atlas with its picture', r.problems.length === 0 && r.count.climbsTwo === 1 && r.count.bundler === 1 && r.count.data === 1 && r.count.stamped === 2 && r.count.table === 2 && r.count.css === 1 && r.count.atlases === 1 && r.count.sound === 2 && r.count.shell === 3, r);
}
const wrong = [
	['a third "../" (the War Standard fault): the folder above the game', { '_app/immutable/bundle.1.js': GOOD_JS + 'const z=new URL("../../../assets/ui/a.webp",import.meta.url).href;' }, /climbs above the game's folder/],
	['an absolute path written from import.meta.url', { '_app/immutable/bundle.1.js': GOOD_JS + 'const z=new URL("/assets/ui/a.webp",import.meta.url).href;' }, /an absolute path/],
	['a file that is not in the build', { '_app/immutable/bundle.1.js': GOOD_JS + 'const z=new URL("../../assets/ui/gone.webp",import.meta.url).href;' }, /not in the build \(assets\/ui\/gone\.webp\)/],
	['an address that is not a literal', { '_app/immutable/bundle.1.js': GOOD_JS + 'const z=p=>new URL("../../assets/"+p,import.meta.url).href;' }, /not a plain literal/],
	['an /assets path that is not handed to stamp()', { '_app/immutable/bundle.1.js': GOOD_JS + 'fetch("/assets/ui/a.webp");' }, /not handed to stamp\(\)/],
	['a stamped /assets path whose file is not in the build', { '_app/immutable/bundle.1.js': GOOD_JS + 'const z=ee("/assets/ui/gone.webp");' }, /not in the build/],
	['an absolute path into _app', { '_app/immutable/bundle.1.js': GOOD_JS + 'import("/_app/immutable/x.js");' }, /absolute path into _app/],
	['a stylesheet address above the page', { '_app/immutable/assets/bundle.1.css': '.a{background:url(../assets/ui/a.webp)}' }, /climbs above the game's folder/],
	['a stylesheet address written from the .css file (it is read from the page)', { '_app/immutable/assets/bundle.1.css': '.a{background:url(../../../assets/ui/a.webp)}' }, /climbs above/],
	['an absolute stylesheet address', { '_app/immutable/assets/bundle.1.css': '.a{background:url("/assets/ui/a.webp")}' }, /an absolute path/],
	['the shell: an absolute script', { 'index.html': base['index.html'] + '<script src="/boot.js"></script>' }, /an absolute path/],
	['the shell: a boot table naming a bundle that is not there', { 'index.html': base['index.html'].replace('bundle.1.js', 'bundle.2.js') }, /not in the build/],
	['an atlas without its picture', { 'assets/ui/sheet.json': '{"frames":{},"meta":{"image":"gone.webp"}}' }, /not in the build/],
	['a sound manifest naming a file from its own folder (it is read from the page)', { 'assets/audio/music.json': '{"tracks":{"bgm":{"src":["./sounds.ogg"]}}}' }, /not in the build \(sounds\.ogg\)/],
	['a sound manifest with an absolute address', { 'assets/audio/sounds.json': '{"src":["/assets/audio/sounds.ogg"]}' }, /an absolute path/],
];
for (const [name, change, why] of wrong) {
	const r = scanBuiltAddresses(build(change), fakeSrc);
	check(`a wrong build fails: ${name}`, r.problems.length === 1 && why.test(r.problems[0].why), r.problems);
}
{
	const r = scanBuiltAddresses(build({}), null);
	check('without the sources a tabled /assets path cannot be told from a stray one: it fails', r.problems.length === 2 && r.problems.every((p) => /in no RAW_TABLES file/.test(p.why)), r.problems);
}

// ---- 2. made-up sources ----
{
	const src = put(join(tmp, 'src'), {
		'game/assets.ts': "export const stamp = (h) => (h.startsWith('/assets/') ? h.slice(1) : h);\nexport const A = new URL('../../assets/ui/a.webp', import.meta.url).href;\n",
		'game/deep/spec.ts': "// a comment may quote `new URL('...', import.meta.url)` and '/assets/x'\nexport const B = new URL('../../../assets/ui/b.webp', import.meta.url).href;\n",
		'game/two.ts': "export const C = new URL('../../../assets/ui/c.webp', import.meta.url).href;\n",
		'game/deep/two.ts': "export const D = new URL('../../assets/ui/d.webp', import.meta.url).href;\n",
		'game/worker.ts': "export const W = new Worker(new URL('./w.worker.ts', import.meta.url));\nexport const G = new URL('./gone.json', import.meta.url).href;\n",
		'game/w.worker.ts': 'export {};\n',
		'ui/Pic.svelte': "<script>\n\timport { stamp } from '../game/assets';\n\tconst ok = stamp(`/assets/tiles/${1}.webp`);\n\tconst bad = '/assets/tiles/x.webp';\n</script>\n",
		[tableFile]: "export const T = { pic: '/assets/ui/table.webp' };\n",
	});
	const r = scanSourceAddresses(src);
	const at = (f) => r.problems.filter((p) => p.file.startsWith(f));
	check('sources: three "../" in a file three folders deep fails (right on the dev server, above the game in a build)', at('game/deep/spec.ts').length === 1 && /3 '\.\.\/' from a file 3 folders deep/.test(at('game/deep/spec.ts')[0].why), r.problems);
	check('sources: three "../" in a file two folders deep, and two in a file three deep, fail', at('game/two.ts').length === 1 && at('game/deep/two.ts').length === 1, r.problems);
	check('sources: a file the bundler resolves passes, one that is not beside the source fails', at('game/worker.ts').length === 1 && /gone\.json/.test(at('game/worker.ts')[0].what), r.problems);
	check('sources: /assets inside stamp(...) and in a RAW_TABLES file pass, a bare one fails; a comment is not code', at('ui/Pic.svelte').length === 1 && /x\.webp/.test(at('ui/Pic.svelte')[0].what) && r.count.stamped === 1 && r.count.table === 1 && r.problems.length === 5 && r.count.twoUp === 1, r.problems);
}

// ---- 3. this app's sources ----
{
	const r = scanSourceAddresses(join(APP, 'src'));
	check(`this app's sources: every address written from import.meta.url is '../../assets/...' in a file two folders deep (${r.count.twoUp}) or the bundler's (${r.count.bundler}); every /assets string is handed to stamp() (${r.count.stamped}) or in a stamped table (${r.count.table})`, r.problems.length === 0 && r.count.twoUp > 300, r.problems.slice(0, 6));
	for (const f of Object.keys(RAW_TABLES)) check(`RAW_TABLES names a file that is there: ${f}`, existsSync(join(APP, 'src', f)));
	const { BANNER_FILES: F } = await import('../src/game/bannerFiles.ts');
	const all = [...['D', 'P'].flatMap((c) => ['fs', 'super', 'epic'].flatMap((t) => [F.cloth[c][t].intro, F.cloth[c][t].total])), F.glyphs.D, F.glyphs.P, F.motion.json, F.motion.bin];
	// (in node import.meta.url is the source file, so two folders up is the app's folder: the same shape as the build's)
	const appUrl = pathToFileURL(APP + '/').href;
	const names = all.map((h) => (h.startsWith(appUrl + 'assets/ui/banner/') ? h.slice((appUrl + 'assets/ui/banner/').length) : null));
	const onDisk = new Set(readdirSync(join(APP, 'static', 'assets', 'ui', 'banner')));
	check(`the War Standard's ${all.length} files: each two folders up from game/bannerFiles.ts into assets/ui/banner, each a different file of static/assets/ui/banner`, all.length === 16 && names.every((x) => x && onDisk.has(x)) && new Set(names).size === 16, names);
	const spec = readFileSync(join(APP, 'src', 'game', 'banner', 'spec.ts'), 'utf8');
	check('game/banner/spec.ts writes no address itself (no import.meta.url): it stamps game/bannerFiles.ts', !/import\.meta\.url/.test(spec.replace(/\/\/.*$/gm, '')) && /import \{ BANNER_FILES \} from '\.\.\/bannerFiles'/.test(spec) && /stamp\(F\.motion\.bin\)/.test(spec));
}

// ---- 4. this app's build ----
{
	const B = join(APP, 'build');
	if (!existsSync(join(B, 'index.html'))) console.log('     (no ./build here: the build\'s own check is scripts/check-production-bundle.mjs, after pnpm build)');
	else {
		const r = scanBuiltAddresses(B, join(APP, 'src'));
		check(`this app's build: ${r.count.metaUrl} addresses written from import.meta.url, ${r.count.absolute} /assets strings, ${r.count.css + r.count.shell} stylesheet and shell addresses, ${r.count.atlases} atlases: all in the game's folder and in the build`, r.problems.length === 0, r.problems.slice(0, 6));
		// the same, by the URL rules alone: from a bundle served at /srv/a/b/game/_app/immutable/
		const dir = join(B, '_app', 'immutable');
		const out = [];
		let seen = 0;
		let banner = 0;
		for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
			const text = readFileSync(join(dir, f), 'utf8');
			for (const m of text.matchAll(/new URL\("((?:\.\.?\/)[^"]*|[\w-]+\/[^"]*)",\s*import\.meta\.url\)/g)) {
				seen += 1;
				const u = new URL(m[1], `file:///srv/a/b/game/_app/immutable/${f}`);
				const inGame = u.pathname.startsWith('/srv/a/b/game/');
				if (!inGame || !existsSync(join(B, decodeURIComponent(u.pathname.slice('/srv/a/b/game/'.length))))) out.push(m[1]);
				else if (u.pathname.includes('/assets/ui/banner/')) banner += 1;
			}
		}
		check(`this app's build served from /srv/a/b/game/: all ${seen} addresses the bundle writes are files under the game's folder, the War Standard's 16 among them`, seen > 300 && out.length === 0 && banner === 16, { out: out.slice(0, 6), banner });
	}
}

rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
