// THE FRAMES ROUND A SHOW (DEV only: components/Board.svelte puts it on __reindeer.cardFrames inside its import.meta.env.DEV
// block, so a production build has none of it; tools/led_board_probe.mjs section `hitch`, 2026-11-22 wip/ledhitch). Every
// animation frame's length (the time from one requestAnimationFrame to the next: a long main thread task shows as one long
// frame), kept for the last 8192 frames, and asked for the longest one in a window round the moment a show came up (the
// scoreboard's ShowMark: a Free Spins or Super entry, a Total Win, a small or big win). Plain arithmetic on two typed arrays.

export type FrameWindow = { worstMs: number; worstAt: number; frames: number; over33: number; over50: number; over100: number };

export function frameRecorder() {
	const N = 8192;
	const end = new Float64Array(N);
	const len = new Float32Array(N);
	let n = 0;
	let last = -1;
	let on = true;
	const tick = (now: number) => {
		if (!on) return;
		if (last >= 0) {
			end[n % N] = now;
			len[n % N] = now - last;
			n += 1;
		}
		last = now;
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
	return {
		/** the frames that overlap [from, to] (performance.now() ms): the longest, when it ended, how many, how many long */
		window(from: number, to: number): FrameWindow {
			const r: FrameWindow = { worstMs: 0, worstAt: 0, frames: 0, over33: 0, over50: 0, over100: 0 };
			for (let i = Math.max(0, n - N); i < n; i++) {
				const j = i % N;
				if (end[j] < from || end[j] - len[j] > to) continue;
				r.frames += 1;
				if (len[j] > 33.4) r.over33 += 1;
				if (len[j] > 50) r.over50 += 1;
				if (len[j] > 100) r.over100 += 1;
				if (len[j] > r.worstMs) {
					r.worstMs = len[j];
					r.worstAt = end[j];
				}
			}
			r.worstMs = Math.round(r.worstMs * 10) / 10;
			return r;
		},
		/** the frames kept so far */
		count: () => n,
		stop: () => {
			on = false;
		},
	};
}
