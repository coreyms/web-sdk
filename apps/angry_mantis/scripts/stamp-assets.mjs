// @ts-nocheck — node build script, not app code (svelte-check picks up .mjs files)
// Cache-buster for /assets/* — production serves them with Cache-Control: immutable, so a URL must
// change whenever its content changes or browsers keep year-old files forever (the "old atlas under
// new frame coordinates" bug). Runs before every `pnpm dev` / `pnpm build`:
//   1. bakes hashes INSIDE the loader JSONs (atlas meta.pngHash, audiosprite src[] ?v=),
//   2. hashes every file under static/assets and writes src/game/assetStamp.ts, which assets.ts
//      uses to append ?v=<hash> to the top-level URLs.
// Pixi's checkExtension and Howler's format sniffing both strip ?query — verified safe.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const ASSETS = join(APP, 'static', 'assets');

const h8 = (path) => createHash('md5').update(readFileSync(path)).digest('hex').slice(0, 8);
const strip = (ref) => ref.split('?')[0];

// 1a. sprite atlases: Pixi's spritesheet loader copies the JSON URL's search params onto the
// meta.image request (copySearchParams), so the PNG is fetched as <name>.png?v=<stamp of the JSON>.
// Embedding the PNG's own hash as a custom meta field makes the JSON's bytes — and therefore both
// URLs — change whenever the PNG changes, even if the frame coordinates didn't.
// per-insect pose sheets (sprites/poses-<p>.json, tools/make_placeholders.py) are discovered, not
// listed: Corey adds one insect at a time and each new sheet must stamp itself without a code edit
const poseAtlases = readdirSync(join(ASSETS, 'sprites'))
	.filter((name) => /^poses-.+\.json$/.test(name))
	.sort()
	.map((name) => `sprites/${name}`);

for (const rel of [
	'sprites/amSymbols/amSymbols.json',
	...poseAtlases,
	'rig/mantis-set.atlas.json', // BoneRutter character atlas — same TexturePacker JSON-hash shape
	'ui/numerals/numerals.json', // prison-stencil amount glyphs (generated from branding/prison-numbers.webp)
]) {
	const jsonPath = join(ASSETS, rel);
	const meta = JSON.parse(readFileSync(jsonPath, 'utf8'));
	const png = strip(meta.meta.image);
	meta.meta.image = png; // plain — the stamp arrives via copySearchParams from the JSON URL
	meta.meta.pngHash = h8(join(dirname(jsonPath), png));
	writeFileSync(jsonPath, JSON.stringify(meta, null, 1) + '\n');
}

// 1b. audio: every src[] entry -> "<path>?v=<hash of that file>". Two manifests now — the sfx
// audiosprite (sounds.json, one src[]) and the streamed music tracks (music.json, one src[] per
// track). Both are fetched by src/game/sound.ts and handed to Howler, and the per-file stamp is
// what stops an immutable-cached music loop from surviving a re-encode.
const stampSrc = (ref) => {
	const clean = strip(ref); // "./assets/audio/music/bgm_base.ogg"
	const rel = clean.replace(/^\.?\/?assets\//, ''); // "audio/music/bgm_base.ogg"
	return `${clean}?v=${h8(join(ASSETS, rel))}`;
};
{
	const jsonPath = join(ASSETS, 'audio', 'sounds.json');
	const manifest = JSON.parse(readFileSync(jsonPath, 'utf8'));
	manifest.src = manifest.src.map(stampSrc);
	writeFileSync(jsonPath, JSON.stringify(manifest, null, '\t') + '\n');
}
{
	const jsonPath = join(ASSETS, 'audio', 'music.json');
	const manifest = JSON.parse(readFileSync(jsonPath, 'utf8'));
	for (const track of Object.values(manifest.tracks)) track.src = track.src.map(stampSrc);
	writeFileSync(jsonPath, JSON.stringify(manifest, null, '\t') + '\n');
}

// 2. hash everything under static/assets (after the rewrites above, so JSON stamps reflect final bytes)
const stamps = {};
const walk = (dir) => {
	for (const entry of readdirSync(dir).sort()) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full);
		else if (!/^\.|\.py$/.test(entry)) stamps[relative(ASSETS, full)] = h8(full);
	}
};
walk(ASSETS);

// 3. byte sizes for the LANDING-FIRST phase (src/game/boot.svelte.ts). The green bar in the shell
// splash weights the bundle download and these assets by bytes, and it has to know the totals
// before a single one of them has answered — so they are baked here at build time rather than
// discovered from Content-Length (which a compressed transfer hides).
const LANDING = [
	'ui/intro/card-1.webp',
	'ui/intro/card-2.webp',
	'ui/intro/card-3.webp',
	'ui/logo-wide.webp',
	'fonts/ui/Outfit-Variable.woff2',
	'fonts/ui/Sora-Variable.woff2',
];
const landingSizes = Object.fromEntries(LANDING.map((rel) => [rel, statSync(join(ASSETS, rel)).size]));

// 4. ONE loading scale across both screens (Corey 2026-09-15): the splash's green bar stops at the
// share the bundle + landing assets + the Pixi preload are of EVERYTHING the landing waits on (the
// Pixi scene, the room included, only renders once its whole preload phase is in — pixi-svelte
// AssetsLoader — so the landing cannot show before it), and the landing screen's yellow bar starts
// from that share and carries the audio. The other two phases are sized here: every
// `preload: true` entry of game/assets.ts (a sprites atlas counts its json + image), minus what
// the landing set already fetched, and the audio the landing gates on (sfx sprite + base loop,
// first-choice format). The JS bundle's own size is only known after the build: scripts/prune-build.mjs
// adds it to window.__AM_BOOT.
const assetsTs = readFileSync(join(APP, 'src', 'game', 'assets.ts'), 'utf8');
const preloadFiles = new Set();
for (const block of assetsTs.match(/\{[^{}]*\}/g) ?? []) {
	if (!/preload:\s*true/.test(block)) continue;
	const m = /\.\.\/\.\.\/assets\/([A-Za-z0-9_./-]+)/.exec(block);
	if (!m) continue;
	preloadFiles.add(m[1]);
	if (m[1].endsWith('.json')) {
		try {
			const meta = JSON.parse(readFileSync(join(ASSETS, m[1]), 'utf8')).meta;
			if (meta?.image) preloadFiles.add(join(dirname(m[1]), String(meta.image).split('?')[0]));
		} catch {
			/* not an atlas manifest */
		}
	}
}
const sizeOrZero = (rel) => { try { return statSync(join(ASSETS, rel)).size; } catch { return 0; } };
const preloadBytes = [...preloadFiles].filter((rel) => !LANDING.includes(rel)).reduce((n, rel) => n + sizeOrZero(rel), 0);
const audioBytes = ['audio/sounds.ogg', 'audio/music/bgm_base.ogg'].reduce((n, rel) => n + sizeOrZero(rel), 0);
const bootSizes = { landing: Object.values(landingSizes).reduce((a, b) => a + b, 0), preload: preloadBytes, audio: audioBytes };

const out = `// AUTO-GENERATED by scripts/stamp-assets.mjs — do not edit; regenerated on every dev/build.
// Content hashes for files under static/assets, keyed by path relative to static/assets.
export default ${JSON.stringify(stamps, null, '\t')} as const;

// Byte sizes of the landing-screen critical path (game/boot.svelte.ts weights the green bar by them).
export const landingSizes = ${JSON.stringify(landingSizes, null, '\t')} as const;

// Byte totals of the three loading phases the landing screen waits on (the JS bundle is added by
// scripts/prune-build.mjs at build time): ONE loading scale across the splash and the landing bar.
export const bootSizes = ${JSON.stringify(bootSizes)} as const;
`;
writeFileSync(join(APP, 'src', 'game', 'assetStamp.ts'), out);
console.log(`stamp-assets: ${Object.keys(stamps).length} files stamped`);
