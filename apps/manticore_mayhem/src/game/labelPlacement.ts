// WHERE THE CLUSTER LABELS SIT. A pure function with no imports (so node can run it as it is:
// tools/manticore/label_place_check.mjs), in CELL units: x to the right, y down, the board is
// [0, grid] x [0, grid], a cellIndex is reel * grid + row (reel = column).
//
// Corey 2026-10-09: "When multiple clusters are near each other for clearing, like on a super scatter, the
// numbers end up overlapping so we can't see the individual amounts."
//
// The rule, in order:
//   1. ANCHOR   each label starts on its cluster's visual centre: the centroid of its cells, and when that
//               point is not on a cell of the cluster (an L, a U, a ring) the centre of the cluster's
//               nearest cell, so a label never sits over a hole or over somebody else's symbol.
//   2. FENCE    the label's box is kept inside the board opening (less `edge`).
//   3. SEPARATE every pair of boxes closer than `gap` is pushed apart along the axis of LEAST overlap, half
//               each (a wide short label therefore slides up or down, almost never sideways), fenced again,
//               for up to `passes` passes. A label against the fence stops and its partner takes the rest
//               on the next pass.
//   4. SHRINK   a set that still collides is laid out again at the next smaller size in `scales` (one size
//               for the whole set, so the numbers on one board read as one family), down to the floor.
//   5. STAGGER  whatever still collides at the floor is separated in TIME: `after[i]` lists the earlier
//               labels label i must not share the screen with (the engine starts i when they have left).
//               `wave[i]` is the same thing as a colouring (0 = shows at once).
// Deterministic: the same clusters always give the same picture (ties break by index).

/** one label to place: its cluster's cells, and its box at size 1 (cells) */
export type LabelSpec = { cells: number[]; w: number; h: number };
export type PlaceOptions = {
	/** the board's side in cells (8) */
	grid: number;
	/** clear space kept between two boxes, cells */
	gap: number;
	/** clear space kept between a box and the opening's edge, cells */
	edge: number;
	/** relaxation passes per size */
	passes: number;
	/** the sizes tried, largest first; the last is the floor */
	scales: readonly number[];
};
export type PlacedLabel = {
	/** the label's centre, cells */
	x: number;
	y: number;
	/** its box as drawn (already times `scale`), cells */
	w: number;
	h: number;
	/** where it wanted to be (rule 1) */
	anchorX: number;
	anchorY: number;
};
export type Placement = {
	labels: PlacedLabel[];
	/** the size the whole set is drawn at (one of `scales`) */
	scale: number;
	/** pairs [i, j] (i < j) that still collide at the floor; empty when the set fits */
	collisions: [number, number][];
	/** per label: the earlier labels it must wait for (rule 5); every list empty when the set fits */
	after: number[][];
	/** per label: 0 = shows at once, k = the k-th wave */
	wave: number[];
	/** relaxation passes the chosen size took */
	passes: number;
};

const EPS = 1e-4;

/** rule 1: the centroid, or the centre of the cluster's cell nearest to it when it falls off the cluster */
export const clusterAnchor = (cells: readonly number[], grid: number): { x: number; y: number; snapped: boolean } => {
	if (!cells.length) return { x: grid / 2, y: grid / 2, snapped: false };
	let sx = 0;
	let sy = 0;
	for (const c of cells) {
		sx += Math.floor(c / grid) + 0.5;
		sy += (c % grid) + 0.5;
	}
	const cx = sx / cells.length;
	const cy = sy / cells.length;
	let best = -1;
	let bestD = Infinity;
	for (const c of cells) {
		const x = Math.floor(c / grid) + 0.5;
		const y = (c % grid) + 0.5;
		// on (or on the edge of) this cell: the centroid is already over the cluster
		if (Math.abs(cx - x) <= 0.5 + EPS && Math.abs(cy - y) <= 0.5 + EPS) return { x: cx, y: cy, snapped: false };
		const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
		if (d < bestD - EPS || (Math.abs(d - bestD) <= EPS && c < best)) {
			bestD = d;
			best = c;
		}
	}
	return { x: Math.floor(best / grid) + 0.5, y: (best % grid) + 0.5, snapped: true };
};

/** how far two boxes are inside each other's keep-out on each axis (both > 0 = they collide) */
export const overlapOf = (a: PlacedLabel, b: PlacedLabel, gap: number): { ox: number; oy: number } => ({
	ox: (a.w + b.w) / 2 + gap - Math.abs(a.x - b.x),
	oy: (a.h + b.h) / 2 + gap - Math.abs(a.y - b.y),
});

/** the pairs that collide (i < j) */
export const collisionsOf = (labels: readonly PlacedLabel[], gap: number, tol = 1e-3): [number, number][] => {
	const out: [number, number][] = [];
	for (let i = 0; i < labels.length; i += 1) {
		for (let j = i + 1; j < labels.length; j += 1) {
			const { ox, oy } = overlapOf(labels[i], labels[j], gap);
			if (ox > tol && oy > tol) out.push([i, j]);
		}
	}
	return out;
};

const fence = (l: PlacedLabel, grid: number, edge: number) => {
	const hw = l.w / 2;
	const hh = l.h / 2;
	// a box wider than the opening is centred in it (the engine also fits its text to the opening)
	l.x = l.w >= grid - 2 * edge ? grid / 2 : Math.min(grid - edge - hw, Math.max(edge + hw, l.x));
	l.y = l.h >= grid - 2 * edge ? grid / 2 : Math.min(grid - edge - hh, Math.max(edge + hh, l.y));
};

const layoutAt = (specs: readonly LabelSpec[], anchors: readonly { x: number; y: number }[], scale: number, o: PlaceOptions) => {
	const labels: PlacedLabel[] = specs.map((s, i) => ({ x: anchors[i].x, y: anchors[i].y, w: s.w * scale, h: s.h * scale, anchorX: anchors[i].x, anchorY: anchors[i].y }));
	for (const l of labels) fence(l, o.grid, o.edge);
	let passes = 0;
	for (; passes < o.passes; passes += 1) {
		let moved = false;
		for (let i = 0; i < labels.length; i += 1) {
			for (let j = i + 1; j < labels.length; j += 1) {
				const a = labels[i];
				const b = labels[j];
				const { ox, oy } = overlapOf(a, b, o.gap);
				if (ox <= EPS || oy <= EPS) continue;
				moved = true;
				if (oy <= ox) {
					// the usual case for a wide, short label: one goes up, one goes down. Which: the one that
					// is (or wanted to be) higher goes up; a dead tie breaks by index.
					const d = a.y - b.y || a.anchorY - b.anchorY || -1;
					const push = oy / 2 + EPS;
					a.y += d < 0 ? -push : push;
					b.y += d < 0 ? push : -push;
				} else {
					const d = a.x - b.x || a.anchorX - b.anchorX || -1;
					const push = ox / 2 + EPS;
					a.x += d < 0 ? -push : push;
					b.x += d < 0 ? push : -push;
				}
			}
		}
		if (!moved) break;
		for (const l of labels) fence(l, o.grid, o.edge);
	}
	return { labels, passes };
};

/** rules 1 to 5 for one win set */
export const placeLabels = (specs: readonly LabelSpec[], o: PlaceOptions): Placement => {
	const anchors = specs.map((s) => clusterAnchor(s.cells, o.grid));
	const scales = o.scales.length ? o.scales : [1];
	let pick: { labels: PlacedLabel[]; passes: number } | null = null;
	let scale = scales[0];
	let collisions: [number, number][] = [];
	for (const s of scales) {
		pick = layoutAt(specs, anchors, s, o);
		scale = s;
		collisions = collisionsOf(pick.labels, o.gap);
		if (!collisions.length) break;
	}
	const labels = pick ? pick.labels : [];
	const after: number[][] = labels.map(() => []);
	for (const [i, j] of collisions) after[j].push(i);
	// the waves: a label takes the first wave none of the earlier labels it collides with is in
	const wave: number[] = labels.map(() => 0);
	for (let j = 0; j < labels.length; j += 1) {
		const used = new Set(after[j].map((i) => wave[i]));
		let k = 0;
		while (used.has(k)) k += 1;
		wave[j] = k;
	}
	return { labels, scale, collisions, after, wave, passes: pick ? pick.passes : 0 };
};
