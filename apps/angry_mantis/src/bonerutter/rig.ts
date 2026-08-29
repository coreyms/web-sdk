/**
 * The PixiJS player (RUNTIME-EXPORT §5). Flat container, manual FK:
 * every part is a direct child of one root container added in ascending `z`
 * order — no Pixi nesting, no zIndex, no sorting ever. The transform
 * hierarchy is solved on the CPU by the shared, golden-tested `solve`, which
 * is what buys draw order independent of the transform tree (far-side legs
 * behind the body that is their own transform ancestor).
 *
 * The rig owns `position`, `rotation`, `scale`, `alpha` of its parts and
 * overwrites them every frame. `tint`, `filters`, `visible`, and `addChild`
 * on `rig.part(name)` belong to the game.
 */

import {
  Assets,
  Container,
  Mesh,
  MeshGeometry,
  Sprite,
  type Spritesheet,
  type Texture,
} from 'pixi.js';
import { eventsCrossed } from './events';
import {
  allocPose,
  normalizeFrame,
  solve,
  type Clip,
  type PoseBuffers,
  type RigFile,
} from './solve';

/** One clip's `attach` channel, resolved once: which part, the per-frame
 *  attachment indices, and the names those indices address. */
interface AttachChannel {
  part: number;
  values: number[];
  names: string[];
}
import { validate, MAX_VERSION } from './validate';

// vendor patch (angry_mantis): the upstream file keys DEV off process.env, which doesn't exist
// in a Vite browser bundle — same intent, Vite's flag.
const DEV = import.meta.env?.DEV ?? false;

export interface PlayOptions {
  loop?: boolean;
  speed?: number;
  /** Starting sample; randomize at spawn for per-instance variation. */
  startFrame?: number;
  onComplete?: () => void;
}

export type EventListener = (name: string, frame: number) => void;

interface DeformState {
  buf: { data: Float32Array; update(): void };
  rest: Float32Array;
  db: Float32Array;
}

export class Rig {
  readonly view = new Container();
  private nodes: (Sprite | Mesh)[] = [];
  private deform: (DeformState | null)[] = [];
  private clipsByName = new Map<string, Clip>();
  private index = new Map<string, number>();
  private pose: PoseBuffers;
  private defaultTex: (Texture | null)[] = [];
  /** Per part: the chosen `shapes` attachment name, or null for its own art. */
  private attachment: (string | null)[] = [];
  /** What the playing clip's `attach` channel says a part wears this frame.
   *  `undefined` means no channel drives it, which is what lets the manual
   *  `setAttachment` choice show through — distinct from `null`, which is a
   *  channel actively asking for the part's own art. */
  private channelAttachment: (string | null | undefined)[] = [];
  /** Per clip, its `attach` channels resolved to (part, values, names). Built
   *  once per clip rather than per frame; keyed weakly so it costs nothing for
   *  clips that are never played. */
  private attachCache = new WeakMap<Clip, AttachChannel[]>();
  private activeSkin: string | null = null;

  private cur: Clip | null = null;
  private t = 0;
  private loop = false;
  private speed = 1;
  private done = false;
  private onComplete: (() => void) | null = null;

  // Event markers (§2.4): markers strictly inside (evCursor, t] fire, in
  // unwrapped sample time so a looping pass fires each marker exactly once,
  // seam included. `evInclusive` is the initialization detail: the first
  // advance after play() includes a marker sitting exactly on the start frame.
  private evCursor = 0;
  private evInclusive = false;
  private listeners = new Set<EventListener>();

  private constructor(private file: RigFile, sheets: Spritesheet[]) {
    this.sheets = sheets;
    if (file.format !== 'bonerutter-rig') throw new Error('bonerutter: not a rig file');
    if (file.version > MAX_VERSION) {
      throw new Error(`bonerutter: version ${file.version} > ${MAX_VERSION}`);
    }
    for (const cap of file.requires ?? []) {
      if (cap !== 'deform') throw new Error(`bonerutter: unsupported capability "${cap}"`);
    }
    if (DEV) {
      const frames = new Set<string>();
      for (const s of sheets) for (const k of Object.keys(s.textures)) frames.add(k);
      const problems = validate(file, sheets.length ? { atlasFrames: frames } : {});
      if (problems.length) {
        throw new Error(`bonerutter: invalid rig\n  ${problems.join('\n  ')}`);
      }
    }

    const parts = file.skeleton.parts;
    const tex = (name: string): Texture => {
      for (const s of sheets) if (s.textures[name]) return s.textures[name];
      throw new Error(`bonerutter: atlas frame "${name}" not found`);
    };

    // Flat root, children added in ascending z: insertion order IS draw order.
    const order = parts.map((_, i) => i).sort((a, b) => parts[a].z - parts[b].z);
    this.nodes = new Array(parts.length);
    this.deform = new Array(parts.length).fill(null);
    this.defaultTex = new Array(parts.length).fill(null);
    this.channelAttachment = new Array(parts.length).fill(undefined);
    this.attachment = new Array(parts.length).fill(null);

    for (const i of order) {
      const p = parts[i];
      let node: Sprite | Mesh;
      if (p.deform) {
        const t2 = tex(p.tex!);
        const [mx, my] = p.deform.mesh;
        const [w, h] = p.deform.size;
        const n = mx * my;
        if (DEV && n > 100) {
          console.warn(`bonerutter: "${p.name}" mesh ${n} verts > 100: breaks the sprite batch`);
        }
        const positions = new Float32Array(n * 2);
        const uvs = new Float32Array(n * 2);
        const indices = new Uint32Array((mx - 1) * (my - 1) * 6);
        for (let gy = 0, k = 0; gy < my; gy++) {
          for (let gx = 0; gx < mx; gx++, k++) {
            const u = gx / (mx - 1);
            const v = gy / (my - 1);
            uvs[k * 2] = u;
            uvs[k * 2 + 1] = v;
            positions[k * 2] = u * w;
            positions[k * 2 + 1] = v * h;
          }
        }
        // Index winding copied from PlaneGeometry.build: the shared diagonal
        // runs TR → BL in every consumer, or UVs interpolate differently
        // under strong deform (§4.5).
        for (let cy = 0, o = 0; cy < my - 1; cy++) {
          for (let cx = 0; cx < mx - 1; cx++) {
            const a = cy * mx + cx;
            const b = a + 1;
            const c = (cy + 1) * mx + cx;
            const d = c + 1;
            indices[o++] = a; indices[o++] = b; indices[o++] = c;
            indices[o++] = b; indices[o++] = d; indices[o++] = c;
          }
        }
        const m = new Mesh({
          geometry: new MeshGeometry({ positions, uvs, indices }),
          texture: t2,
        });
        node = m;
        const buf = m.geometry.getBuffer('aPosition') as unknown as DeformState['buf'];
        this.deform[i] = { buf, rest: positions.slice(), db: Float32Array.from(p.deform.db) };
        this.defaultTex[i] = t2;
      } else if (p.tex) {
        const s = new Sprite(tex(p.tex));
        s.anchor.set(0, 0); // never inherit the atlas defaultAnchor
        node = s;
        this.defaultTex[i] = s.texture;
      } else {
        node = new Sprite(); // null part: transform only
        node.visible = false;
      }
      node.pivot.set(p.pivot[0], p.pivot[1]);
      node.label = p.name;
      this.nodes[i] = node;
      this.view.addChild(node);
      this.index.set(p.name, i);
    }

    for (const c of file.clips) this.clipsByName.set(c.name, c);
    this.pose = allocPose(parts.length);
    this.apply(null, 0);
  }

  /** Loads a `.bonerig.json` and the atlases it names (relative to itself). */
  static async load(url: string): Promise<Rig> {
    const file = await Assets.load<RigFile>(url);
    const list = Array.isArray(file.atlas) ? file.atlas : [file.atlas];
    const base = new URL(url, typeof location === 'undefined' ? 'http://localhost/' : location.href);
    const sheets = await Promise.all(
      list.map((a) => Assets.load<Spritesheet>(new URL(a, base).href)),
    );
    return new Rig(file, sheets);
  }

  /** For bundled rigs and tests. */
  static fromData(file: RigFile, sheets: Spritesheet[]): Rig {
    return new Rig(file, sheets);
  }

  get clipNames(): string[] {
    return this.file.clips.map((c) => c.name);
  }

  get skinNames(): string[] {
    return Object.keys(this.file.skins ?? {});
  }

  play(name: string, o: PlayOptions = {}): this {
    const c = this.clipsByName.get(name);
    if (!c) throw new Error(`bonerutter: no clip "${name}"`);
    this.cur = c;
    this.loop = o.loop ?? c.loop;
    this.speed = o.speed ?? 1;
    this.t = o.startFrame ?? 0;
    this.done = false;
    this.onComplete = o.onComplete ?? null;
    this.evCursor = this.t;
    this.evInclusive = true;
    this.apply(c, this.t);
    return this;
  }

  /** Manual scrub. A seek fires no event markers (§2.4). */
  setFrame(name: string, frame: number): void {
    const c = this.clipsByName.get(name);
    if (!c) throw new Error(`bonerutter: no clip "${name}"`);
    this.cur = c;
    this.loop = c.loop;
    this.t = frame;
    this.done = true;
    this.evCursor = frame;
    this.evInclusive = false;
    this.apply(c, frame);
  }

  stop(): void {
    this.cur = null;
    this.onComplete = null;
    this.apply(null, 0);
  }

  get isPlaying(): boolean {
    return this.cur !== null && !this.done;
  }

  /** @param dt elapsed SECONDS (feed it `ticker.deltaMS / 1000`). */
  update(dt: number): void {
    const c = this.cur;
    if (!c || this.done) return;
    this.t += dt * this.speed * c.fps; // t is in SAMPLES
    const dur = c.loop ? c.frames : c.frames - 1;
    if (!this.loop && this.t >= dur) {
      this.t = dur;
      this.done = true;
      const cb = this.onComplete;
      this.onComplete = null;
      this.apply(c, this.t);
      this.fireEvents(c);
      cb?.(); // fires AFTER the final pose is applied
      return;
    }
    this.apply(c, this.t);
    this.fireEvents(c);
  }

  /** Listen for clip event markers: `cb(name, frame)` when playback crosses
   *  one. Looping fires each marker once per pass, across the wrap seam too. */
  // Throwing on a bad `type` rather than quietly ignoring it: the silent
  // version costs nothing at compile time in TypeScript and everything in a
  // plain-JS harness, where `rig.on(cb)` registers nothing, fires nothing,
  // and looks exactly like a rig that has no event markers.
  on(type: 'event', cb: EventListener): this {
    if (type !== 'event') throw new Error(`bonerutter: unknown listener type "${type}"`);
    this.listeners.add(cb);
    return this;
  }

  off(type: 'event', cb: EventListener): this {
    if (type !== 'event') throw new Error(`bonerutter: unknown listener type "${type}"`);
    this.listeners.delete(cb);
    return this;
  }

  /** Applies an artwork variant set from the file's `skins`; null restores the
   *  default artwork. Unknown names throw; parts a skin does not override keep
   *  their current default. Any attachment set via `setAttachment` survives the
   *  switch, re-resolved through the new skin. */
  setSkin(name: string | null): void {
    if (name !== null && !this.file.skins?.[name]) {
      throw new Error(`bonerutter: no skin "${name}"`);
    }
    this.activeSkin = name;
    for (let i = 0; i < this.nodes.length; i++) this.refreshTexture(i);
  }

  /** Swaps a part to one of its exported `shapes` attachments by name; null
   *  restores the part's own artwork. The choice sticks across `setSkin`.
   *  Unknown part or attachment names throw.
   *
   *  A clip that carries an `attach` channel for this part overrides the choice
   *  while it plays, exactly as its `rot` channel overrides a rotation you set
   *  by hand — animation data wins over a manual pose. The choice is not lost:
   *  it applies again as soon as a clip that does not drive this part plays. */
  setAttachment(part: string, name: string | null): void {
    const i = this.index.get(part);
    if (i === undefined) throw new Error(`bonerutter: no part "${part}"`);
    if (name !== null && !this.file.skeleton.parts[i].shapes?.[name]) {
      throw new Error(`bonerutter: part "${part}" has no attachment "${name}"`);
    }
    this.attachment[i] = name;
    this.refreshTexture(i);
  }

  /** The attachment names a part can wear, in file order. */
  attachmentNames(part: string): string[] {
    const i = this.index.get(part);
    if (i === undefined) throw new Error(`bonerutter: no part "${part}"`);
    return Object.keys(this.file.skeleton.parts[i].shapes ?? {});
  }

  /** Resolves part `i`'s texture from (active skin × chosen attachment) and
   *  assigns it. The skin may override the base artwork ("3") or one specific
   *  attachment ("3.mouth-open"); either falls back to the unskinned frame. */
  private refreshTexture(i: number): void {
    const node = this.nodes[i];
    if (!node) return;
    const skin = this.activeSkin === null ? undefined : this.file.skins?.[this.activeSkin];
    const driven = this.channelAttachment[i];
    const name = driven === undefined ? this.attachment[i] : driven;
    const frame =
      name === null ? skin?.[`${i}`] : (skin?.[`${i}.${name}`] ?? this.file.skeleton.parts[i].shapes?.[name]);
    if (frame) {
      const t = this.sheetTexture(frame);
      if (t) node.texture = t;
      return;
    }
    const fallback = this.defaultTex[i];
    if (fallback) node.texture = fallback;
  }

  /** Escape hatch: the rig overwrites position/rotation/scale/alpha on this
   *  node every frame; tint, filters, visible and addChild are yours. */
  part(name: string): Container | undefined {
    const i = this.index.get(name);
    return i === undefined ? undefined : this.nodes[i];
  }

  destroy(): void {
    this.listeners.clear();
    this.view.destroy({ children: true });
  }

  // MARK: internals

  private sheets: Spritesheet[];

  private sheetTexture(frame: string): Texture | null {
    for (const s of this.sheets) if (s.textures[frame]) return s.textures[frame];
    return null;
  }

  private apply(clip: Clip | null, frame: number): void {
    const P = this.pose;
    const parts = this.file.skeleton.parts;
    solve(this.file, clip, frame, P); // the shared, golden-tested function
    this.applyAttachments(clip, frame);
    for (let i = 0; i < parts.length; i++) {
      const n = this.nodes[i];
      n.position.set(P.px[i], P.py[i]);
      n.rotation = P.theta[i];
      n.scale.set(P.fx[i], P.fy[i]);
      n.alpha = P.alpha[i];
      const d = this.deform[i];
      if (d) {
        const out = d.buf.data;
        const s = P.def[i];
        for (let k = 0; k < out.length; k++) out[k] = d.rest[k] + s * d.db[k];
        d.buf.update(); // dirty-flags Geometry → Mesh.onViewUpdate; skip = silent no-op
      }
    }
  }

  /** Binds each part's texture to what the clip's `attach` channel asks for.
   *
   *  Deliberately *not* inside `solve`: solve produces numbers and is held
   *  bit-exact against its Swift twin by the golden fixtures, while an
   *  attachment is a texture binding with no numeric output. Keeping it here
   *  means the timeline costs solve nothing and moves no fixture.
   *
   *  Stepped, never interpolated — half an attachment is not a thing — and it
   *  steps on the same floored frame index `solve` reads first, so the swap
   *  lands with the `a` channel that usually drives the same part. */
  private applyAttachments(clip: Clip | null, frame: number): void {
    const chans = clip ? this.attachChannels(clip) : [];

    // Release anything this clip does not drive, so moving from a clip that
    // animates the mouth to one that does not restores the manual choice
    // rather than freezing on the last frame of the clip that ended.
    for (let i = 0; i < this.channelAttachment.length; i++) {
      if (this.channelAttachment[i] === undefined) continue;
      if (chans.some((c) => c.part === i)) continue;
      this.channelAttachment[i] = undefined;
      this.refreshTexture(i);
    }
    if (!clip || chans.length === 0) return;

    const f = Math.floor(normalizeFrame(clip, frame));
    for (const c of chans) {
      const raw = c.values[Math.min(f, c.values.length - 1)];
      // Out of range degrades to the part's own art rather than throwing, the
      // same contract unknown channel props get: a player must survive a file
      // written by a newer exporter.
      const next = raw >= 0 && raw < c.names.length ? c.names[raw] : null;
      if (this.channelAttachment[c.part] === next) continue;
      this.channelAttachment[c.part] = next;
      this.refreshTexture(c.part);
    }
  }

  private attachChannels(clip: Clip): AttachChannel[] {
    const hit = this.attachCache.get(clip);
    if (hit) return hit;
    const parts = this.file.skeleton.parts;
    const built: AttachChannel[] = [];
    for (const ch of clip.channels) {
      if (ch.prop !== 'attach') continue;
      if (ch.part < 0 || ch.part >= parts.length) continue;
      if (ch.values.length !== clip.frames) continue;
      built.push({
        part: ch.part,
        values: ch.values,
        // Insertion order of the `shapes` keys IS the channel's index space —
        // the exporter writes them sorted by name and JSON preserves that.
        names: Object.keys(parts[ch.part].shapes ?? {}),
      });
    }
    this.attachCache.set(clip, built);
    return built;
  }

  /** Fires markers crossed since the last update, in unwrapped sample time.
   *  Forward playback only — reverse crossings fire nothing. */
  private fireEvents(c: Clip): void {
    const prev = this.evCursor;
    const cur = this.t;
    const inclusive = this.evInclusive;
    this.evCursor = cur;
    this.evInclusive = false;
    if (this.listeners.size === 0) return;
    const dur = c.loop ? c.frames : c.frames - 1;
    for (const e of eventsCrossed(c.events, c.loop, dur, prev, cur, inclusive)) {
      for (const cb of this.listeners) cb(e.name, e.frame);
    }
  }
}
