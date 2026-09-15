<script lang="ts">
	// TRAY RAIN — the max-win screen's backdrop (Corey 2026-09-15). The eight empty paying-symbol
	// plates from the amSymbols atlas (`<SYM>_eaten.png`, the tray with its insect already gone)
	// tumble down the dimmed screen behind THEY ATE EVERYTHING and the MAX WIN slam: per-sprite
	// fall speed, rotation and scale, recycled off the bottom.
	//
	// Same shape as the ambient layers (AmbientRoaches/AmbientFly): ONE raw Pixi container added to
	// the parent once, the whole pool of sprites created up front, and a single app-ticker callback
	// that moves them. Nothing is allocated per frame, no sprite is mounted or unmounted mid-beat
	// (the always-mounted z-order rule), and density is driven by how many of the pooled sprites are
	// left visible — sparse at the dim, a downpour under the slam, thinning with the track's own
	// 5 s fade so the screen is empty by the time the music ends.
	//
	// Everything is authored in MASTER px and the container is placed/scaled by mainLayout(), so it
	// lands on the same pixels as the titles in front of it.
	import * as PIXI from 'pixi.js';
	import { onMount } from 'svelte';
	import { getContextParent } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { MAX_WIN } from '../game/constants';
	import { layoutKind, MASTER } from '../game/layoutSpec';
	import { maxWinState } from '../game/maxWin.svelte';

	type Props = {
		/** ms since the max-win track started; <= 0 means the rain is off */
		t: number;
		visible?: boolean;
		alpha?: number;
	};
	const { t, visible = true, alpha = 1 }: Props = $props();

	const context = getContext();
	const R = MAX_WIN.rain;

	const root = new PIXI.Container();
	root.visible = false;
	getContextParent().addToParent(root);

	type Tray = { s: PIXI.Sprite; y: number; x: number; vy: number; rot: number; vr: number; w: number; a: number };
	const trays: Tray[] = [];
	let master = { width: MASTER.landscape.width, height: MASTER.landscape.height };

	const rnd = (a: number, b: number) => a + Math.random() * (b - a);
	const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

	/** re-roll one tray above the top of the screen (also used for the initial scatter) */
	const roll = (tray: Tray, textures: PIXI.Texture[], initial = false) => {
		const w = master.width * rnd(R.size[0], R.size[1]);
		tray.w = w;
		tray.x = rnd(-w * 0.3, master.width + w * 0.3);
		tray.y = initial ? rnd(-w, master.height) : rnd(-master.height * 0.6, -w);
		tray.vy = rnd(R.speed[0], R.speed[1]) * (w / (master.width * R.size[1]));
		tray.vr = rnd(R.spin[0], R.spin[1]);
		tray.rot = rnd(0, Math.PI * 2);
		tray.a = rnd(R.alpha[0], R.alpha[1]);
		const tex = pick(textures);
		if (tray.s.texture !== tex) tray.s.texture = tex;
	};

	/** share of the pool that is live at `ms` after the track started (MAX_WIN.rain marks) */
	const shareAt = (ms: number) => {
		if (ms < R.sparseAt) return 0;
		if (ms < R.downpourAt) {
			const q = (ms - R.sparseAt) / (R.downpourAt - R.sparseAt);
			return R.sparseShare + (R.fullShare - R.sparseShare) * q;
		}
		if (ms < R.holdUntil) return R.fullShare;
		const q = Math.min(1, (ms - R.holdUntil) / Math.max(1, R.emptyAt - R.holdUntil));
		return R.fullShare * (1 - q);
	};

	onMount(() => {
		const assets = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		const textures: PIXI.Texture[] = [];
		for (const name of R.plates) {
			const tex = assets?.[`${name}_eaten.png`];
			if (tex) textures.push(tex);
		}
		if (!textures.length) return;

		const kind = layoutKind(context.stateLayoutDerived.layoutType());
		const count = R.count[kind] ?? R.count.landscape;
		for (let i = 0; i < count; i += 1) {
			const s = new PIXI.Sprite(textures[i % textures.length]);
			s.anchor.set(0.5);
			s.visible = false;
			root.addChild(s);
			const tray: Tray = { s, x: 0, y: 0, vy: 0, rot: 0, vr: 0, w: 0, a: 1 };
			roll(tray, textures, true);
			trays.push(tray);
		}

		const ticker = context.stateApp.pixiApplication?.ticker;
		const tick = () => {
			if (!root.visible) return;
			const dt = Math.min(0.05, (ticker?.deltaMS ?? 16) / 1000);
			const live = Math.round(trays.length * shareAt(t));
			let active = 0;
			for (let i = 0; i < trays.length; i += 1) {
				const tray = trays[i];
				const on = i < live;
				if (!on) {
					if (tray.s.visible) tray.s.visible = false;
					continue;
				}
				if (!tray.s.visible) tray.s.visible = true;
				active += 1;
				tray.y += tray.vy * dt;
				tray.rot += tray.vr * dt;
				if (tray.y - tray.w > master.height) roll(tray, textures);
				tray.s.position.set(tray.x, tray.y);
				tray.s.rotation = tray.rot;
				tray.s.width = tray.w;
				tray.s.height = tray.w;
				tray.s.alpha = tray.a;
			}
			maxWinState.trays = active;
		};
		ticker?.add(tick);
		return () => {
			ticker?.remove(tick);
			maxWinState.trays = 0;
		};
	});

	// The component is mounted INSIDE a <MainContainer>, so the parent already carries the master
	// transform (origin = master top-left): everything above is plain master px. Only the master's
	// own size has to be tracked, since it changes with the LayoutKind on an orientation flip.
	$effect(() => {
		const layout = context.stateLayoutDerived.mainLayout();
		master = { width: layout.width, height: layout.height };
		root.alpha = alpha;
		root.visible = visible && alpha > 0;
	});
</script>
