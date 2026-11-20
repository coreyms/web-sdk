// THE ENGRAVED MARK (2026-11-19, Corey on the approved mock logo_button_r1: "Do a mock up for that one button of only the
// logo ... No text. Only logo", his settings for the "etch" look, then "when the Ante or something is enabled we should
// go with the inlay style for the logo in the same spot. With the text over it for the mode enabled, similar to today").
// The PolyMath mark sunk into a key's glass, as an SVG string: a port of the mock's engraving() (its NOTES.md says how
// each look is built). No filter, mask, blend mode or blob: only <use> copies of the one outline (ui/hud/polymathMark.ts),
// translate() offsets, fills, strokes, a linear gradient, opacity and two clipPaths. Every offset and width is in screen
// px (the offset <g> wraps the mark's own transform; strokes are non-scaling), so a mark at 230 % of the key keeps a
// fine engraving. Its colors come from CSS variables set per key and per state (hud.css .fbtn): --e-deep (the key's dark
// glass), --e-hi (its highlight tint), --e-lt (its top light), the inlay gold --e-g1..g4 and the hub accent --e-accent.
import { POLYMATH_MARK } from './polymathMark';

export type EngraveLook = 'cut' | 'tone' | 'inlay' | 'etch' | 'emboss';
/** the mock's settings ("Copy my settings"): size = the mark's height in % of the key's height; x, y = its box's center
 *  from the key's center in % of the key's width and height; rot in degrees; depth, strength in %; light in degrees
 *  from the top (minus = from the left); hub = the center node in the game's accent */
export type EngraveSettings = { look: EngraveLook; hub: boolean; size: number; x: number; y: number; rot: number; depth: number; strength: number; light: number };

const [X0, Y0, X1, Y1] = POLYMATH_MARK.bbox;
const LH = Y1 - Y0;
const LCX = (X0 + X1) / 2;
const LCY = (Y0 + Y1) / 2;
const f = (n: number) => (Math.round(n * 1000) / 1000).toString();
let uid = 0;

/** the engraving for a key whose padding box is W x H px */
export const engraving = (W: number, H: number, st: EngraveSettings): string => {
	const id = `pm${++uid}`;
	const sc = ((st.size / 100) * H) / LH;
	const cx = W / 2 + (st.x / 100) * W;
	const cy = H / 2 + (st.y / 100) * H;
	const T = `translate(${f(cx)} ${f(cy)}) rotate(${st.rot}) scale(${f(sc)}) translate(${f(-LCX)} ${f(-LCY)})`;
	const a = (st.light * Math.PI) / 180;
	// away from the light: where the shadows fall
	const sx = -Math.sin(a);
	const sy = Math.cos(a);
	const D = st.depth / 100;
	const K = st.strength / 100;
	// full depth: 3.6 px on a 52 px key
	const d = D * 0.07 * Math.min(H, 60);
	const cl = (al: number) => f(Math.max(0, Math.min(1, al)));
	const C = (v: string, al: number) => `style="fill:rgba(var(${v}),${cl(al)})"`;
	const CS = (v: string, al: number, w: number) => `style="fill:none;stroke:rgba(var(${v}),${cl(al)});stroke-width:${f(w)}px;stroke-linejoin:round" vector-effect="non-scaling-stroke"`;
	const big = 40000;
	const comp = `M${-big} ${-big}H${big}V${big}H${-big}Z`;
	const out: string[] = [];
	out.push(`<svg width="${f(W)}" height="${f(H)}" viewBox="0 0 ${f(W)} ${f(H)}" aria-hidden="true"><defs>`);
	out.push(`<path id="${id}P" d="${POLYMATH_MARK.d}"/><path id="${id}C" d="${comp}${POLYMATH_MARK.d}" fill-rule="evenodd" clip-rule="evenodd"/><path id="${id}Hb" d="${POLYMATH_MARK.hub}"/>`);
	out.push(`<clipPath id="${id}in" clipPathUnits="userSpaceOnUse"><use href="#${id}P" transform="${T}"/></clipPath>`);
	out.push(`<clipPath id="${id}out" clipPathUnits="userSpaceOnUse"><use href="#${id}C" transform="${T}" clip-rule="evenodd"/></clipPath>`);
	// the inlay's metal: lit side to far side across the KEY (not the mark), so a cropped big mark still shades
	const gx1 = W / 2 - sx * H * 0.7;
	const gy1 = H / 2 - sy * H * 0.7;
	const gx2 = W / 2 + sx * H * 0.7;
	const gy2 = H / 2 + sy * H * 0.7;
	out.push(
		`<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="${f(gx1)}" y1="${f(gy1)}" x2="${f(gx2)}" y2="${f(gy2)}"><stop offset="0" style="stop-color:rgb(var(--e-g1))"/><stop offset=".38" style="stop-color:rgb(var(--e-g2))"/><stop offset=".72" style="stop-color:rgb(var(--e-g3))"/><stop offset="1" style="stop-color:rgb(var(--e-g4))"/></linearGradient>`,
	);
	// a soft diagonal sheen across the key (the inlay only)
	out.push(
		`<linearGradient id="${id}sh" gradientUnits="userSpaceOnUse" x1="${f(W * 0.18)}" y1="0" x2="${f(W * 0.18 + H * 0.9)}" y2="${f(H)}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".38"/><stop offset=".55" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
	);
	out.push(`</defs>`);
	const P = (style: string, ox = 0, oy = 0) => `<g transform="translate(${f(ox)} ${f(oy)})"><use href="#${id}P" transform="${T}" ${style}/></g>`;
	const Cm = (style: string, ox = 0, oy = 0) => `<g transform="translate(${f(ox)} ${f(oy)})"><use href="#${id}C" transform="${T}" fill-rule="evenodd" ${style}/></g>`;
	const Hub = (style: string) => `<use href="#${id}Hb" transform="${T}" ${style}/>`;
	const inside = (s: string) => `<g clip-path="url(#${id}in)">${s}</g>`;
	const outside = (s: string) => `<g clip-path="url(#${id}out)">${s}</g>`;
	// a band: copies of a shape stepping out to dist along (vx, vy), at most 0.3 px apart (no step shows at 4x); each
	// copy's alpha makes the stack reach A where all overlap (at the edge), fading linearly inward
	const band = (shape: (style: string, ox: number, oy: number) => string, v: string, A: number, dist: number, vx: number, vy: number) => {
		if (dist <= 0.01 || A <= 0) return '';
		const n = Math.max(2, Math.min(16, Math.ceil(dist / 0.3)));
		const al = 1 - Math.pow(1 - Math.min(0.98, A), 1 / n);
		let s = '';
		for (let i = 1; i <= n; i++) {
			const t = (dist * i) / n;
			s += shape(C(v, al), vx * t, vy * t);
		}
		return s;
	};
	let g = '';
	if (st.look === 'cut') {
		g += P(C('--hud-shadow-rgb', (0.3 + 0.28 * D) * K));
		if (st.hub) g += Hub(C('--e-accent', 0.7 * K));
		g += inside(band(Cm, '--hud-shadow-rgb', 0.62 * K, d, sx, sy) + band(Cm, '--e-lt', 0.22 * K * Math.min(1, D * 2), d * 0.45, -sx, -sy));
	} else if (st.look === 'tone') {
		g += P(C('--e-deep', (0.22 + 0.3 * D) * K));
		if (st.hub) g += Hub(C('--e-accent', 0.55 * K));
		g += inside(band(Cm, '--e-deep', 0.68 * K, d, sx, sy) + band(Cm, '--hud-shadow-rgb', 0.16 * K, d * 0.5, sx, sy) + band(Cm, '--e-hi', 0.3 * K * Math.min(1, D * 2), d * 0.45, -sx, -sy));
		g += outside(P(C('--e-lt', 0.2 * K * Math.min(1, D * 3)), sx * Math.max(0.5, d * 0.22), sy * Math.max(0.5, d * 0.22)));
	} else if (st.look === 'inlay') {
		g += P(`style="fill:url(#${id}g);fill-opacity:${f(Math.min(1, 0.95 * K))}"`);
		if (st.hub) g += Hub(C('--e-accent', 0.92 * K));
		g += inside(`<rect width="${f(W)}" height="${f(H)}" fill="url(#${id}sh)" opacity="${f(0.8 * K)}"/>` + band(Cm, '--hud-shadow-rgb', 0.45 * K, d * 0.5, sx, sy));
		g += P(CS('--hud-shadow-rgb', 0.5 * K, 0.6));
		g += outside(P(C('--e-lt', 0.24 * K * Math.min(1, D * 3)), sx * Math.max(0.5, d * 0.2), sy * Math.max(0.5, d * 0.2)));
	} else if (st.look === 'etch') {
		const gw = Math.max(0.7, Math.min(H, 60) * (0.016 + 0.026 * D));
		g += P(CS('--e-lt', 0.34 * K, gw), sx * gw * 0.55, sy * gw * 0.55);
		g += P(CS('--hud-shadow-rgb', (0.5 + 0.3 * D) * K, gw));
		g += P(CS('--hud-shadow-rgb', 0.35 * K, gw * 0.4), -sx * gw * 0.12, -sy * gw * 0.12);
		if (st.hub) g += Hub(C('--e-accent', 0.6 * K));
	} else {
		g += outside(band(P, '--hud-shadow-rgb', 0.5 * K, d * 1.1, sx, sy));
		g += P(C('--e-hi', 0.2 * K));
		if (st.hub) g += Hub(C('--e-accent', 0.7 * K));
		g += inside(band(Cm, '--e-lt', 0.4 * K, d * 0.6, sx, sy) + band(Cm, '--hud-shadow-rgb', 0.35 * K, d * 0.6, -sx, -sy));
	}
	out.push(g, '</svg>');
	return out.join('');
};
