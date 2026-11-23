// @ts-nocheck: a node build script, not app code (svelte-check picks up .mjs files)
// THE ASSET ADDRESS CHECK (2026-11-24). Part of scripts/check-production-bundle.mjs (it runs on every build check);
// tools/asset_paths_test.mjs proves each rule on made-up builds. No browser.
//
// WHY. Stake serves the game from a subfolder (.../<game>/<version>/index.html). An address is right there only if it
// stays inside the game's own folder. Two ways it does not:
//   - an address written from the bundle that climbs too far. The bundle is <game>/_app/immutable/bundle.<hash>.js and
//     src/app.html runs it with import.meta.url repointed at that file, so `new URL('../../assets/x', import.meta.url)`
//     is <game>/assets/x and '../../../assets/x' is the folder ABOVE the game. A browser clamps a climb at the server's
//     root, so a game served from the root works and the same build in a subfolder gets 404s. That shipped to staging:
//     game/banner/spec.ts (three folders deep in src, so three '../' were right on the dev server) asked for the War
//     Standard's sixteen files one folder too high, and a subfolder preview silently kept the old plaque.
//   - an absolute path ('/assets/x', '/_app/x'): the server's root, never the game's folder. game/assets.ts stamp() is
//     the one helper that turns '/assets/...' into a page relative address; nothing else may carry one to the network.
//
// WHAT IS READ.
//   THE SOURCES (src/): every `new URL('<literal>', import.meta.url)`. One that climbs into the static folder must be
//     written with exactly two '../' in a file exactly two folders deep (src/<folder>/<file>): only there is the dev
//     server's address (the file's own place) the same as the build's (the bundle's place). Any other relative literal
//     is the bundler's to resolve and must name a file that exists beside the source. And every '/assets/' string
//     literal must be the direct argument of stamp(...) or stand in one of the RAW_TABLES files (tables of paths whose
//     readers stamp them: each entry says who).
//   THE BUILD: every script under _app/ (the bundle, the workers), the stylesheets, index.html and the atlases:
//     - `new URL("<literal>", import.meta.url)`, resolved from the script's own place in a game served from a nested
//       folder: it must stay in the game's folder and the file must be in the build. One whose address is not a
//       literal cannot be judged and fails.
//     - '/assets/...' literals: stamp()'s own, a direct argument of stamp, or a RAW_TABLES path; the file (or, for a
//       path built at run time, its folder) must be in the build. '/_app/...' literals: none.
//     - url() in a stylesheet: resolved from the DOCUMENT (src/app.html injects the stylesheet inline, so the page is
//       its base, not the .css file); the same two rules. index.html's src, href and poster and its boot table too.
//     - every atlas in assets/ (a JSON with meta.image): the picture it names is beside it; every sound manifest in
//       assets/audio/: the files its `src` lists name, read from the page.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname, dirname, sep } from 'node:path';

/** tables of '/assets/...' paths that are not stamped where they are written; every reader stamps them */
export const RAW_TABLES = {
	'game/armouryData.ts': 'ARMOURY_ASSETS: game/armouryLoad.ts and ui/armoury/Armoury.svelte stamp() every read',
	'game/introCards.ts': 'INTRO_CARD_ASSETS: ui/LandingScreen.svelte, ui/armoury/Armoury.svelte and game/boot.svelte.ts stamp() every read',
	'game/introMaxlineSpec.ts': 'INTRO_MAXLINE_ART.src: ui/LandingScreen.svelte and game/boot.svelte.ts stamp() it',
};
/** the one helper's file (its own '/assets/' strings are the rule, not addresses) */
const STAMP_FILE = 'game/assets.ts';
/** a game served from a nested folder: every address is resolved under this and must stay under it */
const HOST = 'https://game.invalid';
const NEST = '/operator/version-7/game/';

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
const posix = (p) => p.split(sep).join('/');
const ups = (lit) => (/^((?:\.\.\/)*)/.exec(lit)[1].length / 3) | 0;
const short = (s, n = 110) => (s.length > n ? s.slice(0, n) + '...' : s);

/** string and template literals a text opens with a quote at `at`: the literal's text up to its closing quote, or, in
 *  a template, up to its first `${` (`open`: it goes on at run time) */
const literalAt = (text, at) => {
	const q = text[at];
	if (q !== '"' && q !== "'" && q !== '`') return null;
	let i = at + 1;
	for (; i < text.length; i++) {
		const c = text[i];
		if (c === '\\') { i += 1; continue; }
		if (c === q) return { value: text.slice(at + 1, i), end: i + 1, open: false };
		if (q === '`' && c === '$' && text[i + 1] === '{') return { value: text.slice(at + 1, i), end: i, open: true };
		if (c === '\n' && q !== '`') return null;
	}
	return null;
};

/** every `new URL(<first argument>, import.meta.url)` of a text: { at, literal | null, open } */
const metaUrls = (text) => {
	const out = [];
	let from = 0;
	for (;;) {
		const at = text.indexOf('new URL(', from);
		if (at < 0) break;
		from = at + 8;
		let i = from;
		while (/\s/.test(text[i])) i += 1;
		const lit = literalAt(text, i);
		if (lit && !lit.open && /^\s*,\s*import\.meta\.url\s*\)/.test(text.slice(lit.end, lit.end + 60))) {
			out.push({ at, literal: lit.value, open: false });
			continue;
		}
		// not a plain literal: is its base import.meta.url all the same? (the call's own closing bracket, 400 chars at most)
		let depth = 1;
		let j = from;
		for (; j < text.length && j < from + 400 && depth > 0; j++) {
			if (text[j] === '(') depth += 1;
			else if (text[j] === ')') depth -= 1;
		}
		const call = text.slice(from, j);
		// (Vite's own wrapper round a worker: new URL("" + new URL("<literal>", import.meta.url).href, import.meta.url);
		// the inner address is judged by itself, the outer one is that same absolute address)
		if (/^\s*""\s*\+\s*new URL\(\s*(["'])[^"']*\1\s*,\s*import\.meta\.url\s*\)\.href\s*,\s*import\.meta\.url\s*\)$/.test(call)) continue;
		if (depth === 0 && /,\s*import\.meta\.url\s*\)$/.test(call)) out.push({ at, literal: lit ? lit.value : null, open: true, call: short(call, 80) });
	}
	return out;
};

/** an address from a file of the build, in a game served from NEST: where it lands, or why it is wrong */
const resolveFrom = (build, fromRel, address) => {
	if (/^data:/i.test(address)) return { kind: 'data' };
	if (/^[a-z][a-z0-9+.-]*:/i.test(address) || address.startsWith('//')) return { kind: 'bad', why: 'another origin' };
	if (address.startsWith('/')) return { kind: 'bad', why: 'an absolute path: the server\'s root, not the game\'s folder' };
	const url = new URL(address, HOST + NEST + fromRel);
	if (!url.pathname.startsWith(NEST)) return { kind: 'bad', why: `climbs above the game's folder: from <game>/${fromRel} it is ${url.pathname} where the game is served at ${NEST}` };
	const rel = decodeURIComponent(url.pathname.slice(NEST.length));
	const file = join(build, rel);
	if (!existsSync(file) || !statSync(file).isFile()) return { kind: 'bad', why: `not in the build (${rel})`, rel };
	return { kind: 'file', rel };
};

/** THE BUILD. `src` (the app's sources) gives the RAW_TABLES paths; without it they cannot be told from a stray path */
export const scanBuiltAddresses = (build, src) => {
	const problems = [];
	const count = { scripts: 0, metaUrl: 0, climbsTwo: 0, bundler: 0, data: 0, absolute: 0, stamped: 0, table: 0, css: 0, shell: 0, atlases: 0, sound: 0 };
	const fail = (file, what, why) => problems.push({ file, what: short(what), why });
	const raw = new Set();
	if (src) for (const f of Object.keys(RAW_TABLES)) if (existsSync(join(src, f))) for (const m of readFileSync(join(src, f), 'utf8').matchAll(/["'`](\/assets\/[^"'`$\n]*)/g)) raw.add(m[1]);
	const inAssets = (rel, open) => {
		// '/assets/ui/x.webp' is <game>/assets/ui/x.webp once stamped; a path built at run time: its folder
		const p = join(build, rel.replace(/^\//, ''));
		if (!open && !rel.endsWith('/')) return existsSync(p) && statSync(p).isFile();
		const dir = rel.endsWith('/') ? p : dirname(p);
		return existsSync(dir) && statSync(dir).isDirectory();
	};
	const files = walk(build);
	for (const file of files) {
		const rel = posix(relative(build, file));
		const ext = extname(file);
		if ((ext === '.js' || ext === '.mjs') && rel.startsWith('_app/')) {
			const text = readFileSync(file, 'utf8');
			count.scripts += 1;
			for (const u of metaUrls(text)) {
				count.metaUrl += 1;
				if (u.open) { fail(rel, `new URL(${u.call ?? u.literal}`, 'its address is not a plain literal, so it cannot be judged: write it out'); continue; }
				const r = resolveFrom(build, rel, u.literal);
				if (r.kind === 'data') count.data += 1;
				else if (r.kind === 'bad') fail(rel, `new URL("${u.literal}", import.meta.url)`, r.why);
				else if (ups(u.literal) === 2 && r.rel.startsWith('assets/')) count.climbsTwo += 1;
				else count.bundler += 1;
			}
			// stamp()'s own name in this script (minified), by its two '/assets/' tests
			const def = /([\w$]+)=([\w$]+)=>\{const [\w$]+=\2\.split\("\/assets\/"\)\.pop\(\)[^}]{0,200}\2\.startsWith\("\/assets\/"\)/.exec(text);
			const stampName = def ? def[1] : null;
			for (const m of text.matchAll(/["'`]\/(?:assets|_app)(?=[/"'`])/g)) {
				const lit = literalAt(text, m.index);
				if (!lit) continue;
				count.absolute += 1;
				const v = lit.value;
				if (v.startsWith('/_app')) { fail(rel, v, 'an absolute path into _app: the server\'s root, not the game\'s folder'); continue; }
				const before = text.slice(Math.max(0, m.index - 40), m.index);
				const own = (def && m.index >= def.index && m.index < def.index + def[0].length) || /new URL\(\s*$/.test(before); // (new URL's own: judged above)
				const direct = stampName && before.endsWith(`${stampName}(`);
				if (own) continue;
				if (direct) count.stamped += 1;
				else if (raw.has(v)) count.table += 1;
				else { fail(rel, v + (lit.open ? '${...}' : ''), stampName ? 'an absolute /assets path that is not handed to stamp() and is in no RAW_TABLES file: it would ask the server\'s root' : 'an absolute /assets path, and stamp() was not found in this script'); continue; }
				if (v !== '/assets/' && !inAssets(v, lit.open)) fail(rel, v + (lit.open ? '${...}' : ''), 'not in the build');
			}
		} else if (ext === '.css' && rel.startsWith('_app/')) {
			const text = readFileSync(file, 'utf8');
			for (const m of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*))\s*\)|@import\s+["']([^"']+)["']/g)) {
				const a = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim();
				if (!a || /^data:/i.test(a) || a.startsWith('#')) continue;
				count.css += 1;
				// (the page is the base: src/app.html injects this stylesheet inline)
				const r = resolveFrom(build, 'index.html', a);
				if (r.kind === 'bad') fail(rel, `url(${a})`, `${r.why} (a stylesheet's addresses are read from the page: it is injected inline)`);
			}
		} else if (rel === 'index.html') {
			const text = readFileSync(file, 'utf8');
			const found = [...text.matchAll(/\b(?:src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => m[1] ?? m[2]);
			for (const m of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*))\s*\)/g)) found.push((m[1] ?? m[2] ?? m[3] ?? '').trim());
			const boot = /__AM_BOOT\s*=\s*(\{[^;]*\})\s*;/.exec(text);
			if (boot) {
				try {
					const b = JSON.parse(boot[1]);
					for (const k of ['js', 'css']) if (typeof b[k] === 'string') found.push(b[k]);
				} catch { fail(rel, '__AM_BOOT', 'the boot table is not JSON'); }
			}
			for (const a of found) {
				if (!a || /^data:/i.test(a) || a.startsWith('#') || /^(?:about|javascript|mailto):/i.test(a)) continue;
				count.shell += 1;
				const r = resolveFrom(build, 'index.html', a);
				if (r.kind === 'bad') fail(rel, a, r.why);
			}
		} else if (ext === '.json' && rel.startsWith('assets/')) {
			let data;
			try { data = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
			const image = data?.meta?.image;
			if (typeof image === 'string') {
				count.atlases += 1;
				const r = resolveFrom(build, rel, image);
				if (r.kind === 'bad') fail(rel, `meta.image "${image}"`, r.why);
			}
			// the sound manifests (assets/audio/sounds.json, music.json): every `src` list names its files from the PAGE
			// (game/sound.ts resolves them against document.baseURI)
			const lists = [];
			const dig = (o, depth) => {
				if (!o || typeof o !== 'object' || depth > 4) return;
				if (Array.isArray(o.src) && o.src.every((x) => typeof x === 'string')) lists.push(...o.src);
				for (const v of Array.isArray(o) ? [] : Object.values(o)) if (v && typeof v === 'object' && !Array.isArray(v)) dig(v, depth + 1);
			};
			if (rel.startsWith('assets/audio/')) dig(data, 0);
			for (const a of lists) {
				count.sound += 1;
				const r = resolveFrom(build, 'index.html', a);
				if (r.kind === 'bad') fail(rel, `src "${a}"`, `${r.why} (a sound manifest's addresses are read from the page)`);
			}
		}
	}
	if (count.scripts === 0) fail('_app/', 'no script', 'the build has no script under _app/: nothing was checked');
	return { problems, count };
};

/** THE SOURCES */
export const scanSourceAddresses = (src) => {
	const problems = [];
	const count = { files: 0, twoUp: 0, bundler: 0, stamped: 0, table: 0 };
	const fail = (file, what, why) => problems.push({ file, what: short(what), why });
	for (const file of walk(src)) {
		if (!['.ts', '.js', '.mjs', '.svelte'].includes(extname(file))) continue;
		const rel = posix(relative(src, file));
		const text = readFileSync(file, 'utf8');
		count.files += 1;
		const lineOf = (at) => text.slice(0, at).split('\n').length;
		const depth = rel.split('/').length; // game/assets.ts: 2 (with src itself, two folders under the app)
		/** a comment's quoted code is not code: the line's text before `at` starts a comment or holds a `//` */
		const inComment = (at) => {
			const head = text.slice(text.lastIndexOf('\n', at) + 1, at);
			return /^\s*(\/\/|\*|\/\*|<!--)/.test(head) || /(^|[^:'"`])\/\/[^'"`]*$/.test(head);
		};
		for (const u of metaUrls(text)) {
			if (inComment(u.at)) continue;
			const where = `${rel}:${lineOf(u.at)}`;
			if (u.open) { fail(where, `new URL(${u.call ?? u.literal}`, 'its address is not a plain literal: Vite rewrites only a literal, and this check can judge only a literal'); continue; }
			const lit = u.literal;
			if (/^data:/i.test(lit)) continue;
			if (lit.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(lit)) { fail(where, lit, 'an absolute address'); continue; }
			const beside = join(dirname(file), lit);
			if (existsSync(beside)) { count.bundler += 1; continue; } // the bundler resolves it and emits the file
			// a path out of src into the static folder: right on the dev server only where the file is `ups` folders deep, and
			// right in the build only with two (the bundle is two folders deep in the game)
			const n = ups(lit);
			if (n === 2 && depth === 2 && lit.slice(6).startsWith('assets/')) count.twoUp += 1;
			else if (lit.slice(n * 3).startsWith('assets/')) fail(where, lit, `${n} '../' from a file ${depth} folder${depth === 1 ? '' : 's'} deep in src: the built bundle is always two folders deep in the game (_app/immutable/), so only '../../assets/...' written in a file of src/<folder>/ is the same address on the dev server and in a build`);
			else fail(where, lit, 'names no file beside the source (the bundler cannot resolve it) and is not a ../../assets/ address');
		}
		if (rel === STAMP_FILE) continue;
		for (const m of text.matchAll(/["'`]\/(?:assets|_app)\//g)) {
			const lit = literalAt(text, m.index);
			if (!lit) continue;
			if (inComment(m.index)) continue;
			const head = text.slice(text.lastIndexOf('\n', m.index) + 1, m.index);
			const where = `${rel}:${lineOf(m.index)}`;
			if (lit.value.startsWith('/_app')) { fail(where, lit.value, 'an absolute path into _app'); continue; }
			if (/\bstamp\(\s*$/.test(head)) count.stamped += 1;
			else if (RAW_TABLES[rel]) count.table += 1;
			else fail(where, lit.value + (lit.open ? '${...}' : ''), 'an absolute /assets path that is not the direct argument of stamp(): hand it to stamp() there, or add the file to RAW_TABLES in scripts/check-asset-paths.mjs with the reader that stamps it');
		}
	}
	return { problems, count };
};

/** the problems as text: one reason once, the addresses that have it under it (at most `max` of each) */
export const report = (problems, max = 20) => {
	const by = new Map();
	for (const p of problems) {
		// (a reason that quotes its own address is the same reason with another address)
		const key = p.why.replace(/ it is \S+ where /, ' it is ... where ').replace(/\(assets\/[^)]*\)/, '(...)');
		if (!by.has(key)) by.set(key, { why: p.why, list: [] });
		by.get(key).list.push(p);
	}
	return [...by.values()].map((g) => `  ${g.list.length} x ${g.why}\n${g.list.slice(0, max).map((p) => `      ${p.file}: ${p.what}`).join('\n')}${g.list.length > max ? `\n      ... and ${g.list.length - max} more` : ''}`).join('\n');
};
