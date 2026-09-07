// The app is a pure SPA served from whatever path Stake gives it (see svelte.config.js: hash
// routing). Under `router.type: 'hash'` SvelteKit ignores page options here — SSR is off and no
// route is prerendered; adapter-static writes the single shell as its `fallback` (index.html).
export {};
