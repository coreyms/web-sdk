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
	frameDesktop: { type: 'sprite', src: stamp(new URL('../../assets/ui/frame-desktop.png', import.meta.url).href), preload: true },
	frameMobile: { type: 'sprite', src: stamp(new URL('../../assets/ui/frame-mobile.png', import.meta.url).href), preload: true },
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
} as const;
