import stamps from './assetStamp';

// Every /assets/* URL carries ?v=<content hash> (see scripts/stamp-assets.mjs) because production
// serves static assets with Cache-Control: immutable — without the stamp, browsers that cached an
// old file will never revalidate it, even across deploys. Refs inside the JSONs (atlas meta.image,
// audiosprite src[]) are stamped by the same script.
export const stamp = (href: string): string => {
	const rel = href.split('/assets/').pop() ?? '';
	const v = (stamps as Record<string, string>)[rel];
	return v ? `${href}?v=${v}` : href;
};

export default {
	logoLandscape: { type: 'sprite', src: stamp(new URL('../../assets/ui/logo-landscape.webp', import.meta.url).href), preload: true },
	logoWide: { type: 'sprite', src: stamp(new URL('../../assets/ui/logo-wide.webp', import.meta.url).href), preload: true },
	// per-mode cafeteria backdrops (finishing-touches item 6): base/ante/regular bonus share one,
	// super and feast get their own. All preloaded so bonus entry never pops (tunable to lazy if
	// the loading screen suffers on cell connections).
	bgCafeteriaBase: { type: 'sprite', src: stamp(new URL('../../assets/ui/cafeteria-background-base-bonus.webp', import.meta.url).href), preload: true },
	bgCafeteriaSuper: { type: 'sprite', src: stamp(new URL('../../assets/ui/cafeteria-background-super.webp', import.meta.url).href), preload: true },
	bgCafeteriaFeast: { type: 'sprite', src: stamp(new URL('../../assets/ui/cafeteria-background-feast.webp', import.meta.url).href), preload: true },
	frameCafeteria: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-frame-cafeteria.webp', import.meta.url).href), preload: true },
	doorSteel: { type: 'sprite', src: stamp(new URL('../../assets/ui/door-steel.webp', import.meta.url).href), preload: true },
	// hand-made gold text art (assets/images/overlays -> static/assets/ui/text): tier titles,
	// max-win lines, retrigger digits/words. Replaces canvas-rasterized GameText at the biggest
	// presentation moments (cheaper too: resident textures, no per-string raster+upload).
	textBigWin: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/big-win.webp', import.meta.url).href), preload: true },
	textSuperWin: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/super-win.webp', import.meta.url).href), preload: true },
	textMegaWin: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/mega-win.webp', import.meta.url).href), preload: true },
	textEpicWin: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/epic-win.webp', import.meta.url).href), preload: true },
	textMaxWin: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/max-win.webp', import.meta.url).href), preload: true },
	textMaxWinBang: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/max-win-bang.webp', import.meta.url).href), preload: true },
	textTheyAteEverything: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/they-ate-everything.webp', import.meta.url).href), preload: true },
	// bonus stencil headers (branding/{feast,bonus,super}-header.webp): one image per mode carrying
	// BOTH lines of the header; the intro AND the wrap-up head with them (the label-*.webp pieces
	// now live only on the HTML bonus-buy cards, ui/bonusCards.ts). Preloaded — the door opens on
	// them, so a cold fetch would show an empty window for a frame.
	headerFeast: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/header-feast.webp', import.meta.url).href), preload: true },
	headerBonus: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/header-bonus.webp', import.meta.url).href), preload: true },
	headerSuper: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/header-super.webp', import.meta.url).href), preload: true },
	// big numeral + speed lines + "* FREE SPINS *" strip, one per awarded count (8 = bonus, 10 = super/feast)
	freeSpins10: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/free-spins-10.webp', import.meta.url).href), preload: true },
	freeSpins8: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/free-spins-8.webp', import.meta.url).href), preload: true },
	// mugshot height-chart backings (branding/inmate-{1,2}-chalk.webp) — Corey's art, label and
	// foot marks baked in; INMATE 01 is Marky (chart labels left), INMATE 02 is Marty (labels right)
	inmateChalk1: { type: 'sprite', src: stamp(new URL('../../assets/ui/inmate-1-chalk.webp', import.meta.url).href), preload: true },
	inmateChalk2: { type: 'sprite', src: stamp(new URL('../../assets/ui/inmate-2-chalk.webp', import.meta.url).href), preload: true },
	// gold bonus-board stencil alphabet (A-Z + boxed 1/2/3), sliced from assets/images/ui/bonus-board-alphabet.webp
	// by tools/build_glyph_atlas.py — the rule titles and number badges draw from it as batched
	// sprites, so the intro's headings never rasterize text (see game/stencilLayout.ts).
	goldAlphabet: {
		type: 'sprites',
		src: stamp(new URL('../../assets/ui/gold-alphabet/gold-alphabet.json', import.meta.url).href),
		preload: true,
	},
	// prison-stencil numerals: every amount glyph (digits, separators, currency symbols, GC/SC/R$)
	// in one atlas — amounts render as batched sprites with ZERO per-frame rasterization
	numeralsAtlas: {
		type: 'sprites',
		src: stamp(new URL('../../assets/ui/numerals/numerals.json', import.meta.url).href),
		preload: true,
	},
	// bonus-intro headshots (real character art; the in-game corner mantises stay on amCharacters
	// placeholder frames until the Spine rig lands)
	martyHeadshot: { type: 'sprite', src: stamp(new URL('../../assets/characters/marty-headshot.webp', import.meta.url).href), preload: true },
	markyHeadshot: { type: 'sprite', src: stamp(new URL('../../assets/characters/marky-headshot.webp', import.meta.url).href), preload: true },
	amSymbols: {
		type: 'sprites',
		src: stamp(new URL('../../assets/sprites/amSymbols/amSymbols.json', import.meta.url).href),
		preload: true,
	},
	amCharacters: {
		type: 'sprites',
		src: stamp(new URL('../../assets/sprites/amCharacters/amCharacters.json', import.meta.url).href),
		preload: true,
	},
	// BoneRutter character atlas: registered here so the loading screen gates on the 760KB page
	// (no character pop-in); mantisRig.ts re-loads the same stamped URL and gets Pixi's cached sheet.
	mantisAtlas: {
		type: 'sprites',
		src: stamp(new URL('../../assets/rig/mantis-set.atlas.json', import.meta.url).href),
		preload: true,
	},
	sound: {
		type: 'audio',
		src: stamp(new URL('../../assets/audio/sounds.json', import.meta.url).href),
		preload: true,
	},
	// music manifest (tools/build_audiosprite.py). The tracks themselves are NOT in the sprite —
	// they stream one file at a time, so only this small JSON is fetched up front; its per-track
	// src[] entries carry their own ?v= stamps from scripts/stamp-assets.mjs.
	music: {
		type: 'audio',
		src: stamp(new URL('../../assets/audio/music.json', import.meta.url).href),
		preload: true,
	},
} as const;
