<script lang="ts">
	import { type Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import { Authenticate, LoadI18n } from 'components-shared';
	import ChromeStyles from '../ui/ChromeStyles.svelte';
	import Game from '../components/Game.svelte';
	import { setContext } from '../game/context';
	import { boot, startLandingPreload, releaseSplash } from '../game/boot.svelte';
	import { STAGING_TOOLS } from '../game/staging';

	import messagesMap from '../i18n/messagesMap';

	type Props = { children: Snippet };

	const props: Props = $props();

	// The PolyMath loader is no longer a component: it is static HTML + CSS in src/app.html, so it
	// paints as soon as the shell's head arrives instead of waiting for this bundle to download and
	// execute (43 s on Slow 4G, measured 2026-09-15). The sample kit's "Powered By Stake Engine" GIF
	// is still gone — the submission PreChecks forbid shipping it (approval review 2026-09-02).

	setContext();

	// LANDING FIRST (game/boot.svelte.ts): fetch only what the landing screen draws — fonts, logo,
	// the three primer cards — feeding the shell splash's green bar. Everything heavier waits:
	// the audiosprite below, and the Pixi preload (Game.svelte holds <App> unmounted). Authenticate
	// keeps running in parallel: it is latency-bound, not bandwidth-bound.
	startLandingPreload();

	// STAGING ONLY (game/staging.ts): `?perf=1` in a PUBLIC_STAGING=1 build (or on the dev server) mounts the
	// measurement readout (src/staging/). STAGING_TOOLS is a build-time constant: in a production build this
	// whole block, the import and the readout's code are dropped (scripts/check-production-bundle.mjs proves it).
	if (STAGING_TOOLS && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('perf') === '1') {
		void import('../staging/mountPerf').then((m) => m.mountPerfReadout());
	}

	// The audio (sfx sprite + base loop) used to start at the very top of the app, competing with
	// everything else for a slow connection's bandwidth. It now starts once the Pixi preload is in
	// (components/Game.svelte), so it is the one thing the landing screen's yellow bar carries from
	// the splash's share to 100 (ui/LandingScreen.svelte) — ONE loading scale, Corey 2026-09-15.

	// Backstop for the splash handoff. Normally LandingScreen releases it the moment it is mounted
	// with the assets in (ui/LandingScreen.svelte); if it never mounts — a social-casino reload, a
	// dead Authenticate — do not sit on a full-screen splash forever.
	$effect(() => {
		if (!boot.landingReady || boot.landingMounted) return;
		const id = setTimeout(releaseSplash, 8000);
		return () => clearTimeout(id);
	});
</script>

<GlobalStyle>
	<Authenticate>
		<LoadI18n {messagesMap}>
			<Game />
		</LoadI18n>
	</Authenticate>
</GlobalStyle>

<ChromeStyles />

{@render props.children()}