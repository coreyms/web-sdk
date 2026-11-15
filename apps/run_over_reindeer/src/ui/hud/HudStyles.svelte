<!-- THE HUD'S LOOK (HUD round 5, "Drop 6", approved 2026-11-12): the mockup's CSS (images/hud_round5_2026-11-12/concepts
     u1.js), every colour through ui/hudTheme.ts's tokens. Painted glass only: translucent fills, 1 px gradient edges,
     inset highlights, box-shadow. No backdrop-filter, no CSS filter, no mask, no blend mode. Every number is a mock px:
     the planes (.hudp) are drawn in mock px and scaled as a whole (ui/hud/hudLayout.ts). Animations are transform and
     opacity only. -->
<script lang="ts">
	import '../hudTheme';
	import './hud.css';
</script>
