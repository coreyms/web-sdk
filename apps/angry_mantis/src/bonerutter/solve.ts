/**
 * The shared runtime sampler and forward kinematics (RUNTIME-EXPORT §4.3,
 * §4.4) — a line-for-line port of `BoneRutterPack/RuntimeSolve.swift`. The
 * golden harness holds the two implementations to bit-exact `rot`/`alpha`
 * agreement, so every arithmetic expression here is part of the contract,
 * association order included: `a + (b - a) * t` is not the same double as
 * `(1 - t) * a + t * b`. Do not "clean up" the math.
 *
 * This module is pure — no Pixi, no DOM — so the vitest golden suite runs in
 * milliseconds with no browser.
 */

// MARK: .bonerig.json types

export interface Deform {
  /** meshX, meshY vertex counts; meshX*meshY must stay ≤ 100 to batch. */
  mesh: [number, number];
  /** Untrimmed source PNG size in px. */
  size: [number, number];
  /** meshX*meshY*2 floats: pose-B displacement per vertex, part image px. */
  db: number[];
}

export interface RigPart {
  name: string;
  /** Index into parts[]; -1 for a root. Always < own index. */
  parent: number;
  /** Atlas frame name; null is a transform-only null part. */
  tex: string | null;
  /** Global draw order, higher = nearer camera. Independent of parent. */
  z: number;
  /** This part's pin, in its own untrimmed source-PNG px, y-down. */
  pivot: [number, number];
  /** The parent pin this locks onto (parent's untrimmed px); rig-local world
   *  position when parent is -1. */
  attach: [number, number];
  /** Rest local angle, degrees clockwise. */
  rot: number;
  /** Rest alpha; defaults to 1. */
  a?: number;
  flipX?: boolean;
  flipY?: boolean;
  /** Informational only — baked data already respects it. */
  limit?: [number, number];
  /** Alternate artwork this part can wear, by name → atlas frame. Swapped by
   *  game code via `rig.setAttachment`; there is no attachment timeline, so
   *  `solve` never reads this. */
  shapes?: Record<string, string>;
  deform?: Deform | null;
}

export interface Channel {
  part: number;
  /** "rot" | "x" | "y" | "a" | "attach" | "deform" — unknown props are skipped. */
  prop: string;
  /** Exactly `frames` values. */
  values: number[];
}

export interface ClipEvent {
  frame: number;
  name: string;
}

export interface Clip {
  name: string;
  fps: number;
  /** Number of baked samples per channel. */
  frames: number;
  loop: boolean;
  channels: Channel[];
  /** Frame markers: sorted, at most one per frame, all < frames. */
  events?: ClipEvent[];
}

export interface RigFile {
  format: string;
  version: number;
  requires?: string[];
  generator?: string;
  space?: { axis: string; angles: string; units: string };
  atlas: string | string[];
  skeleton: { name: string; parts: RigPart[] };
  clips: Clip[];
  /** Skin name → (runtime part index as string → atlas frame name). */
  skins?: Record<string, Record<string, string>>;
}

// MARK: §4.3 sampler

/** Playback length in samples: a looping clip wraps `frames-1 → 0` with no
 *  duplicated final frame; a one-shot renders both endpoints. */
export function duration(clip: Clip): number {
  return clip.loop ? clip.frames : clip.frames - 1;
}

export function normalizeFrame(clip: Clip, frame: number): number {
  const d = duration(clip);
  if (d <= 0) return 0;
  if (clip.loop) {
    // ((f mod d) + d) mod d — `%` is the truncating remainder, exactly what
    // Swift's `truncatingRemainder` computes, negative frames included.
    return ((frame % d) + d) % d;
  }
  return Math.min(Math.max(frame, 0), d);
}

export function sampleChannel(ch: Channel, clip: Clip, frame: number): number {
  const p = normalizeFrame(clip, frame);
  const i0 = Math.floor(p);
  const t = p - i0;
  const i1 = clip.loop ? (i0 + 1) % clip.frames : Math.min(i0 + 1, clip.frames - 1);
  const a = ch.values[i0];
  const b = ch.values[i1];
  // Contractual association order — see the file header.
  return a + (b - a) * t;
}

// MARK: §4.4 forward kinematics

/** One solved pose. Preallocated once (`allocPose`) and overwritten per frame
 *  so `solve` allocates nothing on the hot path. */
export interface PoseBuffers {
  /** Local angle per part, degrees, post-sample. */
  rot: Float64Array;
  /** Attach point per part (parent image space; rig-local world for roots). */
  ax: Float64Array;
  ay: Float64Array;
  alpha: Float64Array;
  /** Deform scalar per part. */
  def: Float64Array;
  /** World angle, radians. */
  theta: Float64Array;
  px: Float64Array;
  py: Float64Array;
  /** Accumulated mirror, ±1. */
  fx: Float64Array;
  fy: Float64Array;
}

export function allocPose(n: number): PoseBuffers {
  return {
    rot: new Float64Array(n),
    ax: new Float64Array(n),
    ay: new Float64Array(n),
    alpha: new Float64Array(n),
    def: new Float64Array(n),
    theta: new Float64Array(n),
    px: new Float64Array(n),
    py: new Float64Array(n),
    fx: new Float64Array(n),
    fy: new Float64Array(n),
  };
}

const DEG = Math.PI / 180;

const warnedProps = new Set<string>();

export function solve(
  file: RigFile,
  clip: Clip | null,
  frame: number,
  out: PoseBuffers,
): void {
  const parts = file.skeleton.parts;
  const n = parts.length;

  // 1) Rest pose — resets EVERY channel-driven property. Alpha included:
  // skipping this reset is the "a leg randomly disappears" bug (§4.6 case 5).
  for (let i = 0; i < n; i++) {
    const p = parts[i];
    out.rot[i] = p.rot;
    out.ax[i] = p.attach[0];
    out.ay[i] = p.attach[1];
    out.alpha[i] = p.a ?? 1;
    out.def[i] = 0;
  }

  // 2) Sample baked channels — linear, and nothing else.
  if (clip) {
    for (const ch of clip.channels) {
      if (ch.part < 0 || ch.part >= n || ch.values.length !== clip.frames) continue;
      const v = sampleChannel(ch, clip, frame);
      switch (ch.prop) {
        case 'rot': out.rot[ch.part] = v; break;
        case 'x': out.ax[ch.part] = v; break;
        case 'y': out.ay[ch.part] = v; break;
        case 'a': out.alpha[ch.part] = v; break;
        case 'deform': out.def[ch.part] = v; break;
        case 'attach': break;
        // "attach" is a real channel, handled by the player's texture
        // binding (rig.ts `applyAttachments`) — it produces no number, so it
        // is silently skipped here rather than warned about.
        default:
          // Unknown prop: skip, never throw (§4.4) — warn once per prop name.
          if (!warnedProps.has(ch.prop)) {
            warnedProps.add(ch.prop);
            console.warn(`bonerutter: unknown channel prop "${ch.prop}" skipped`);
          }
      }
    }
  }

  // 3) Forward kinematics — one pass, four multiply-adds per part. Parts are
  // topologically sorted, so a parent's world state is final before any child
  // reads it.
  for (let i = 0; i < n; i++) {
    const p = parts[i];
    const lfx = p.flipX ? -1 : 1;
    const lfy = p.flipY ? -1 : 1;
    const par = p.parent;
    if (par < 0) {
      out.theta[i] = out.rot[i] * DEG;
      out.px[i] = out.ax[i];
      out.py[i] = out.ay[i];
      out.fx[i] = lfx;
      out.fy[i] = lfy;
    } else {
      // A single-axis mirror reverses rotation sense: Diag(-1,1)·R(r)
      // = R(-r)·Diag(-1,1).
      const sigma = out.fx[par] * out.fy[par];
      out.theta[i] = out.theta[par] + out.rot[i] * DEG * sigma;
      const pp = parts[par];
      const ox = (out.ax[i] - pp.pivot[0]) * out.fx[par];
      const oy = (out.ay[i] - pp.pivot[1]) * out.fy[par];
      const c = Math.cos(out.theta[par]);
      const s = Math.sin(out.theta[par]);
      out.px[i] = out.px[par] + c * ox - s * oy; // matches Pixi's [cos, sin, -sin, cos]
      out.py[i] = out.py[par] + s * ox + c * oy;
      out.fx[i] = out.fx[par] * lfx;
      out.fy[i] = out.fy[par] * lfy;
    }
  }
}
