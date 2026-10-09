// Loads the plaque's runtime data once: stinger.json (recipes, topology, metrics) and stinger-motion.bin
// (int16 vertex tracks), decoded to Float32Arrays. The atlases ride the deferred asset phase
// (game/assets.ts); this is two small fetches the plaque component starts when it mounts.
import type { MeshLayerJson, MotionLayer, StingerData, StingerJson } from './types';

/** int16 track -> floats. `unit` is one number, or one per component of the (a, b) pairs. */
const decode = (bin: Int16Array, offset: number, count: number, unit: number | [number, number]): Float32Array => {
	const out = new Float32Array(count);
	const ua = typeof unit === 'number' ? unit : unit[0];
	const ub = typeof unit === 'number' ? unit : unit[1];
	for (let i = 0; i < count; i += 2) {
		out[i] = bin[offset + i] * ua;
		out[i + 1] = bin[offset + i + 1] * ub;
	}
	return out;
};

export const decodeStinger = (json: StingerJson, buffer: ArrayBuffer): StingerData => {
	const bin = new Int16Array(buffer);
	const m = json.motion;
	const movers: MotionLayer[] = [];
	for (const layer of m.layers) {
		if (layer.type !== 'mesh' || layer.share) continue;
		const L = layer as Required<MeshLayerJson>;
		const n = L.nv * 2;
		movers.push({
			name: L.name,
			nv: L.nv,
			polar: L.add === 'polar',
			pivotX: L.pivot[0],
			pivotY: L.pivot[1],
			uvs: new Float32Array(L.uvs),
			indices: new Uint32Array(L.indices),
			idle: decode(bin, L.idle.offset, m.idleFrames * n, L.idle.unit),
			tier: decode(bin, L.tier.offset, m.tierFrames * n, L.tier.unit),
			land: decode(bin, L.land.offset, m.landFrames * n, L.land.unit),
			gain: layer.gain ? new Float32Array(layer.gain) : null,
		});
	}
	return { json, movers };
};

let pending: Promise<StingerData> | null = null;

/** resolves once both files are in; a failed fetch clears the cache so the next call retries */
export const loadStingerData = (urls: { json: string; bin: string }): Promise<StingerData> => {
	pending ??= (async () => {
		const [json, buffer] = await Promise.all([
			fetch(urls.json).then((r) => {
				if (!r.ok) throw new Error(`stinger.json ${r.status}`);
				return r.json() as Promise<StingerJson>;
			}),
			fetch(urls.bin).then((r) => {
				if (!r.ok) throw new Error(`stinger-motion.bin ${r.status}`);
				return r.arrayBuffer();
			}),
		]);
		return decodeStinger(json, buffer);
	})().catch((error) => {
		pending = null;
		throw error;
	});
	return pending;
};
