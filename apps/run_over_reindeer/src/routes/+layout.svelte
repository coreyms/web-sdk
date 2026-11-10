<script lang="ts">
	import { type Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import { Authenticate, LoadI18n } from 'components-shared';
	import ChromeStyles from '../ui/ChromeStyles.svelte';
	import Game from '../components/Game.svelte';
	import { setContext } from '../game/context';
	import { boot, startLandingPreload, releaseSplash } from '../game/boot.svelte';
	import { installFixtureRgs } from '../fixtures/fixtureRgs';
	import { STAGING_TOOLS } from '../game/staging';

	import messagesMap from '../i18n/messagesMap';

	type Props = { children: Snippet };

	const props: Props = $props();

	// The PolyMath loader is static HTML + CSS in src/app.html, so it paints as soon as the shell's head
	// arrives instead of waiting for this bundle to download and execute (the house rule). The sample
	// kit's "Powered By Stake Engine" GIF is not shipped: the submission PreChecks forbid it.

	// DEV AND STAGING, THE LOCAL FIXTURE ROUNDS (src/fixtures/): with no rgs_url in the address, or rgs_url=fixture,
	// the wallet and play requests are answered in the page from showcase rounds, so the game plays end to end
	// through the SAME path a real RGS drives (Authenticate, the play request, the book events).
	// Installed here, before <Authenticate> mounts and sends the first request.
	// Staging too since 2026-11-10 (Corey: "Yes go with A"): until the math is settled there are no books and no
	// RGS for this game, so a PUBLIC_STAGING=1 build plays the showcase rounds on his devices. STAGING_TOOLS is a
	// build-time constant: a production build drops the whole block, the import and the fixture files with it
	// (scripts/check-production-bundle.mjs looks for ROR_FIXTURE_RGS).
	if (STAGING_TOOLS) installFixtureRgs();

	// STAGING ONLY (game/staging.ts): `?perf=1` in a PUBLIC_STAGING=1 build (or on the dev server) mounts the
	// measurement readout (src/staging/). STAGING_TOOLS is a build-time constant: in a production build this
	// branch, the dynamic import and the readout's whole module are dropped (scripts/check-production-bundle.mjs).
	if (STAGING_TOOLS && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('perf') === '1') {
		void import('../staging/mountPerf').then((m) => m.mountPerfReadout());
	}

	setContext();

	// LANDING FIRST (game/boot.svelte.ts): fetch only what the landing screen draws (its fonts), feeding
	// the shell splash's bar. Everything heavier waits: the audio and the Pixi preload (Game.svelte
	// holds <App> unmounted). Authenticate keeps running in parallel: it is latency-bound, not
	// bandwidth-bound.
	startLandingPreload();

	// Backstop for the splash handoff. Normally LandingScreen releases it the moment it is mounted
	// with the assets in (ui/LandingScreen.svelte); if it never mounts (a social-casino reload, a
	// dead Authenticate), do not sit on a full-screen splash forever.
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