// @ts-nocheck: a node build script, not app code (svelte-check picks up .mjs files)
// THE PRODUCTION STRIP (2026-11-23, Corey on the column density test files: "CC1": they stay on staging, a production
// build drops them by itself).
//
// The column characters' `?rescap=` densities (tools/build_columns.py --tiers d150,d215; docs/COLUMN_DENSITY_TEST.md)
// are 264 files, about 73 MB, in static/assets/columns/. Only the `?rescap=` switch asks for them, and that switch is in
// a staging build or on the dev server only (game/deviceTier.ts forcedCap, game/staging.ts STAGING_TOOLS). They stay in
// static/ (the dev server and a PUBLIC_STAGING=1 build serve them) and a PRODUCTION build leaves them out, in three
// places, so nothing in it names a file it does not have:
//   1. the built files: stripBuild() takes them out of build/assets/ once adapter-static has copied static/ there
//      (vite.config.js, after scripts/prune-build.mjs);
//   2. the stamp tables: stripStampTable() takes their keys out of src/game/assetStamp.ts as it is bundled (the hash
//      table and fileBytes; scripts/stamp-assets.mjs still writes every file, for the dev server and staging);
//   3. the column spec: stripColumnSpec() takes the d150 and d215 tiers (and their tierScale entries) out of
//      src/game/columnClipSpec.ts as it is bundled, so their file names are not in the production bundle either.
//      game/road/columnClips.ts only ever reaches them through `?rescap=`, which a production build ignores.
// The source files on disk are never changed: (2) and (3) are a Vite transform of the module text, production only.
// scripts/check-production-bundle.mjs FAILS a production build that still has any of these files (and passes a staging
// build that has them); tools/production_strip_test.mjs holds both, with planted files.
import { readdirSync, rmSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** the density tiers a production build leaves out (columnClipSpec tier names) */
export const STAGING_ONLY_TIERS = ['d150', 'd215'];
/** a staging only file, named from the assets folder: columns/<clip>-d150-<n>.webp, columns/cloud-backdrop-d215.webp */
export const STAGING_ONLY_FILE = new RegExp(`^columns/[^/]+-(?:${STAGING_ONLY_TIERS.join('|')})(?:-\\d+)?\\.webp$`);
export const isStagingOnlyFile = (rel) => STAGING_ONLY_FILE.test(rel.split(sep).join('/'));

/** a staging build, by the same rule as game/staging.ts (PUBLIC_STAGING === '1' in $env/static/public) */
export const isStagingEnv = (env) => env?.PUBLIC_STAGING === '1';

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));

/** the staging only files in a build folder (paths from its assets folder) */
export const stagingOnlyFiles = (build) => {
	const assets = join(build, 'assets');
	if (!existsSync(assets)) return [];
	return walk(assets)
		.map((f) => relative(assets, f).split(sep).join('/'))
		.filter(isStagingOnlyFile)
		.sort();
};

/** takes the staging only files out of a built folder; returns what went */
export const stripBuild = (build) => {
	const files = stagingOnlyFiles(build);
	let bytes = 0;
	for (const rel of files) {
		const full = join(build, 'assets', rel);
		bytes += statSync(full).size;
		rmSync(full);
	}
	return { files: files.length, bytes };
};

/** one `export ... = {json} as const;` of a generated module, rewritten by fn; throws if the module is not that shape */
const rewriteConst = (code, head, fn, what) => {
	const at = code.indexOf(head);
	if (at < 0) throw new Error(`[production-strip] ${what}: "${head}" not found; the generated file changed shape`);
	const from = at + head.length;
	const end = code.indexOf('\n} as const;', from);
	if (end < 0) throw new Error(`[production-strip] ${what}: the end of "${head}" not found`);
	const value = JSON.parse(code.slice(from, end + 2));
	const out = fn(value);
	return code.slice(0, from) + JSON.stringify(out, null, '\t') + code.slice(end + 2);
};

/** src/game/columnClipSpec.ts without the staging only tiers */
export const stripColumnSpec = (code) =>
	rewriteConst(
		code,
		'export const COLUMN_CLIPS = ',
		(spec) => {
			const drop = (tiers) => {
				for (const t of STAGING_ONLY_TIERS) delete tiers[t];
			};
			drop(spec.tierScale);
			drop(spec.backdrop.tiers);
			for (const clips of Object.values(spec.clips)) for (const clip of Object.values(clips)) drop(clip.tiers);
			return spec;
		},
		'columnClipSpec.ts',
	);

/** src/game/assetStamp.ts without the staging only files' keys (the hash table and fileBytes) */
export const stripStampTable = (code) => {
	const keep = (table) => Object.fromEntries(Object.entries(table).filter(([rel]) => !isStagingOnlyFile(rel)));
	return rewriteConst(rewriteConst(code, 'export default ', keep, 'assetStamp.ts'), 'export const fileBytes = ', keep, 'assetStamp.ts fileBytes');
};

/** the Vite plugin: the two transforms and the strip of the built files, in a production build only */
export const productionStripPlugin = ({ loadEnv, build }) => {
	let staging = true; // until the config says otherwise: never strip by mistake
	let active = false;
	return {
		name: 'run-over-reindeer-production-strip',
		enforce: 'pre', // the TypeScript text as written (before esbuild takes `as const` off)
		apply: 'build',
		configResolved(config) {
			// the env as SvelteKit reads it for $env/static/public: the .env files of the app folder, then the process
			staging = isStagingEnv({ ...loadEnv(config.mode, config.envDir || config.root, ''), ...process.env });
			active = !staging;
		},
		transform(code, id) {
			if (!active) return null;
			const path = id.split('?')[0];
			if (path.endsWith('/src/game/columnClipSpec.ts')) return { code: stripColumnSpec(code), map: null };
			if (path.endsWith('/src/game/assetStamp.ts')) return { code: stripStampTable(code), map: null };
			return null;
		},
		/** called after scripts/prune-build.mjs (vite.config.js): the built files */
		stripBuilt() {
			if (!active || !existsSync(join(build, 'index.html'))) return;
			const r = stripBuild(build);
			if (r.files) console.log(`[production-strip] production build: ${r.files} staging only files left out (${(r.bytes / 1048576).toFixed(1)} MB, the ?rescap= column densities)`);
		},
	};
};
