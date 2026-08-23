export default {
	logoLandscape: { type: 'sprite', src: new URL('../../assets/ui/logo-landscape.webp', import.meta.url).href, preload: true },
	logoWide: { type: 'sprite', src: new URL('../../assets/ui/logo-wide.webp', import.meta.url).href, preload: true },
	bgJungle: { type: 'sprite', src: new URL('../../assets/ui/bg-jungle.webp', import.meta.url).href, preload: true },
	frameDesktop: { type: 'sprite', src: new URL('../../assets/ui/frame-desktop.png', import.meta.url).href, preload: true },
	frameMobile: { type: 'sprite', src: new URL('../../assets/ui/frame-mobile.png', import.meta.url).href, preload: true },
	martyArt: { type: 'sprite', src: new URL('../../assets/ui/marty.png', import.meta.url).href, preload: true },
	markyArt: { type: 'sprite', src: new URL('../../assets/ui/marky.png', import.meta.url).href, preload: true },
	amSymbols: {
		type: 'sprites',
		src: new URL('../../assets/sprites/amSymbols/amSymbols.json', import.meta.url).href,
		preload: true,
	},
	amCharacters: {
		type: 'sprites',
		src: new URL('../../assets/sprites/amCharacters/amCharacters.json', import.meta.url).href,
		preload: true,
	},
	sound: {
		type: 'audio',
		src: new URL('../../assets/audio/sounds.json', import.meta.url).href,
		preload: true,
	},
} as const;
