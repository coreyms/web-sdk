// THE WAR STANDARD's baked cloth motion (tools/war_banner/bake_motion.py from the approved sim a9): one small JSON and
// one int16 file, fetched once (normal stamped URLs, never a blob: URL) and decoded once into absolute positions.
// Design px (desktop CSS px), x from the banner's centre line, y down from the pole's line, 60 fps.
import { BANNER_MOTION_URLS } from './spec';

type Seq = { start: number; count: number; simFrom: number; vdep: number[]; cy: number[]; R: number[] };
type Path = { cy: number[]; cz: number[]; R: number[] };
export type BannerMotionJson = {
	fps: number;
	quant: number;
	cols: number;
	rows: number;
	u: number[];
	v: number[];
	width: number;
	texV0: number;
	texV1: number;
	coreR: number;
	layer: number;
	length: number;
	restPaid: number;
	seq: Record<'unroll' | 'loop' | 'rollup', Seq>;
	order: string[];
	entry: Path;
	retreat: Path;
	stats: Record<string, number>;
};

export type BannerMotion = {
	json: BannerMotionJson;
	/** absolute positions, 1 / quant px, [frame][vertex][x, y], frames in json.order */
	pos: Int16Array;
	/** vertices per frame */
	nv: number;
};

let loading: Promise<BannerMotion> | null = null;

export const loadBannerMotion = (): Promise<BannerMotion> => {
	loading ??= (async () => {
		const [json, buf] = await Promise.all([
			fetch(BANNER_MOTION_URLS.json).then((r) => {
				if (!r.ok) throw new Error(`banner motion json ${r.status}`);
				return r.json() as Promise<BannerMotionJson>;
			}),
			fetch(BANNER_MOTION_URLS.bin).then((r) => {
				if (!r.ok) throw new Error(`banner motion bin ${r.status}`);
				return r.arrayBuffer();
			}),
		]);
		const nv = json.cols * json.rows;
		const pos = new Int16Array(buf);
		// each sequence's first frame is absolute, the rest per frame deltas: sum them once, in place
		for (const name of ['unroll', 'loop', 'rollup'] as const) {
			const s = json.seq[name];
			for (let f = 1; f < s.count; f += 1) {
				const a = (s.start + f) * nv * 2;
				const b = a - nv * 2;
				for (let i = 0; i < nv * 2; i += 1) pos[a + i] += pos[b + i];
			}
		}
		return { json, pos, nv };
	})();
	loading.catch(() => (loading = null));
	return loading;
};
