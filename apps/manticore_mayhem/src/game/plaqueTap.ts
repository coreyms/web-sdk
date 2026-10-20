// THE PLAQUE AS A TAP TARGET (1.0.04, the recap: STORYBOARD.md section 6). The plaque itself takes no press (its layers are
// eventMode none, as before); components/SpinRecap.svelte listens on the page and asks here whether a tap landed on the
// plaque's dark field. components/BoardPlaque.svelte fills these in when it mounts: the field's four corners on the page
// (CSS px, through the plaque's one perspective) and the field's box. Plain functions, no Pixi in the caller.
export const plaqueTap = {
	/** the dark field's corners on the page, CSS px (TL, TR, BR, BL), or null before the plaque is up */
	quad: (): { x: number; y: number }[] | null => null,
};

/** is the page point (CSS px) inside the plaque's dark field? */
export const onPlaque = (x: number, y: number): boolean => {
	const q = plaqueTap.quad();
	if (!q || q.length !== 4) return false;
	// a convex quad: the point is on the same side of every edge
	let sign = 0;
	for (let i = 0; i < 4; i += 1) {
		const a = q[i];
		const b = q[(i + 1) % 4];
		const c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
		if (c === 0) continue;
		const s = c > 0 ? 1 : -1;
		if (sign === 0) sign = s;
		else if (s !== sign) return false;
	}
	return true;
};

/** the field's box on the page (CSS px), or null */
export const plaqueBox = (): { left: number; top: number; right: number; bottom: number } | null => {
	const q = plaqueTap.quad();
	if (!q) return null;
	return { left: Math.min(...q.map((p) => p.x)), right: Math.max(...q.map((p) => p.x)), top: Math.min(...q.map((p) => p.y)), bottom: Math.max(...q.map((p) => p.y)) };
};
