// @ts-nocheck: a node test script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/ui/{FeatureMenu.svelte,fastLaneBox.ts}; flUpHeroArt, FL_HERO, flScale, --sign-h, --thumb-h, --art-h, data-fl-hero, .nosign
// THE FAST LANE'S HERO ON UPRIGHT SCREENS (2026-11-23, Corey's iPhone at 440 x 742: "the ANTE Sign doesn't show above like
// the presents"): node only, no browser.
//   node --experimental-strip-types --no-warnings tools/fast_lane_hero_test.mjs            (from apps/run_over_reindeer)
//   TABLE=1 ... prints every frame
// The hero's row is what the upright column leaves; the game measures it and asks src/ui/fastLaneBox.ts flUpHeroArt for
// the art's size (the presents and the Ante's sign scale with the row; dropped under 70 px of row; the sign also under
// 63 CSS px tall, where its small lines would be under 9 px). Here the row is worked out from THE COLUMN'S OWN NUMBERS
// (a model of the style block's upright layout: its paddings, gaps, fixed heights, and its text rows at the stage's
// line height 1.266, with the bundled faces' advances for the two wrapped lines), with no mode on and no squeeze:
//   1. per frame and mode (the Ante, Free Spins, Super Free Spins): the hero's art box, or declared absent with why
//   2. where it is drawn, the box lies inside the hero's row, so it meets neither the title and the close key (the row
//      over it) nor the PER PLAY tile (the row under it), and inside the column's width
//   3. the sign is never drawn under 63 CSS px, and its ANTE and PLAY lines never under 9 CSS px
//   4. at Corey's frame, 440 x 742, the sign is drawn
//   5. the frames where the sign is absent while the presents show are the ones named below, and no others
//   6. the sign's own size is written out in the style block (no aspect-ratio, no percentage height, no container units)
// The model reads no browser: text heights are the stage's line height times the type size, as every browser draws
// them since the stage has a line height of its own (Safari drew Overpass's rows 21 % taller before that).
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
// (the game's files import each other with no extension)
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s.startsWith('.') && !/\\.[a-z]+$/.test(s) ? n(s + '.ts', c) : n(s, c); }`));
const F = await import(pathToFileURL(join(APP, 'src', 'ui', 'fastLaneBox.ts')).href);
const D = await import(pathToFileURL(join(APP, 'src', 'game', 'featureMenuData.ts')).href);
const FM = readFileSync(join(APP, 'src', 'ui', 'FeatureMenu.svelte'), 'utf8');
const MET = JSON.parse(readFileSync(join(APP, 'tools', 'amount_fit_metrics.json'), 'utf8'));

let pass = 0;
let fail = 0;
const check = (ok, what, detail) => {
	if (ok) pass++;
	else fail++;
	if (!ok || process.env.TABLE) console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail).slice(0, 400) : ''}`);
};
const r1 = (v) => Math.round(v * 10) / 10;
const sum = (a) => a.reduce((x, y) => x + y, 0);

// ---- the style block's own numbers, read from it where one line holds them ----
const LH = Number((FM.match(/\n\t\tline-height: (1\.\d+);\n\t\tcolor: #f2f5f9;/) ?? [])[1]);
check(LH === 1.266, `the stage has a line height of its own (${LH}): the same row heights in every browser`);
check(/\.sign \{[^}]*height: var\(--sign-h\);[^}]*width: calc\(var\(--sign-h\) \* 863 \/ 1188\);/.test(FM) && !/\.sign \{[^}]*aspect-ratio/.test(FM) && !/\.sign[^{]*\{[^}]*cqh/.test(FM), "the sign's size is written out: its height a length, its width that height x 863 / 1188 (no aspect-ratio, no container units)");
check(/\.obj \{[^}]*--sign-h: var\(--art-h\);/.test(FM) && /\.thumb \{[^}]*height: var\(--thumb-h\);[^}]*--sign-h: var\(--thumb-h\);/.test(FM), 'the hero gives the sign its art height, a tile its thumb height');
check(/--art-h: min\(86cqh, 210px\);/.test(FM) && /@container \(max-height: 70px\) \{\n\t\t\.up \.obj,/.test(FM) && F.FL_HERO.share === 0.86 && F.FL_HERO.max === 210 && F.FL_HERO.dropAt === 70, "flUpHeroArt holds the style block's own rule (86 % of the row, 210 px at most, dropped at 70 px)");

// ---- text widths (the bundled faces' advances) and a greedy wrap ----
const width = (t, px, face) => [...t].reduce((em, ch) => em + (MET.faces[face][/\d/.test(ch) ? '0' : ch] ?? MET.missing), 0) * px;
const lines = (text, px, box, face) => {
	let n = 1;
	let w = 0;
	const space = width(' ', px, face);
	for (const word of text.split(' ')) {
		const ww = width(word, px, face);
		if (w > 0 && w + space + ww > box) {
			n++;
			w = ww;
		} else w += (w > 0 ? space : 0) + ww;
	}
	return n;
};
const plain = (s) => s.replace(/\*\*/g, '');
const RATIO = { ANTE: F.FL_HERO.signRatio, BONUS: 649 / 726, SUPER: 649 / 726 }; // COPY OF static/assets/fastlane/present-*-phone.webp: 649 x 726

/** the upright column at a window, for the mode chosen (nothing switched on, no squeeze): the hero's row and its art */
const column = (vw, vh, mode) => {
	const s = F.flScale('up', vw, vh);
	const H = vh / s;
	const W = Math.min(vw / s - 2 * 12, 420);
	const short = H < 700;
	const rowGap = short ? 6 : 8;
	const head = 44; // the close key; the title's line is lower
	const tile = short ? 56 : 72;
	const trayGap = short ? 4 : 6;
	const tray = 2 * (12 * LH) + 2 * tile + 3 * trayGap; // two group lines (12 px spaced words), the Ante's tile, the two features' tiles
	const ante = mode === 'ANTE';
	const plateIn = W - 2 * 14 - 2 * 3;
	const parts = [short ? 26 : 11 * LH + 26]; // the small line (not on a short screen) over the name (26 px, line height 1)
	if (!short) parts.push(lines(plain(D.FAST_LANE_TEXT.say[ante ? 'ANTE_2' : mode]), 13, plateIn, 'Outfit Text|400') * 13 * 1.22);
	if (ante) parts.push(44); // LEVEL: the three stops
	parts.push(3 * ((short ? 2 : 4) + 1 + 12.5 * LH)); // three odds rows
	parts.push(46 + 4 + 10 * LH); // the amount plaque over its small word (ACTIVATE beside it is lower)
	const plate = 2 * 3 + (short ? 18 : 22) + sum(parts) + (parts.length - 1) * (short ? 5 : 7);
	const note = lines(`${D.MAX_WIN_NOTE.label}: ${D.MAX_WIN_NOTE.value}. ${D.FEATURE_MENU_TEXT.averageNote}`, 10.5, W, 'Outfit Text|400') * 10.5 * 1.3;
	const hud = 10 * LH + 44; // PLAY AMOUNT's word over its row of 44 px keys
	const heroH = H - (2 * 8 + 5 * rowGap + head + tray + plate + note + hud);
	const hero = { x0: (vw / s - W) / 2, x1: (vw / s + W) / 2, y0: 8 + head + rowGap, y1: 8 + head + rowGap + Math.max(0, heroH) };
	const art = heroH > 0 ? F.flUpHeroArt({ heroH, s, ante }) : null;
	const why = art !== null ? '' : heroH <= 0 ? 'the column fills the window (the squeeze takes over)' : heroH <= F.FL_HERO.dropAt ? `the row is ${r1(heroH)} px, 70 or less` : `the sign would be ${r1(Math.min(0.86 * heroH, 210) * s)} CSS px tall, under 63`;
	const box = art === null ? null : { x0: vw / s / 2 - (art * RATIO[mode]) / 2, x1: vw / s / 2 + (art * RATIO[mode]) / 2, y0: (hero.y0 + hero.y1) / 2 - art / 2, y1: (hero.y0 + hero.y1) / 2 + art / 2 };
	return { s, H, W, short, heroH, hero, art, box, why, css: art === null ? null : art * s };
};

const FRAMES = [[440, 742], [413, 586], [375, 530], [320, 568], [390, 844], [393, 852], [430, 932], [425, 812], [412, 915], [375, 667], [360, 780], [360, 640], [390, 620], [768, 1024]];
const signOnly = [];
for (const [vw, vh] of FRAMES) {
	const c = { ANTE: column(vw, vh, 'ANTE'), BONUS: column(vw, vh, 'BONUS'), SUPER: column(vw, vh, 'SUPER') };
	for (const mode of ['ANTE', 'BONUS', 'SUPER']) {
		const m = c[mode];
		const tag = `${vw}x${vh} ${mode}`;
		if (m.box === null) {
			check(m.why !== '', `${tag}: no hero (${m.why})`);
			continue;
		}
		const inside = m.box.y0 >= m.hero.y0 - 0.01 && m.box.y1 <= m.hero.y1 + 0.01 && m.box.x0 >= m.hero.x0 - 0.01 && m.box.x1 <= m.hero.x1 + 0.01;
		check(inside, `${tag}: the hero's art is ${r1(m.art * RATIO[mode] * m.s)} x ${r1(m.css)} CSS px, inside its row (${r1(m.heroH)} px at ${m.s.toFixed(3)}): clear of the title and the close key over it and the PER PLAY tile under it`, m);
		if (mode === 'ANTE') check(m.css >= F.FL_HERO.signFloorCss - 0.01 && m.css * F.FL_HERO.signFace * F.FL_HERO.signSmallLine >= 8.99, `${tag}: the sign is ${r1(m.css)} CSS px tall, its ANTE and PLAY lines ${r1(m.css * F.FL_HERO.signFace * F.FL_HERO.signSmallLine)} px`);
	}
	if (c.ANTE.box === null && c.BONUS.box !== null) signOnly.push(`${vw}x${vh}`);
	console.log(`${vw}x${vh}: Ante ${c.ANTE.css === null ? `absent (${c.ANTE.why})` : `${r1(c.ANTE.css)} px`}; Free Spins ${c.BONUS.css === null ? `absent (${c.BONUS.why})` : `${r1(c.BONUS.css)} px`}; Super ${c.SUPER.css === null ? 'absent' : `${r1(c.SUPER.css)} px`} tall`);
}
check(column(440, 742, 'ANTE').box !== null, "at Corey's frame, 440 x 742, the Ante's sign is drawn");
// the frames here whose Ante card leaves no room for the sign while a present still shows
const EXPECT = (process.env.EXPECT_ABSENT ?? '413x586,375x530,390x620').split(',').filter(Boolean);
check(JSON.stringify(signOnly) === JSON.stringify(EXPECT), `the sign is absent where a present shows at ${EXPECT.join(', ') || 'no frame'} only`, signOnly);
console.log(`fast_lane_hero_test: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
