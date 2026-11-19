// @ts-nocheck: a node probe helper, not app code (svelte-check picks up .mjs files)
// THE ROUND CARD'S PRESS FOR PROBES THAT PLAY A BONUS ROUND THROUGH (2026-11-17). Since the Free Spins and Super entries
// (and a wrap-up that carries a top-up or the cap line) wait for the player's press when no autoplay runs
// (game/constants.ts ROUND.introWaitsForPress, lineOutroWaitsForPress), a probe that plays such a round must press.
// pressRoundCards(ctx) adds a script to every page of the browser context (reloads included): it presses the card's
// own press catcher (ui/RoundCard.svelte `button.catch`, the player's press) once the board's card waits for the press
// AND has been up as long as the card used to wait by itself (the entry 4 s, the wrap-up 6 s: ROUND.introAutoMs,
// outroAutoMs), so the round runs on the timing these probes were written for. A card that continues by itself (a plain
// wrap-up, a card of an autoplay run with Autoplay Bonuses on) is never pressed early. Since 2026-11-18 an autoplay run's
// entry waits for the press too unless Autoplay Bonuses is on (ui/RoundCard.svelte); this presses it like any other. Each card is pressed once; the presses are listed in window.__cardPresses.
export async function pressRoundCards(ctx) {
	await ctx.addInitScript(() => {
		const seen = new Map();
		window.__cardPresses = [];
		// THE SUPER WHEEL (2026-11-18, game/road/superWheel.ts): it waits for a press like the entry card does (its own press
		// target, ui/WheelGate.svelte `button[data-wheel-gate]`); once it has waited 0.6 s it is pressed, once per wait
		// (window.__wheelPresses). With Autoplay Bonuses running it starts itself and is never there to press.
		window.__wheelPresses = [];
		let gateSince = null;
		setInterval(() => {
			const gate = document.querySelector('button[data-wheel-gate]');
			if (!gate) gateSince = null;
			else if (gateSince === null) gateSince = performance.now();
			else if (gateSince > 0 && performance.now() - gateSince >= 600) {
				window.__wheelPresses.push({ waitedMs: Math.round(performance.now() - gateSince) });
				gateSince = -1;
				gate.click();
			}
		}, 100);
		setInterval(() => {
			const h = window.__reindeer;
			const btn = document.querySelector('button.catch:not([data-wheel-gate])');
			if (!h?.scoreboard || !btn) return;
			const s = h.scoreboard()?.show;
			if (!s || !['fs', 'sfs', 'total'].includes(s.kind)) return;
			const now = performance.now();
			const rec = seen.get(s.id) ?? { at: now, pressed: false };
			seen.set(s.id, rec);
			const after = s.kind === 'total' ? 6000 : 4000;
			if (rec.pressed || s.phase !== 'waits' || now - rec.at < after) return;
			rec.pressed = true;
			window.__cardPresses.push({ kind: s.kind, upMs: Math.round(now - rec.at) });
			btn.click();
		}, 100);
	});
}
