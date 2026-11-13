<script lang="ts" module>
	import { fitFont, UI_TEXT_FACE } from '../../game/textFit';
	// THE LAST-RESORT FIT. Every field is sized for the longest US amounts at one fixed type size (BALANCE $9,999,999.99,
	// WIN $1,250,000.00, the amount $1,000.00), so for them this always answers the nominal size. A longer string (another
	// currency, a trillion-coin GC balance) is shrunk to fit by the game's own helper (game/textFit.ts), never abbreviated.
	// Cached by the string's SHAPE (digits as 0, as the helper measures them), so a WIN count-up measures once per shape,
	// not per frame.
	const cache = new Map<string, number>();
	const fitted = (text: string, nominal: number, box: number) => {
		const key = `${nominal}|${box}|${text.replace(/\d/g, '0')}`;
		let v = cache.get(key);
		if (v === undefined) {
			v = fitFont({ text, nominal, box, weight: 900, face: UI_TEXT_FACE }) ?? nominal;
			if (cache.size > 400) cache.clear();
			cache.set(key, v);
		}
		return v;
	};
</script>

<script lang="ts">
	// A READOUT (BALANCE, WIN, the amount per spin): a fixed box (contain: layout, so a changing number never reflows the
	// HUD), a small spaced word over a tabular number. The probes' contract is kept: a .stat (a button, disabled unless it
	// opens something) holding a .label whose text is the word and a .value.
	type Props = {
		label: string;
		value: string;
		/** words drawn before the label (FREE SPINS before WIN), outside .label */
		pre?: string;
		x: number;
		y: number;
		w: number;
		h?: number;
		cls?: string;
		/** the number's type size (mock px) and the room it has: the fit's inputs */
		nominal: number;
		onclick?: () => void;
		disabled?: boolean;
		ariaLabel?: string;
		hud?: string;
		lit?: boolean;
		keep?: boolean;
	};
	const { label, value, pre = '', x, y, w, h, cls = '', nominal, onclick, disabled = false, ariaLabel, hud, lit = false, keep = false }: Props = $props();
	const interactive = $derived(!!onclick && !disabled);
	const font = $derived(fitted(value, nominal, w - 12));
</script>

<button
	type="button"
	class="stat {cls}"
	class:slot-btn={interactive}
	class:hg={interactive}
	class:press={interactive}
	class:keep
	data-hud={hud}
	data-hud-lit={lit ? '' : undefined}
	disabled={!interactive}
	{onclick}
	aria-label={ariaLabel}
	style:left="{x}px"
	style:top="{y}px"
	style:width="{w}px"
	style:height={h ? `${h}px` : undefined}
>
	<span class="lbw">{#if pre}<span class="pre">{pre}</span>{/if}<span class="label">{label}</span></span>
	<span class="value" style:font-size={font !== nominal ? `${font}px` : undefined}>{value}</span>
</button>
