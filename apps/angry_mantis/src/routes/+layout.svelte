<script lang="ts">
	import { type Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import { Authenticate, LoadI18n } from 'components-shared';
	import ChromeStyles from '../ui/ChromeStyles.svelte';
	import Game from '../components/Game.svelte';
	import { setContext } from '../game/context';
	import { startSoundPreload } from '../game/sound';
	import { boot, startLandingPreload, releaseSplash } from '../game/boot.svelte';

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

	// The audiosprite is ~a third of the landing payload and used to start at the very top of the
	// app, competing with the primer cards for a slow connection's bandwidth. It now starts at the
	// handoff and the landing screen's yellow bar still gates PRESS ANYWHERE on it (ui/LandingScreen).
	$effect(() => {
		if (boot.landingReady) startSoundPreload();
	});

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