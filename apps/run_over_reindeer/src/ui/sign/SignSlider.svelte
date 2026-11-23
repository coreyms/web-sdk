<script lang="ts">
	// THE SIGN PANELS' SLIDER (2026-11-23, the mock menus_r1_2026-11-23: "the slider: a line with the bar's diamond on
	// it"): a line with a yellow fill and the bar's diamond as its handle (ui/sign/signPanel.css .sp-sl). The whole row
	// takes the press: a press anywhere on it puts the diamond there and a drag follows the pointer (pointer capture, so a
	// finger that leaves the row keeps the drag); the arrow keys step by 5, Home and End go to the ends. Its press row is
	// as tall as the panel gives it (44 CSS px on a touch layout), whatever the drawn line's height.
	// (A browser's own range input was not used: on an iPhone only its thumb starts a drag, and the thumb would have had
	// to be as narrow as the diamond.)
	import './signPanel.css';

	type Props = { value: number; onchange: (v: number) => void; label: string };
	const { value, onchange, label }: Props = $props();
	let el: HTMLDivElement | undefined = $state();
	let drag = $state(false);
	/** the diamond's travel stops 9 px (of the slider's own px) short of each end: half its width */
	const INSET = 9;
	const slideTo = (clientX: number) => {
		if (!el) return;
		const r = el.getBoundingClientRect();
		if (r.width <= 0 || el.offsetWidth <= 0) return;
		// (the panel is scaled as a whole: the inset in the px the pointer is measured in)
		const k = r.width / el.offsetWidth;
		const p = Math.max(0, Math.min(1, (clientX - r.left - INSET * k) / (r.width - 2 * INSET * k)));
		const v = Math.round(p * 100);
		if (v !== value) onchange(v);
	};
	const down = (e: PointerEvent) => {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		e.preventDefault();
		el?.setPointerCapture?.(e.pointerId);
		drag = true;
		el?.focus({ preventScroll: true });
		slideTo(e.clientX);
	};
	const move = (e: PointerEvent) => {
		if (drag) slideTo(e.clientX);
	};
	const up = () => (drag = false);
	const key = (e: KeyboardEvent) => {
		const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : 0;
		const to = e.key === 'Home' ? 0 : e.key === 'End' ? 100 : step ? Math.max(0, Math.min(100, value + step)) : null;
		if (to === null) return;
		e.preventDefault();
		if (to !== value) onchange(to);
	};
</script>

<div
	bind:this={el}
	class="sp-sl"
	class:off={value === 0}
	class:drag
	style:--p={value / 100}
	role="slider"
	tabindex="0"
	aria-valuemin="0"
	aria-valuemax="100"
	aria-valuenow={value}
	aria-label={label}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	onlostpointercapture={up}
	onkeydown={key}
>
	<div class="sp-sl-t"><i class="sp-sl-f"></i></div>
	<i class="sp-sl-k"></i>
</div>
