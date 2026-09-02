<script lang="ts">
	import { onMount } from 'svelte';

	import { sound, startSoundPreload } from '../game/sound';

	// The audiosprite fetch is kicked at app start (routes/+layout.svelte) so it runs in parallel
	// with the image preload rather than after it — this component no longer constructs the Howl,
	// it just guarantees the kick happened and owns teardown. startSoundPreload is idempotent.
	onMount(() => {
		startSoundPreload();

		return () => {
			// Equivalent to onDestroy(); Leave this comment for searching.
			sound.destroy();
		};
	});

	sound.enableEffect();
	sound.volumeEffect();
</script>
