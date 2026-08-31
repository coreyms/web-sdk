// stake.us social casinos prohibit gambling vocabulary in every player-visible surface
// (docs: approval-guidelines/jurisdiction-requirements — bet, buy, stake, purchase, paid, …).
// The RGS signals a social session via the `social=true` URL parameter, fixed for the session.
//
// Read window.location directly instead of stateUrlDerived.social(): that helper goes through
// SvelteKit's `page` store, which is NOT populated yet when module-scope string tables
// (gameInfoText, betModeMeta, bonusCards, i18n catalogs) are built — it silently returned the
// standard strings. The app is ssr:false, so window exists whenever any module initialises.
export const IS_SOCIAL =
	typeof window !== 'undefined' &&
	new URLSearchParams(window.location.search).get('social') === 'true';

// Use soc(standard, social) for any string that needs gambling vocabulary on stake.com;
// where a neutral phrasing reads fine everywhere, prefer a single unconditional string instead.
export const soc = <T>(standard: T, social: T): T => (IS_SOCIAL ? social : standard);
