// @ts-nocheck: a node build script, not app code (svelte-check picks up .mjs files)
// Asset cache-busting. Production serves the assets folder with an immutable cache header, so a URL must change when
// its content changes or browsers keep the old file forever. Runs before every `pnpm dev` and `pnpm build`:
//   - hashes every file under static/assets and writes src/game/assetStamp.ts (path -> 8 hex of its md5); every
//     asset URL in the game goes through game/assets.ts `stamp()`, which appends ?v=<hash>
//   - bakes the image's hash into each atlas JSON and stamps the audio manifests' own src lists
//   - writes the byte sizes the loading bar counts with (landing, preload, audio)
// (The house script, as Manticore Mayhem runs it, with this game's file lists.)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const ASSETS = join(APP, 'static', 'assets');

const h8 = (path) => createHash('md5').update(readFileSync(path)).digest('hex').slice(0, 8);
const strip = (ref) => ref.split('?')[0];

// Atlas manifests: record the image's content hash inside the JSON, so the JSON's own stamp changes whenever the
// image does (the sprite loader copies the JSON URL's query onto the image request).
for (const rel of [
	'symbols/symbols.json',
	'symbols/symbols-phone.json', // phone asset tier (game/deviceTier.ts)
]) {
	const jsonPath = join(ASSETS, rel);
	const meta = JSON.parse(readFileSync(jsonPath, 'utf8'));
	const png = strip(meta.meta.image);
	meta.meta.image = png; // plain: the stamp arrives via copySearchParams from the JSON URL
	meta.meta.pngHash = h8(join(dirname(jsonPath), png));
	writeFileSync(jsonPath, JSON.stringify(meta, null, 1) + '\n');
}

// Audio manifests: Howler fetches the src[] entries itself, so they are stamped in place.
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

const stamps = {};
const fileBytes = {}; // path -> bytes; an atlas manifest counts its image too (one load, two files)
const walk = (dir) => {
	for (const entry of readdirSync(dir).sort()) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full);
		else if (!/^\.|\.py$/.test(entry)) {
			const rel = relative(ASSETS, full);
			stamps[rel] = h8(full);
			let bytes = statSync(full).size;
			if (entry.endsWith('.json')) {
				try {
					const image = JSON.parse(readFileSync(full, 'utf8'))?.meta?.image;
					if (image) bytes += statSync(join(dir, String(image).split('?')[0])).size;
				} catch {
					/* not an atlas manifest */
				}
			}
			fileBytes[rel] = bytes;
		}
	}
};
walk(ASSETS);

// What the landing screen itself draws: the two chrome faces and the game's own face. Their bytes are the first
// part of the loading bar (game/boot.svelte.ts).
const LANDING = ['fonts/ui/Outfit-Variable.woff2', 'fonts/ui/Sora-Variable.woff2', 'fonts/overpass/Overpass-heavy.woff2'];
const landingSizes = Object.fromEntries(LANDING.map((rel) => [rel, statSync(join(ASSETS, rel)).size]));

// The Pixi preload's bytes: every `preload: true` entry of game/assets.ts (an atlas counts its image).
const assetsTs = readFileSync(join(APP, 'src', 'game', 'assets.ts'), 'utf8');
const preloadFiles = new Set();
for (const block of assetsTs.match(/\{[^{}]*\}/g) ?? []) {
	if (!/preload:\s*true/.test(block)) continue;
	// the phone tier's twin is skipped on purpose: the bar is weighted by the desktop set, the heavier of the two
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
const sizeOrZero = (rel) => {
	try {
		return statSync(join(ASSETS, rel)).size;
	} catch {
		return 0;
	}
};
const preloadBytes = [...preloadFiles].filter((rel) => !LANDING.includes(rel)).reduce((n, rel) => n + sizeOrZero(rel), 0);
const audioBytes = ['audio/sounds.ogg', 'audio/music/bgm_base.ogg'].reduce((n, rel) => n + sizeOrZero(rel), 0);
const bootSizes = { landing: Object.values(landingSizes).reduce((a, b) => a + b, 0), preload: preloadBytes, audio: audioBytes };

const out = `// AUTO-GENERATED by scripts/stamp-assets.mjs. Do not edit; regenerated on every dev/build.
export default ${JSON.stringify(stamps, null, '\t')} as const;

export const fileBytes = ${JSON.stringify(fileBytes, null, '\t')} as const;

export const landingSizes = ${JSON.stringify(landingSizes, null, '\t')} as const;

export const bootSizes = ${JSON.stringify(bootSizes)} as const;
`;
writeFileSync(join(APP, 'src', 'game', 'assetStamp.ts'), out);
console.log(`stamp-assets: ${Object.keys(stamps).length} files stamped`);
