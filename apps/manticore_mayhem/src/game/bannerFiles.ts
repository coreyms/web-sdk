// THE WAR STANDARD BANNER'S FILES (static/assets/ui/banner), written out as literal addresses HERE, in a file two
// folders deep in src, and nowhere else. game/banner/spec.ts stamps them and gives them their names.
//
// WHY HERE (2026-11-24). Vite leaves `new URL('<a path out of src>', import.meta.url)` as it is written, and in a build
// import.meta.url is the bundle, <game>/_app/immutable/bundle.<hash>.js: two folders deep in the game, whatever folder
// of src the line came from. So only '../../assets/...' is the game's own assets folder in a build, and only a file of
// src/<folder>/ has that same address on the dev server. These sixteen were written in game/banner/spec.ts (three
// folders deep) with three '../': right on the dev server, one folder ABOVE the game in a build. A game served from a
// server's root never showed it (a browser clamps the climb at the root); a build served from a subfolder, as Stake
// serves every game, got 404s for the cloths, the glyphs and the motion, and the feature intro and TOTAL WIN silently
// kept the old plaque. scripts/check-asset-paths.mjs (part of the build check) now fails on any address written that
// way, in the sources and in the built bundle.
const D = {
	fs: { intro: new URL('../../assets/ui/banner/banner-D-fs-intro.webp', import.meta.url).href, total: new URL('../../assets/ui/banner/banner-D-fs-total.webp', import.meta.url).href },
	super: { intro: new URL('../../assets/ui/banner/banner-D-super-intro.webp', import.meta.url).href, total: new URL('../../assets/ui/banner/banner-D-super-total.webp', import.meta.url).href },
	epic: { intro: new URL('../../assets/ui/banner/banner-D-epic-intro.webp', import.meta.url).href, total: new URL('../../assets/ui/banner/banner-D-epic-total.webp', import.meta.url).href },
};
const P = {
	fs: { intro: new URL('../../assets/ui/banner/banner-P-fs-intro.webp', import.meta.url).href, total: new URL('../../assets/ui/banner/banner-P-fs-total.webp', import.meta.url).href },
	super: { intro: new URL('../../assets/ui/banner/banner-P-super-intro.webp', import.meta.url).href, total: new URL('../../assets/ui/banner/banner-P-super-total.webp', import.meta.url).href },
	epic: { intro: new URL('../../assets/ui/banner/banner-P-epic-intro.webp', import.meta.url).href, total: new URL('../../assets/ui/banner/banner-P-epic-total.webp', import.meta.url).href },
};
/** the addresses as written (not yet stamped: game/banner/spec.ts hands each to assets.ts stamp()) */
export const BANNER_FILES = {
	/** the twelve cloths: texture class (D desktop, P phone), tier, content */
	cloth: { D, P },
	/** the banner's own count and amount glyphs, per texture class */
	glyphs: {
		D: new URL('../../assets/ui/banner/banner-glyphs-D.json', import.meta.url).href,
		P: new URL('../../assets/ui/banner/banner-glyphs-P.json', import.meta.url).href,
	},
	/** the baked motion */
	motion: {
		json: new URL('../../assets/ui/banner/banner-motion.json', import.meta.url).href,
		bin: new URL('../../assets/ui/banner/banner-motion.bin', import.meta.url).href,
	},
} as const;
