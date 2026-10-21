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
// The kit's generated index.html carries every developer comment of src/app.html (HTML comments, and the CSS / JS
// comments of its inline <style> and <script>): about 11.6 KB, with local paths and review notes. Corey 2026-10-21:
// "they shouldn't be in the production or staging builds". stripShellComments() below takes them out of the BUILT
// index.html only (src/app.html keeps them for development). It is a tokenizer, not a regex: strings, template
// literals, regex literals and CSS url(...) (the inlined @font-face data URIs) are copied byte for byte, and nothing
// else is minified. Every stripped script must still compile and its protected tokens must be unchanged, or the
// shell is written with its comments (and a warning) rather than risk the game.
import { readFileSync, writeFileSync, existsSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Script } from 'node:vm';
import { gzipSync } from 'node:zlib';

const walk = (dir) =>
	readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
		d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
	);

// ── comment stripping (2026-10-21) ─────────────────────────────────────────────────────────────────────────────
const WS = /[ \t\r\n\f]/;
const IDENT = /[$\w]/;
/** after these the next `/` starts a regex literal, not a division */
const REGEX_AFTER_CHAR = new Set([...'(,=:[!&|?{};+-*%<>~^']);
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

/** scan a quoted string from its opening quote at i; returns the index after the closing quote */
const skipString = (t, i) => {
	const q = t[i];
	for (let j = i + 1; j < t.length; j++) {
		if (t[j] === '\\') j++;
		else if (t[j] === q) return j + 1;
		else if (t[j] === '\n' && q !== '`') return j; // unterminated: stop at the line end
	}
	return t.length;
};

/** the comments of a JS text: [{ start, end, kind, multiline }] plus its protected tokens (strings, templates, regexes) */
const scanJs = (t) => {
	const comments = [];
	const tokens = [];
	let prev = ''; // last significant char
	let word = ''; // last identifier / keyword, when prev ended one
	const tpl = []; // brace depth at each open template `${`
	let depth = 0;
	let i = 0;
	const templateFrom = (from) => {
		// from is just after a ` or a closing } of `${...}`; returns index after the closing ` or after `${`
		for (let j = from; j < t.length; j++) {
			if (t[j] === '\\') j++;
			else if (t[j] === '`') return { end: j + 1, open: false };
			else if (t[j] === '$' && t[j + 1] === '{') return { end: j + 2, open: true };
		}
		return { end: t.length, open: false };
	};
	while (i < t.length) {
		const c = t[i];
		if (WS.test(c)) { i++; continue; }
		if (c === '/' && t[i + 1] === '/') {
			let e = t.indexOf('\n', i);
			if (e < 0) e = t.length;
			comments.push({ start: i, end: e, kind: 'line', multiline: false });
			i = e;
			continue;
		}
		if (c === '/' && t[i + 1] === '*') {
			let e = t.indexOf('*/', i + 2);
			e = e < 0 ? t.length : e + 2;
			comments.push({ start: i, end: e, kind: 'block', multiline: t.slice(i, e).includes('\n') });
			i = e;
			continue;
		}
		if (c === "'" || c === '"') {
			const e = skipString(t, i);
			tokens.push(t.slice(i, e));
			i = e; prev = c; word = '';
			continue;
		}
		if (c === '`') {
			const r = templateFrom(i + 1);
			tokens.push(t.slice(i, r.end));
			if (r.open) { tpl.push(depth); depth++; }
			i = r.end; prev = '`'; word = '';
			continue;
		}
		if (c === '{') { depth++; i++; prev = c; word = ''; continue; }
		if (c === '}') {
			depth--;
			if (tpl.length && tpl[tpl.length - 1] === depth) {
				tpl.pop();
				const r = templateFrom(i + 1);
				tokens.push(t.slice(i, r.end));
				if (r.open) { tpl.push(depth); depth++; }
				i = r.end; prev = '`'; word = '';
				continue;
			}
			i++; prev = c; word = '';
			continue;
		}
		if (c === '/' && (prev === '' || REGEX_AFTER_CHAR.has(prev) || REGEX_AFTER_WORD.has(word))) {
			let j = i + 1;
			let cls = false;
			for (; j < t.length; j++) {
				if (t[j] === '\\') j++;
				else if (t[j] === '[') cls = true;
				else if (t[j] === ']') cls = false;
				else if (t[j] === '/' && !cls) break;
				else if (t[j] === '\n') break;
			}
			j++;
			while (j < t.length && IDENT.test(t[j])) j++;
			tokens.push(t.slice(i, j));
			i = j; prev = ')'; word = ''; // a regex is a value: a `/` after it divides
			continue;
		}
		if (IDENT.test(c)) {
			let j = i;
			while (j < t.length && IDENT.test(t[j])) j++;
			word = t.slice(i, j);
			// a number or a name is a value (prev = a letter keeps REGEX_AFTER_CHAR false); keywords go by `word`
			prev = 'a';
			i = j;
			continue;
		}
		prev = c; word = '';
		i++;
	}
	return { comments, tokens };
};

/** the comments of a CSS text, and its protected tokens (strings, url(...)) */
const scanCss = (t) => {
	const comments = [];
	const tokens = [];
	let i = 0;
	while (i < t.length) {
		const c = t[i];
		if (c === '/' && t[i + 1] === '*') {
			let e = t.indexOf('*/', i + 2);
			e = e < 0 ? t.length : e + 2;
			comments.push({ start: i, end: e, kind: 'css', multiline: false });
			i = e;
			continue;
		}
		if (c === '"' || c === "'") {
			const e = skipString(t, i);
			tokens.push(t.slice(i, e));
			i = e;
			continue;
		}
		if ((c === 'u' || c === 'U') && /^url\(/i.test(t.slice(i, i + 4)) && !IDENT.test(t[i - 1] ?? '') && t[i - 1] !== '-') {
			let j = i + 4;
			while (WS.test(t[j] ?? '')) j++;
			if (t[j] !== '"' && t[j] !== "'") {
				let e = t.indexOf(')', j);
				e = e < 0 ? t.length : e + 1;
				tokens.push(t.slice(i, e));
				i = e;
				continue;
			}
		}
		i++;
	}
	return { comments, tokens };
};

/** removes comment ranges from a text: a comment alone on its line takes the line with it, a trailing one takes the
 *  spaces before it; one between code keeps a separator (JS: a space, or a line break if it spanned lines, so automatic
 *  semicolon insertion reads the same; CSS and HTML: nothing, a comment there separates no tokens) */
const cut = (t, comments) => {
	let out = '';
	let at = 0;
	for (const { start, end, kind, multiline } of comments) {
		let s = start;
		let e = end;
		let rep = '';
		const ls = t.lastIndexOf('\n', s - 1) + 1;
		let le = t.indexOf('\n', e);
		if (le < 0) le = t.length;
		const before = t.slice(Math.max(ls, at), s);
		const after = t.slice(e, le);
		if (!after.trim() && !before.trim() && ls >= at) {
			s = ls;
			e = Math.min(le + 1, t.length);
		} else if (!after.trim()) {
			while (s > at && (t[s - 1] === ' ' || t[s - 1] === '\t')) s--;
		} else if (kind === 'block' || kind === 'line') {
			if (multiline) rep = '\n';
			else if (!WS.test(t[s - 1] ?? ' ') && !WS.test(t[e] ?? ' ')) rep = ' ';
		}
		out += t.slice(at, s) + rep;
		at = e;
	}
	return out + t.slice(at);
};

const sameTokens = (a, b) => a.length === b.length && a.every((x, k) => x === b[k]);

/** the built shell without developer comments: HTML comments outside script / style, and the CSS and JS comments
 *  inside them. Returns null (with the reason) if any stripped block fails its checks. */
export const stripShellComments = (html) => {
	const parts = []; // [text, kind] in order, kind 'html' | 'js' | 'css' | 'raw'
	let i = 0;
	let textFrom = 0;
	const lower = html.toLowerCase();
	while (i < html.length) {
		if (html.startsWith('<!--', i)) {
			i = html.indexOf('-->', i + 4);
			i = i < 0 ? html.length : i + 3;
			continue;
		}
		if (html[i] === '<' && /[a-zA-Z]/.test(html[i + 1] ?? '')) {
			// the tag itself, attribute quotes respected
			let j = i + 1;
			while (j < html.length && html[j] !== '>') {
				if (html[j] === '"' || html[j] === "'") {
					const q = html.indexOf(html[j], j + 1);
					j = q < 0 ? html.length : q + 1;
				} else j++;
			}
			const tag = html.slice(i, j + 1);
			const name = /^<([a-zA-Z]+)/.exec(tag)[1].toLowerCase();
			i = j + 1;
			if (name === 'script' || name === 'style') {
				const close = lower.indexOf(`</${name}`, i);
				const end = close < 0 ? html.length : close;
				parts.push([html.slice(textFrom, i), 'html']);
				const type = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1]?.toLowerCase();
				const isJs = name === 'script' && !/\ssrc\s*=/i.test(tag) && (!type || type === 'text/javascript' || type === 'module');
				parts.push([html.slice(i, end), name === 'style' ? 'css' : isJs ? 'js' : 'raw']);
				textFrom = i = end;
			}
			continue;
		}
		i++;
	}
	parts.push([html.slice(textFrom), 'html']);

	let out = '';
	const removed = { html: 0, css: 0, js: 0 };
	for (const [text, kind] of parts) {
		if (kind === 'raw') { out += text; continue; }
		if (kind === 'html') {
			const comments = [];
			let k = 0;
			while ((k = text.indexOf('<!--', k)) >= 0) {
				let e = text.indexOf('-->', k + 4);
				e = e < 0 ? text.length : e + 3;
				comments.push({ start: k, end: e, kind: 'html', multiline: false });
				k = e;
			}
			removed.html += comments.length;
			out += cut(text, comments);
			continue;
		}
		const scan = kind === 'js' ? scanJs : scanCss;
		const before = scan(text);
		const stripped = cut(text, before.comments);
		const after = scan(stripped);
		if (after.comments.length || !sameTokens(before.tokens, after.tokens)) return { html: null, why: `a ${kind} block's strings changed` };
		if (kind === 'js' && !/\btype\s*=\s*["']?module/i.test(out.slice(out.lastIndexOf('<script')))) {
			try { new Script(stripped); } catch (e) { return { html: null, why: `a stripped script no longer compiles (${e.message})` }; }
		}
		removed[kind] += before.comments.length;
		out += stripped;
	}
	return { html: out, removed };
};

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

	// no developer comments in a shipped shell (Corey 2026-10-21 "they shouldn't be in the production or staging builds")
	const withComments = html;
	const st = stripShellComments(html);
	let stripNote;
	if (st.html) {
		html = st.html;
		const gz = (t) => gzipSync(Buffer.from(t)).length;
		stripNote =
			`comments stripped (${st.removed.html} HTML, ${st.removed.css} CSS, ${st.removed.js} JS): ` +
			`${Buffer.byteLength(withComments)} -> ${Buffer.byteLength(html)} B, gzip ${gz(withComments)} -> ${gz(html)} B`;
	} else {
		console.warn(`[prune-build] comments NOT stripped from index.html: ${st.why}. The shell is written with them.`);
		stripNote = 'comments NOT stripped';
	}

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
			(freed ? `, dropped ${(freed / 1024).toFixed(0)} KB of unreferenced chunks` : '') +
			`; ${stripNote}`,
	);
};

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
	pruneBuild(new URL('../build/', import.meta.url).pathname);
}
