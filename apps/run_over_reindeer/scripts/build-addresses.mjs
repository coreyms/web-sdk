// @ts-nocheck: a node build script, not app code (svelte-check picks up .mjs files)
// THE BUILD'S ADDRESSES (2026-11-23). Every address the BUILT game can ask the network for, read from the build that
// was actually produced (never from the source), resolved the way a browser resolves it, and held to two rules:
//   it stays inside the game's own folder, and the file it names is in the build.
// Why: the sister game shipped-to-be a source file three folders deep that addressed its art with
// `new URL('../../../assets/...', import.meta.url)`. Right on the dev server; in a build import.meta.url is the bundle
// at <game folder>/_app/immutable/bundle.<hash>.js, so three levels up is the folder ABOVE the game. Served from a
// site's root a browser clamps that and it works; served from any subfolder (Stake serves a game from one, and so do
// staging previews) it is a 404, and that game fell back to an older screen without a word.
//
// What is read, and how each kind resolves (the game folder stands at file:///x/y/game/, two folders deep, so a
// climb out of it shows):
//   bundle     `new URL("<text>", import.meta.url)` in a built script: against that script's own address
//              (file:///x/y/game/_app/immutable/bundle.js). Any other use of import.meta.url must be Vite's own
//              preload call with nothing to fetch (`, void 0, import.meta.url)`); anything else cannot be read and fails.
//   stamped    a string or template that begins /assets/ in a built script. It is allowed only as the direct argument
//              of the game's stamp helper (src/game/assets.ts stamp, found in the build by its own body), which takes
//              the leading slash off: the address is then relative to the page. A bare one is a root address: fail.
//              A template's file must exist for at least one value of its holes; one that is all hole
//              (`/assets/${x.file}`) is covered by the next two kinds.
//   table      every key of the stamp table (src/game/assetStamp.ts, as built): a file under assets/
//   data       every other string in a built script that reads as a file under assets/ (dir/name.ext: the spec
//              files' `file` values, joined to /assets/ at run time)
//   page       ./assets/..., assets/..., ./_app/... in a built script, in index.html (its attributes and its inline
//              script's strings) or in a data file: against the page (file:///x/y/game/index.html)
//   css        url(...) and @import in a built stylesheet: against the stylesheet; in a built script's own text,
//              url(/...) is a root address: fail
//   json       file names inside the build's JSON data (an atlas's image, the audio manifests' sources): a bare
//              name against the data file's own folder, ./assets/... against the page
//   call       fetch("..."), import("..."), new Worker("..."), importScripts("...") with a written-out address
// A root address (/assets/..., /_app/..., /favicon...) is never right: the page's own address is the base.
// Not addresses of the game's own files, and left alone: the RGS's endpoints (/wallet/..., /bet/replay/..., joined
// to the operator's host), SvelteKit's own route names, data: and blob-free inline data, #fragment references.
//
// Used by scripts/check-production-bundle.mjs (the build fails the check on any problem) and by
// tools/build_addresses_test.mjs (node only: the sweep of ./build, and the guard held against planted faults).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';

/** where the game folder stands for the sweep: two folders deep, so an address that climbs out of it is seen */
export const GAME_AT = 'file:///x/y/game/';
const FILE_EXT = 'webp|png|jpe?g|gif|avif|json|mp3|ogg|m4a|wav|aac|woff2?|ttf|otf|svg|mp4|webm|wasm|css|js|mjs|atlas|skel|fnt|xml|txt|ktx2?|basis|ico';
const HAS_EXT = new RegExp(`\\.(?:${FILE_EXT})(?:[?#].*)?$`, 'i');
/** a file under assets/, named from the assets folder: dir/name.ext (the stamp table's keys, the spec files' `file`s) */
const DATA_FILE = new RegExp(`^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_.-]+)+\\.(?:${FILE_EXT})$`, 'i');

/** SvelteKit's own route names in its client (not files of the game: its router strips or asks them by the page's base) */
const KIT_ROUTES = new Set(['/index.html', '/__data.json']);

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
const posix = (p) => p.split(sep).join('/');

/** the template that opens at `at` (a backtick): its text with every ${...} hole as *, and where it ends; null if unclosed */
const readTemplate = (js, at) => {
	let out = '';
	let i = at + 1;
	while (i < js.length) {
		const ch = js[i];
		if (ch === '\\') {
			out += js[i + 1] ?? '';
			i += 2;
		} else if (ch === '`') return { text: out, end: i + 1 };
		else if (ch === '$' && js[i + 1] === '{') {
			// a hole: to its closing brace, past any braces, strings and templates inside it
			let depth = 1;
			i += 2;
			while (i < js.length && depth > 0) {
				const c = js[i];
				if (c === '{') depth++;
				else if (c === '}') depth--;
				else if (c === '"' || c === "'") {
					i++;
					while (i < js.length && js[i] !== c) i += js[i] === '\\' ? 2 : 1;
				} else if (c === '`') {
					const inner = readTemplate(js, i);
					if (!inner) return null;
					i = inner.end - 1;
				}
				i++;
			}
			out += '*';
		} else {
			out += ch;
			i++;
		}
	}
	return null;
};
/** the plain string that opens at `at` (a quote): its text and where it ends */
const readString = (js, at) => {
	const q = js[at];
	let out = '';
	let i = at + 1;
	while (i < js.length && js[i] !== q) {
		if (js[i] === '\n') return null;
		if (js[i] === '\\') {
			out += js[i + 1] ?? '';
			i += 2;
		} else out += js[i++];
	}
	return i < js.length ? { text: out, end: i + 1 } : null;
};

/** the sweep of a build folder: every address read, and every one that is wrong */
export const sweepAddresses = (build) => {
	const files = walk(build).map((f) => posix(relative(build, f)));
	const has = new Set(files);
	const list = [];
	const problems = [];
	/** the build's path an address reaches, or why it is wrong */
	const reach = (raw, baseFile) => {
		let url;
		try {
			url = new URL(raw, GAME_AT + baseFile);
		} catch {
			return { why: 'not an address a browser can resolve' };
		}
		if (url.protocol !== 'file:') return { why: `leaves the game for ${url.protocol}//${url.host}` };
		const path = decodeURIComponent(url.pathname);
		const root = new URL(GAME_AT).pathname;
		if (!path.startsWith(root)) return { why: `climbs out of the game's folder: it resolves to ${path} (the game is at ${root})` };
		return { target: path.slice(root.length) };
	};
	const add = (file, kind, raw, baseFile, { pattern = false } = {}) => {
		const r = reach(raw, baseFile);
		const entry = { file, kind, raw, target: r.target ?? null, ok: false, why: r.why ?? '' };
		if (r.target !== undefined) {
			if (pattern) {
				const re = new RegExp('^' + r.target.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
				entry.ok = files.some((f) => re.test(f));
				if (!entry.ok) entry.why = `no file in the build matches ${r.target}`;
			} else {
				entry.ok = has.has(r.target);
				if (!entry.ok) entry.why = `the build has no file ${r.target}`;
			}
		}
		list.push(entry);
		if (!entry.ok) problems.push(entry);
	};
	const fault = (file, kind, raw, why) => {
		const entry = { file, kind, raw, target: null, ok: false, why };
		list.push(entry);
		problems.push(entry);
	};

	// ---- the built scripts ----
	for (const file of files.filter((f) => /\.(?:js|mjs)$/.test(f) && !f.startsWith('assets/'))) {
		const js = readFileSync(join(build, file), 'utf8');
		// (1) import.meta.url: `new URL("<text>", import.meta.url)`, or Vite's preload call with nothing to fetch
		const literal = new Map();
		for (const m of js.matchAll(/new URL\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1\s*,\s*import\.meta\.url\s*\)/g)) literal.set(m.index + m[0].lastIndexOf('import.meta.url'), m[2]);
		for (const m of js.matchAll(/import\.meta\.url/g)) {
			if (literal.has(m.index)) {
				const raw = literal.get(m.index);
				if (raw.includes('${')) fault(file, 'bundle', raw, 'a template in new URL(..., import.meta.url): its file cannot be read from the build');
				else add(file, 'bundle', raw, file);
			} else if (!/,\s*void 0\s*,\s*$/.test(js.slice(Math.max(0, m.index - 12), m.index))) {
				fault(file, 'bundle', js.slice(Math.max(0, m.index - 60), m.index + 16).replace(/\s+/g, ' '), 'import.meta.url used in a way the sweep cannot read (not new URL("<text>", import.meta.url), not a preload with nothing to fetch)');
			}
		}
		// (2) the stamp helper, by its own body, and its table
		const helper = js.match(/([\w$]+)=([\w$]+)=>\{const ([\w$]+)=\2\.split\("\/assets\/"\)\.pop\(\)\?\?"",[\w$]+=([\w$]+)\[\3\]/);
		const stampName = helper?.[1] ?? null;
		const tableKeys = new Set();
		if (helper) {
			const at = js.search(new RegExp(`(?:^|[,;{ ])${helper[4].replace(/\$/g, '\\$')}=\\{`));
			const end = at < 0 ? -1 : js.indexOf('}', at);
			if (at >= 0 && end > at) for (const m of js.slice(at, end).matchAll(/"((?:[^"\\]|\\.)+)":"[0-9a-f]{6,16}"/g)) tableKeys.add(m[1]);
			if (tableKeys.size === 0) fault(file, 'table', helper[4], "the stamp table was not found in the build (the sweep cannot check the files it names)");
		}
		// (3) root addresses: every string or template that begins /assets/, /_app/ or /favicon. Found in the raw text (not
		// through a reader of the whole script, which a regular expression with a quote in it would put out of step)
		for (const m of js.matchAll(/(["'`])\/(?:assets\/|_app\/|favicon)/g)) {
			const s2 = m[1] === '`' ? readTemplate(js, m.index) : readString(js, m.index);
			if (!s2) {
				fault(file, 'root', js.slice(m.index, m.index + 60), 'a root address the sweep could not read to its end');
				continue;
			}
			const text = s2.text;
			const before = js.slice(Math.max(0, m.index - 40), m.index);
			if (text === '/assets/') {
				// the helper's own two tests for the prefix
				if (!/\.split\($|\.startsWith\($/.test(before)) fault(file, 'stamped', text, 'a bare "/assets/" outside the stamp helper');
			} else if (stampName && before.endsWith(`${stampName}(`) && text.startsWith('/assets/')) {
				const rest = text.slice(1);
				if (!text.includes('*')) add(file, 'stamped', rest, 'index.html');
				else if (rest === 'assets/*') list.push({ file, kind: 'stamped', raw: text, target: null, ok: true, why: 'all hole: its files are the table and data kinds' });
				else add(file, 'stamped', rest, 'index.html', { pattern: true });
			} else fault(file, 'root', text, `a root address (${stampName ? `not the direct argument of the stamp helper ${stampName}(...)` : 'and the stamp helper was not found in this script'}): right only when the game is served from a site's root`);
		}
		// (3b) any other root address that names a file (/sounds/x.mp3, /data/x.json): the same fault. SvelteKit's own two
		// route names are not files of the game.
		for (const m of js.matchAll(new RegExp(`(["'\`])(\\/(?!assets\\/|_app\\/|favicon)[A-Za-z0-9_.\\/-]+\\.(?:${FILE_EXT}))\\1`, 'gi'))) {
			if (KIT_ROUTES.has(m[2])) continue;
			fault(file, 'root', m[2], "a root address: right only when the game is served from a site's root");
		}
		// (4) page addresses written out: ./assets/..., assets/..., ./_app/...
		for (const m of js.matchAll(/(["'`])((?:\.\/)?(?:assets|_app)\/[^"'`\s$]+)\1/g)) if (HAS_EXT.test(m[2])) add(file, 'page', m[2], 'index.html');
		// (5) a climbing address that is not new URL(..., import.meta.url): against the page
		for (const m of js.matchAll(/(["'`])((?:\.\.\/)+[^"'`\s$]+)\1(\s*,\s*import\.meta\.url)?/g)) if (!m[3] && HAS_EXT.test(m[2])) add(file, 'page', m[2], 'index.html');
		// (6) the stamp table's keys and every other string that names a file under assets/ (dir/name.ext)
		const seenData = new Set();
		for (const m of js.matchAll(/(["'])([A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)+)\1/g)) {
			const text = m[2];
			if (!DATA_FILE.test(text) || seenData.has(text)) continue;
			seenData.add(text);
			const isKey = tableKeys.has(text);
			// (a string that only looks like one, a library's example, is no address: it must be a table key or stand in a
			// folder the build's assets have)
			if (!isKey && !files.some((f) => f.startsWith(`assets/${text.split('/')[0]}/`))) continue;
			const ok = has.has(`assets/${text}`);
			const entry = { file, kind: isKey ? 'table' : 'data', raw: text, target: `assets/${text}`, ok, why: ok ? '' : `the build has no file assets/${text}` };
			list.push(entry);
			if (!ok) problems.push(entry);
		}
		for (const key of tableKeys) {
			if (seenData.has(key)) continue;
			const ok = has.has(`assets/${key}`);
			const entry = { file, kind: 'table', raw: key, target: `assets/${key}`, ok, why: ok ? '' : `the build has no file assets/${key}` };
			list.push(entry);
			if (!ok) problems.push(entry);
		}
		// (7) url(/...) written into a script, and calls with a written-out address
		for (const m of js.matchAll(/url\(\s*["']?(\/(?!\/)[A-Za-z0-9_.\/-]+\.[A-Za-z0-9]+)/g)) fault(file, 'css', m[1], 'url() with a root address in a script');
		for (const m of js.matchAll(/(\bfetch|\bimport|\bimportScripts|new (?:Shared)?Worker)\(\s*(["'`])([^"'`$]+)\2/g)) {
			const text = m[3];
			if (/^(?:https?:|data:)/.test(text)) continue;
			if (text.startsWith('/')) fault(file, 'call', text, `${m[1]}() with a root address`);
			else add(file, 'call', text, /fetch/.test(m[1]) ? 'index.html' : file);
		}
		if (!stampName && /["'`]\/assets\//.test(js)) fault(file, 'stamped', '/assets/...', 'this script has /assets/ addresses but the stamp helper was not found in it');
		// (8) three or more ../ in a row before a path is never inside the game from here, whatever it is passed to
		for (const m of js.matchAll(/["'`]((?:\.\.\/){3,}[^"'`\s)]{1,120})/g)) if (!problems.some((q) => q.file === file && q.raw === m[1])) fault(file, 'bundle', m[1], `climbs ${m[1].match(/\.\.\//g).length} folders: out of the game's folder from ${file}`);
	}

	// ---- the built stylesheets ----
	for (const file of files.filter((f) => f.endsWith('.css') && !f.startsWith('assets/'))) {
		const css = readFileSync(join(build, file), 'utf8');
		for (const m of css.matchAll(/url\(\s*(["']?)([^)"']+)\1\s*\)|@import\s+(["'])([^"']+)\3/g)) {
			const raw = (m[2] ?? m[4]).trim();
			if (/^(?:data:|#|about:)/.test(raw)) continue;
			if (raw.startsWith('/') || /^https?:/.test(raw)) fault(file, 'css', raw, 'a root or outside address in a stylesheet');
			else add(file, 'css', raw, file);
		}
	}

	// ---- the page ----
	if (has.has('index.html')) {
		const html = readFileSync(join(build, 'index.html'), 'utf8');
		const seen = new Set();
		const one = (raw) => {
			if (seen.has(raw) || /^(?:data:|#|about:|javascript:|mailto:)/.test(raw) || raw === '' || raw === '.') return;
			seen.add(raw);
			if (/^https?:|^\/\//.test(raw)) fault('index.html', 'page', raw, 'an outside address in the page');
			else if (raw.startsWith('/')) fault('index.html', 'page', raw, "a root address in the page: it is right only when the game is served from a site's root");
			else add('index.html', 'page', raw, 'index.html');
		};
		for (const m of html.matchAll(/\b(?:src|href|poster|data-src)\s*=\s*(["'])([^"']*)\1/g)) one(m[2]);
		for (const m of html.matchAll(/url\(\s*(["']?)([^)"']+)\1\s*\)/g)) one(m[2].trim());
		// its inline script's strings that read as a file of the game
		for (const m of html.matchAll(/(["'])((?:\.{0,2}\/)?(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:js|mjs|css|json|png|webp|svg|ico|woff2?)(?:\?[^"']*)?)\1/g)) one(m[2]);
	} else fault('index.html', 'page', 'index.html', 'the build has no index.html');

	// ---- the data files ----
	for (const file of files.filter((f) => f.endsWith('.json'))) {
		let data;
		try {
			data = JSON.parse(readFileSync(join(build, file), 'utf8'));
		} catch {
			fault(file, 'json', file, 'not JSON');
			continue;
		}
		const visit = (v) => {
			if (typeof v === 'string') {
				if (!HAS_EXT.test(v) || /^(?:https?:|data:)/.test(v) || /\s/.test(v)) return;
				if (v.startsWith('/')) fault(file, 'json', v, 'a root address in a data file');
				else if (/^(?:\.\/)?(?:assets|_app)\//.test(v)) add(file, 'json', v, 'index.html');
				else add(file, 'json', v, file);
			} else if (v && typeof v === 'object') for (const x of Object.values(v)) visit(x);
		};
		visit(data);
	}

	const byKind = {};
	for (const e of list) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
	return { checked: list.length, byKind, problems, list, files: files.length };
};

/** the sweep's problems as lines for a report */
export const problemLines = (problems, max = 30) => problems.slice(0, max).map((p) => `  ${p.kind}  ${p.raw}  in ${p.file}: ${p.why}`);

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
	const build = process.argv[2] ?? new URL('../build/', import.meta.url).pathname;
	if (!existsSync(build) || !statSync(build).isDirectory()) {
		console.error(`[build-addresses] no build at ${build}`);
		process.exit(2);
	}
	const r = sweepAddresses(build);
	console.log(`[build-addresses] ${r.checked} addresses in ${r.files} files: ${Object.entries(r.byKind).map(([k, n]) => `${k} ${n}`).join(', ')}`);
	if (r.problems.length) {
		console.error(`[build-addresses] FAIL: ${r.problems.length} address(es) leave the game's folder or name a file the build does not have`);
		for (const l of problemLines(r.problems)) console.error(l);
		process.exit(1);
	}
	console.log('[build-addresses] PASS: every address stays inside the game folder and names a file in the build');
}
