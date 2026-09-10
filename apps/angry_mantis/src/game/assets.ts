import stamps from './assetStamp';

// Every /assets/* URL carries ?v=<content hash> (see scripts/stamp-assets.mjs) because production
// serves static assets with Cache-Control: immutable — without the stamp, browsers that cached an
// old file will never revalidate it, even across deploys. Refs inside the JSONs (atlas meta.image,
// audiosprite src[]) are stamped by the same script.
// Root-absolute `/assets/...` inputs come back PAGE-RELATIVE (`assets/...`): on Stake's CDN the game
// is served at https://<team>.cdn.stake-engine.com/<game>/<version>/index.html, so a leading slash
// resolves against the CDN root and 404s (every HTML <img>, the numeral sheet and the @font-face
// URLs went missing on the first engine.io publish, 2026-09-07). The Pixi loaders never hit this
// because they build their URLs from import.meta.url.
export const stamp = (href: string): string => {
	const rel = href.split('/assets/').pop() ?? '';
	const v = (stamps as Record<string, string>)[rel];
	const base = href.startsWith('/assets/') ? href.slice(1) : href;
	return v ? `${base}?v=${v}` : base;
};

// TWO LOAD PHASES (pixi-svelte AssetsLoader). `preload: true` gates the landing screen: everything the
// base game draws in its first seconds. `preload: false` keeps downloading behind the game and is
// only needed once a bonus starts or a big win lands — bonusStart / setWin / the resume path await
// game/assetGate.ts before they draw any of it, so a slow connection never shows a hole. Before this
// split every key was gated: 9.7 MB (≈49 s on Fast 3G) before PRESS ANYWHERE (Stake review 2026-09-02).
export default {
	// per-mode cafeteria backdrops (finishing-touches item 6): base/ante/regular bonus share one,
	// super and feast get their own. Only the base scene gates the landing; the other two ride the
	// deferred phase (bonusStart awaits it, so bonus entry still never pops).
	bgCafeteriaBase: { type: 'sprite', src: stamp(new URL('../../assets/ui/cafeteria-background-base-bonus.webp', import.meta.url).href), preload: true },
	bgCafeteriaSuper: { type: 'sprite', src: stamp(new URL('../../assets/ui/cafeteria-background-super.webp', import.meta.url).href), preload: false },
	bgCafeteriaFeast: { type: 'sprite', src: stamp(new URL('../../assets/ui/cafeteria-background-feast.webp', import.meta.url).href), preload: false },
	frameCafeteria: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-frame-cafeteria.webp', import.meta.url).href), preload: true },
	// board backdrop behind the symbols (Corey's dimpled steel tray plates, 1220×985 = the frame
	// window at the frame art's scale, one plate per cell on the 5×4 pitch): shows in the seams, in
	// the drop, in emptied cells and under the scatter tease. Board.svelte, zIndex −2.
	boardBackdrop: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-backdrop.webp', import.meta.url).href), preload: true },
	doorSteel: { type: 'sprite', src: stamp(new URL('../../assets/ui/door-steel.webp', import.meta.url).href), preload: false },
	// reflectivity mask for the frame's inner steel lips (Corey's paint-over of the frame art, same
	// 1415x1217 canvas): white = chrome that mirrors the reels, alpha = strength. FrameReflections.
	frameReflectMask: { type: 'sprite', src: stamp(new URL('../../assets/ui/board-frame-reflect.png', import.meta.url).href), preload: true },
	// bonus stencil headers (branding/{feast,bonus,super}-header.webp): one image per mode carrying
	// BOTH lines of the header; the intro AND the wrap-up head with them (the label-*.webp pieces
	// now live only on the HTML bonus-buy cards, ui/bonusCards.ts). Preloaded — the door opens on
	// them, so a cold fetch would show an empty window for a frame.
	headerFeast: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/header-feast.webp', import.meta.url).href), preload: false },
	headerBonus: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/header-bonus.webp', import.meta.url).href), preload: false },
	headerSuper: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/header-super.webp', import.meta.url).href), preload: false },
	// big numeral + speed lines + "* FREE SPINS *" strip, one per awarded count (8 = bonus, 10 = super/feast)
	freeSpins10: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/free-spins-10.webp', import.meta.url).href), preload: false },
	freeSpins8: { type: 'sprite', src: stamp(new URL('../../assets/ui/text/free-spins-8.webp', import.meta.url).href), preload: false },
	// mugshot height-chart backings (branding/inmate-{1,2}-chalk.webp) — Corey's art, label and
	// foot marks baked in; INMATE 01 is Marky (chart labels left), INMATE 02 is Marty (labels right)
	inmateChalk1: { type: 'sprite', src: stamp(new URL('../../assets/ui/inmate-1-chalk.webp', import.meta.url).href), preload: false },
	inmateChalk2: { type: 'sprite', src: stamp(new URL('../../assets/ui/inmate-2-chalk.webp', import.meta.url).href), preload: false },
	// Corey's branded (rusty-metal) title alphabet, sliced by tools/build_branded_glyphs.py: the
	// win-tier titles, ON THE MENU and THEY ATE EVERYTHING are set from it letter by letter
	// (components/BrandedTitle.svelte) so they can move per glyph. Every frame has a `_halo`
	// twin (pre-blurred) for the menu glow.
	brandedGlyphs: {
		type: 'sprites',
		src: stamp(new URL('../../assets/ui/branded-glyphs/branded-glyphs.json', import.meta.url).href),
		preload: false,
	},
	// prison-stencil numerals: every amount glyph (digits, separators, currency symbols, GC/SC/R$)
	// in one atlas — amounts render as batched sprites with ZERO per-frame rasterization
	numeralsAtlas: {
		type: 'sprites',
		src: stamp(new URL('../../assets/ui/numerals/numerals.json', import.meta.url).href),
		preload: true,
	},
	// bonus-intro headshots (real character art)
	// soft ellipse under each mantis's feet (BoneRig ground shadow); tiny, so it rides the preload
	groundShadow: { type: 'sprite', src: stamp(new URL('../../assets/ui/ground-shadow.webp', import.meta.url).href), preload: true },
	// gravity-drop landing dust: Corey's dust_poof sheet, six 512×192 frames stacked top to bottom
	// (a 12 px empty stub under the last one); sliced into frame textures by game/dustTexture.ts.
	// Every landing plays it from the first spin, so it rides the preload.
	dustPoof: { type: 'sprite', src: stamp(new URL('../../assets/ui/dust-poof.webp', import.meta.url).href), preload: true },
	// ambient background layer (game/ambientSpec.ts): the exhaust fan's blade ring + static hub cap.
	// Gated with the base backdrop — the housing is empty in the art, so the fan must be there at first paint.
	fanBlades: { type: 'sprite', src: stamp(new URL('../../assets/ui/ambient/fan-blades.webp', import.meta.url).href), preload: true },
	fanHub: { type: 'sprite', src: stamp(new URL('../../assets/ui/ambient/fan-hub.webp', import.meta.url).href), preload: true },
	// sky behind the window panes (the room art is cut to alpha there) + the bonus cloud atlases
	// (tools/build_clouds.py). The base sky is on screen from the first paint; the others and the
	// clouds are bonus-only and ride the deferred phase (bonusStart awaits it).
	skyBase: { type: 'sprite', src: stamp(new URL('../../assets/ui/ambient/sky-base.webp', import.meta.url).href), preload: true },
	skySuper: { type: 'sprite', src: stamp(new URL('../../assets/ui/ambient/sky-super.webp', import.meta.url).href), preload: false },
	skyFeast: { type: 'sprite', src: stamp(new URL('../../assets/ui/ambient/sky-feast.webp', import.meta.url).href), preload: false },
	cloudsSuper: { type: 'sprites', src: stamp(new URL('../../assets/ui/ambient/clouds-super.json', import.meta.url).href), preload: false },
	cloudsFeast: { type: 'sprites', src: stamp(new URL('../../assets/ui/ambient/clouds-feast.json', import.meta.url).href), preload: false },
	// day-sky birds (base scene, small): rides the preload with the base sky
	birds: { type: 'sprites', src: stamp(new URL('../../assets/ui/ambient/birds.json', import.meta.url).href), preload: true },
	// floor cockroaches (base scene): eight walk frames, 20 KB
	roach: { type: 'sprites', src: stamp(new URL('../../assets/ui/ambient/roach.json', import.meta.url).href), preload: true },
	// the housefly (base scene): eight wing-beat frames
	fly: { type: 'sprites', src: stamp(new URL('../../assets/ui/ambient/fly.json', import.meta.url).href), preload: true },
	// lamp "off" patches for the flicker (tools/build_clouds.py from background-lights-off.webp)
	lightOffHanging: { type: 'sprite', src: stamp(new URL('../../assets/ui/ambient/light-off-hanging.webp', import.meta.url).href), preload: true },
	lightOffSconce: { type: 'sprite', src: stamp(new URL('../../assets/ui/ambient/light-off-sconce.webp', import.meta.url).href), preload: true },
	lightOffCounter: { type: 'sprite', src: stamp(new URL('../../assets/ui/ambient/light-off-counter.webp', import.meta.url).href), preload: true },
	// big-win STINGER plates (branding/stinger-{tier}.png, alpha-cropped): the tier sign the count-up
	// sits on (components/WinStinger.svelte, game/stinger.ts). Deferred like the other big-win art.
	stingerBig: { type: 'sprite', src: stamp(new URL('../../assets/ui/stingers/big.webp', import.meta.url).href), preload: false },
	stingerSuper: { type: 'sprite', src: stamp(new URL('../../assets/ui/stingers/super.webp', import.meta.url).href), preload: false },
	stingerMega: { type: 'sprite', src: stamp(new URL('../../assets/ui/stingers/mega.webp', import.meta.url).href), preload: false },
	stingerEpic: { type: 'sprite', src: stamp(new URL('../../assets/ui/stingers/epic.webp', import.meta.url).href), preload: false },
	stingerMax: { type: 'sprite', src: stamp(new URL('../../assets/ui/stingers/max.webp', import.meta.url).href), preload: false },
	martyHeadshot: { type: 'sprite', src: stamp(new URL('../../assets/characters/marty-headshot.webp', import.meta.url).href), preload: false },
	markyHeadshot: { type: 'sprite', src: stamp(new URL('../../assets/characters/marky-headshot.webp', import.meta.url).href), preload: false },
	amSymbols: {
		type: 'sprites',
		src: stamp(new URL('../../assets/sprites/amSymbols/amSymbols.json', import.meta.url).href),
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
