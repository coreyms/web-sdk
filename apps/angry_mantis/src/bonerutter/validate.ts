/**
 * `validate(rig)` — the §4.2 invariants, enforced on the reading side
 * (RUNTIME-EXPORT §7.32). Every one of these fails SILENTLY at render time if
 * unchecked: a bad parent index reads a stale world transform, a bad part
 * index writes past a typed array (a no-op in JS), a renamed atlas frame is a
 * blank character. The player runs this in dev builds and throws; CI runs it
 * against every exported fixture.
 *
 * Returns a list of human-readable problems; empty means valid.
 */

import type { Clip, RigPart, RigFile } from './solve';

const KNOWN_PROPS = new Set(['rot', 'x', 'y', 'a', 'attach', 'deform']);
const KNOWN_CAPS = new Set(['deform']);
export const MAX_VERSION = 1;

export interface ValidateOptions {
  /** Atlas frame names, when the atlas is loaded — enables the tex check. */
  atlasFrames?: Set<string>;
}

export function validate(file: RigFile, opts: ValidateOptions = {}): string[] {
  const problems: string[] = [];

  // Format gate: magic, version ceiling, capability strings.
  if (file.format !== 'bonerutter-rig') {
    problems.push(`format is "${file.format}", not "bonerutter-rig"`);
    return problems; // nothing else is trustworthy
  }
  if (!Number.isInteger(file.version) || file.version > MAX_VERSION) {
    problems.push(`version ${file.version} > supported ${MAX_VERSION}`);
  }
  for (const cap of file.requires ?? []) {
    if (!KNOWN_CAPS.has(cap)) problems.push(`unknown required capability "${cap}"`);
  }

  const parts = file.skeleton?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    problems.push('skeleton has no parts');
    return problems;
  }

  // 1. Topologically sorted tree: parent < own index (which also rules out
  // cycles, since every chain strictly decreases to a root).
  parts.forEach((p, i) => {
    if (!Number.isInteger(p.parent) || p.parent >= i || (p.parent < 0 && p.parent !== -1)) {
      problems.push(`part ${i} "${p.name}" has parent ${p.parent}; must be -1 or < ${i}`);
    }
  });

  // 5. Every tex resolves against the actual atlas, when we have one.
  if (opts.atlasFrames) {
    for (const p of parts) {
      if (p.tex !== null && p.tex !== undefined && !opts.atlasFrames.has(p.tex)) {
        problems.push(`part "${p.name}" tex "${p.tex}" not found in atlas`);
      }
    }
  }

  // Deform geometry, when present.
  for (const p of parts) {
    if (!p.deform) continue;
    const [mx, my] = p.deform.mesh;
    if (mx * my > 100) {
      problems.push(`part "${p.name}" deform mesh ${mx}×${my} exceeds 100 vertices (breaks the sprite batch)`);
    }
    if (p.deform.db.length !== mx * my * 2) {
      problems.push(`part "${p.name}" deform db has ${p.deform.db.length} floats, expected ${mx * my * 2}`);
    }
  }

  for (const clip of file.clips ?? []) problems.push(...validateClip(clip, parts));

  // Skins: part keys must be valid indices.
  for (const [skin, overrides] of Object.entries(file.skins ?? {})) {
    for (const key of Object.keys(overrides)) {
      const i = Number(key);
      if (!Number.isInteger(i) || i < 0 || i >= parts.length) {
        problems.push(`skin "${skin}" overrides part ${key}, which does not exist`);
      }
    }
  }

  return problems;
}

function validateClip(clip: Clip, parts: RigPart[]): string[] {
  const problems: string[] = [];
  const partCount = parts.length;
  const where = `clip "${clip.name}"`;

  if (!Number.isInteger(clip.frames) || clip.frames < 1) {
    problems.push(`${where} has frames ${clip.frames}; must be a positive integer`);
    return problems;
  }

  for (const ch of clip.channels ?? []) {
    const chWhere = `${where} channel ${ch.prop}@${ch.part}`;

    // 2. Exactly `frames` values, part index in range, prop known.
    if (!Number.isInteger(ch.part) || ch.part < 0 || ch.part >= partCount) {
      problems.push(`${chWhere}: part index out of range (0..<${partCount})`);
    }
    if (ch.values.length !== clip.frames) {
      problems.push(`${chWhere}: ${ch.values.length} values, expected ${clip.frames}`);
    }
    if (!KNOWN_PROPS.has(ch.prop)) {
      // Skipped at runtime, but CI should notice a typo'd exporter.
      problems.push(`${chWhere}: unknown prop (will be ignored by the player)`);
    }

    // An attach value indexes the part's `shapes` keys; −1 is its own art.
    // The player degrades an out-of-range index to the default rather than
    // throwing, which means a stale index is invisible at runtime — exactly
    // the kind of thing a validator exists to catch instead.
    if (ch.prop === 'attach') {
      const names = Object.keys(parts[ch.part]?.shapes ?? {});
      for (let i = 0; i < ch.values.length; i++) {
        const v = ch.values[i];
        if (!Number.isInteger(v) || v < -1 || v >= names.length) {
          problems.push(`${chWhere}: attachment index ${v} at sample ${i} is not -1..<${names.length}`);
          break;
        }
      }
    }

    if (ch.prop === 'rot' && ch.values.length > 1) {
      // 3. Angles unwrapped: no consecutive step over 180° (catches wrap bugs).
      // vendor patch (angry_mantis): upstream barred steps >90°, but the mantis Strike clip's claw
      // whip legitimately moves 130-148° in one frame (impact frame 16->17). Below 180° the runtime's
      // lerp and the shortest arc agree, so a stored value is unambiguous; a real wrap artifact lands
      // near 360°. FIXED UPSTREAM 2026-08-29 (coreyms/bonerutter eeb1c5f, branch
      // phase-1-rigging-and-export) with the same 180° bar — drop this patch on the next re-vendor.
      for (let i = 1; i < ch.values.length; i++) {
        if (Math.abs(ch.values[i] - ch.values[i - 1]) > 180) {
          problems.push(`${chWhere}: step of ${Math.abs(ch.values[i] - ch.values[i - 1]).toFixed(1)}° between samples ${i - 1} and ${i} — angles must be unwrapped`);
          break;
        }
      }
      // 4. Looping channels return to their start: seam ≤ 3× median |Δ|.
      if (clip.loop) {
        const deltas = [];
        for (let i = 1; i < ch.values.length; i++) deltas.push(Math.abs(ch.values[i] - ch.values[i - 1]));
        deltas.sort((a, b) => a - b);
        const median = deltas[deltas.length >> 1];
        const largest = deltas[deltas.length - 1];
        const seam = Math.abs(ch.values[0] - ch.values[ch.values.length - 1]);
        // Mirror of the exporter's bar (RuntimeRig.swift): hold segments zero
        // the median, so the largest legitimate step is an alternative ceiling.
        if (seam > Math.max(median * 3, largest * 1.5, 1e-9)) {
          problems.push(`${chWhere}: loop seam jumps ${seam.toFixed(3)} — every cycle will pop`);
        }
      }
    }
  }

  // Events: sorted, at most one per frame, all inside the baked range.
  let prev = -1;
  for (const e of clip.events ?? []) {
    if (!Number.isInteger(e.frame) || e.frame < 0 || e.frame >= clip.frames) {
      problems.push(`${where} event "${e.name}" at frame ${e.frame} is outside 0..<${clip.frames}`);
    }
    if (e.frame <= prev) {
      problems.push(`${where} events are not strictly frame-sorted at "${e.name}" (${e.frame})`);
    }
    prev = e.frame;
  }

  return problems;
}
