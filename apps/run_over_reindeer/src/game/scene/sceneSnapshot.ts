// THE SCENE SWAP'S PICTURE OF THE OUTGOING SCENE (2026-11-19, Corey: "There are these weird lines and shading that happen
// while switching back and fourth from Light and Dark Mode"; game/scene/sceneSwap.ts).
//
// WHY: the scene is not one picture but seven layers (the field tiles, the road picture, the bands, the forest, the edge
// cover, the tunnel strips, the painted ends), several of them soft edged, with the road's traffic between them, and the LED
// scoreboard's snow cover is cut from the same pieces. Faded layer by layer (the incoming piece over the outgoing one in
// each layer), a soft edged piece over another layer's mix is no longer the plain mix of the two scenes: its pixels sit at
// another point of the fade than the ground beside them, so the straight edges of the end pieces, the bands and the cover
// showed as lighter or darker rectangles, and the outgoing hills stayed whole until a late tail took them.
//
// HOW: the swap's first frame takes ONE picture of what the screen shows of the road (the scene and everything on the road)
// and of the board's snow cover, at the canvas's own size and resolution, into one render texture. The incoming scene is
// put in at once, whole, and the picture is laid over it and fades out: every pixel is then the plain mix of the two
// screens at the same point of the fade, so nothing can run ahead of the rest. The picture is shown by two plain sprites:
// the whole of it as the road's last child (it moves with the road's shake) and the snow cover's rectangle of it over the
// cover (it lies over the LED back board's lower edge, as the cover does). Everything above them (the billboard, the dim,
// the LED back board and strip, the HTML) is not in the picture and stays live. No filter, mask or shader.
// MEMORY: one RGBA texture the canvas's size at the renderer's resolution, held from the fade's first frame to two frames
// after its last (mb() below), then destroyed.
import * as PIXI from 'pixi.js';

export type SnapshotShow = {
	/** the container the picture's sprite goes in (as its last child) */
	parent: PIXI.Container;
	/** the part of the screen it shows (global px); null: the whole of it */
	rect: PIXI.Rectangle | null;
};

const nextFrames = (fn: () => void) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => requestAnimationFrame(fn)) : fn());

export class SceneSnapshot {
	/** pictures not yet destroyed (the probe: none once a fade is two frames past its end) */
	static live = 0;
	private constructor(
		private readonly rt: PIXI.RenderTexture,
		private readonly sprites: PIXI.Sprite[],
		private readonly frames: PIXI.Texture[],
	) {}

	/** THE PICTURE NOW: `keep` (and what is in them) drawn as they are on screen, nothing else of `stage`, into one texture;
	 *  shown at once by a sprite per `shows`, at alpha 1. Null when there is nothing to draw it with. */
	static take(renderer: PIXI.Renderer | null | undefined, stage: PIXI.Container | null | undefined, keep: PIXI.Container[], shows: SnapshotShow[]): SceneSnapshot | null {
		if (!renderer || !stage || !keep.length) return null;
		const w = Math.ceil(renderer.screen.width);
		const h = Math.ceil(renderer.screen.height);
		if (w < 1 || h < 1) return null;
		// every container on the way from the stage to a kept one stays; any other child of those is left out of this render
		const kept = new Set<PIXI.Container>(keep);
		const path = new Set<PIXI.Container>();
		for (const k of keep) for (let n: PIXI.Container | null = k.parent; n; n = n.parent) path.add(n);
		if (!path.has(stage)) return null;
		const off: PIXI.Container[] = [];
		const walk = (node: PIXI.Container) => {
			for (const c of node.children) {
				if (kept.has(c)) continue;
				if (path.has(c)) walk(c);
				else if (c.renderable) {
					c.renderable = false;
					off.push(c);
				}
			}
		};
		walk(stage);
		const rt = PIXI.RenderTexture.create({ width: w, height: h, resolution: renderer.resolution, antialias: false });
		try {
			renderer.render({ container: stage, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
		} finally {
			for (const c of off) c.renderable = true;
		}
		const sprites: PIXI.Sprite[] = [];
		const frames: PIXI.Texture[] = [];
		for (const s of shows) {
			const r = s.rect ? s.rect.clone().fit(new PIXI.Rectangle(0, 0, w, h)) : new PIXI.Rectangle(0, 0, w, h);
			if (r.width < 0.5 || r.height < 0.5) continue;
			let tex: PIXI.Texture = rt;
			if (s.rect) {
				tex = new PIXI.Texture({ source: rt.source, frame: r });
				frames.push(tex);
			}
			const sp = new PIXI.Sprite(tex);
			sp.eventMode = 'none';
			sp.label = 'scene:snapshot';
			s.parent.addChild(sp);
			// the sprite's corner at the rectangle's global corner, one global px per texture px
			const p0 = s.parent.toLocal({ x: r.x, y: r.y });
			const p1 = s.parent.toLocal({ x: r.x + r.width, y: r.y + r.height });
			sp.position.set(p0.x, p0.y);
			sp.width = p1.x - p0.x;
			sp.height = p1.y - p0.y;
			sprites.push(sp);
		}
		SceneSnapshot.live += 1;
		return new SceneSnapshot(rt, sprites, frames);
	}

	/** the picture's alpha (1 at the fade's start, 0 at its end) */
	alpha(a: number) {
		for (const s of this.sprites) {
			s.alpha = a;
			s.visible = a > 0;
		}
	}

	/** its GPU size (MB, RGBA) */
	mb(): number {
		const src = this.rt.source;
		return (src.pixelWidth * src.pixelHeight * 4) / 1048576;
	}

	/** gone: hidden now, its sprites and texture destroyed two frames later (a texture destroyed in the frame it was last
	 *  batched takes the render loop down: the column sheets' rule, game/road/columnClips.ts) */
	end() {
		for (const s of this.sprites) s.visible = false;
		nextFrames(() => {
			for (const s of this.sprites) if (!s.destroyed) s.destroy();
			for (const t of this.frames) t.destroy(false);
			this.rt.destroy(true);
			SceneSnapshot.live -= 1;
		});
	}
}
