// THE STAGING BUILD FLAG (docs/device-quality-plan-v2.md A2; review S9).
//
// There is one build command, and staging runs the production build. Measuring on real phones needs two
// things that must never reach Stake: the `?rescap=` switch (game/deviceTier.ts) and the `?perf=1` readout
// (src/staging/). Both sit behind THIS constant, which is true only in a build made with the public
// environment variable PUBLIC_STAGING=1:
//
//     PUBLIC_STAGING=1 pnpm turbo run build --filter=manticore_mayhem...
//
// It is read through $env/static/public (the repo's convention, packages/envs), whose values are written
// into the bundle at build time: without the variable the comparison below is a constant false, the bundler
// drops every branch it guards, and the readout's module is never included. NEVER put the variable in a
// committed .env file. scripts/check-production-bundle.mjs fails a build that still contains the staging
// code; run it on every submission build (tools/manticore/README.md).
// @ts-ignore the app's tsconfig does not include SvelteKit's generated ambient types (packages/envs has the same import)
import * as publicEnv from '$env/static/public';

/** true only in a PUBLIC_STAGING=1 build */
export const STAGING: boolean = (publicEnv as Record<string, string | undefined>).PUBLIC_STAGING === '1';

/** the measurement tools are available: a staging build, or the dev server */
export const STAGING_TOOLS: boolean = import.meta.env.DEV || STAGING;

/** `?rescap=<n>` is held to this range (a typo must not ask a phone for a 30 megapixel canvas) */
export const RESCAP_RANGE = { min: 1, max: 3 } as const;

if (STAGING && typeof window !== 'undefined') {
	// a staging build says so (the bundle check looks for this exact string; so can a tester in the console)
	(window as unknown as Record<string, unknown>).__mmBuild = 'MM_STAGING_BUILD';
}
