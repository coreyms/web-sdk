// DEV: THE PLAY HUB'S RING AS DRAWN NOW, read off the page (the main repo's tools/manticore/gear_bar_probe.js section
// `ring`). Three still layers make it (ui/gear/gearArt.ts playGearArt, ui/gear/gear.css):
//   ring   the colored ring over the hub's brass one (.hr-mode): on through a feature's free spins in its color, and
//          pulsed from full as a win lands, in the win color (or the feature's, inside a feature)
//   halo   the soft halo under the gear (.gl.glow): half strength through a feature, pulsed from full on a win,
//          breathing while autoplay runs
//   flash  the pale ring a win adds over the hub's (.gl.flash)
// `color` is the ring's stroke as computed. The frame's wheels draw the same color at game/frameGears.ts ringAt().
export const hubNow = (host: HTMLElement | undefined) => {
	const spin = host?.querySelector<HTMLElement>('button.spin');
	if (!spin) return null;
	const op = (sel: string) => {
		const el = spin.querySelector(sel);
		return el ? Number(getComputedStyle(el).opacity) : null;
	};
	const ring = spin.querySelector('.hr-mode');
	return { ring: op('.hr-mode'), halo: op('.gl.glow'), flash: op('.gl.flash'), color: ring ? getComputedStyle(ring).stroke : null, win: spin.classList.contains('win'), feature: spin.classList.contains('m-feature') };
};
