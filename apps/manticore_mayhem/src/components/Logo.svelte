<script lang="ts">
	// THE LOGO, IN THE CANVAS IN EVERY LAYOUT AND TIER (2026-10-13, Corey: "The manticore should read in front of the
	// Logo in Portrait mode, I guess that can be for all modes").
	// 2026-11-17: THE CITADEL TABLET (Corey's take A of 2026-11-16, images/logo_tablet_r1_2026-11-16), a still in every
	// layout and tier: game/logo/still.ts draws it with its baked shadow. The stacked logo's animated wings (entrance,
	// breathing, flare) and its glint are gone (Corey: "No glinting on the lettering"). The groove line trace comes in a
	// later pass: it attaches to `still.trace`, a container in the art's own px over the picture (game/logo/still.ts).
	// The chrome keeps its <img> as the fallback (and the alt text), hidden for as long as this draws (logoState.canvas).
	//
	// WHERE: exactly the box the HTML rule gives (game/logo/layout.ts logoArtRect), mapped from the master to
	// canvas px the way MainContainer does.
	// Z ORDER: its host `logo` is mounted in components/Game.svelte straight after the scene and BEFORE the creature's
	// two hosts and the board: scene < logo < creature (behind the board) < board < creature (in front) < spin total,
	// plaques, win screens, transition < the HTML HUD. So the logo is under the creature in every layout, and since
	// the creature is under the plaques and the transition, so is the logo (the plaque's scene dim darkens it and
	// the transition covers it). No logo box reaches the board's art in any layout.
	// WHAT IT READS: the layout and the HUD's own show / hide events. The ticker runs only while it fades.
	import * as PIXI from 'pixi.js';
	import { onMount, untrack } from 'svelte';
	import { getContextParent } from 'pixi-svelte';
	import { stateModal } from 'state-shared';

	import { getContext } from '../game/context';
	import { LOGO } from '../game/constants';
	import { isPhoneSizeType, layoutKind } from '../game/layoutSpec';
	import { enableMipmaps } from '../game/mipmaps';
	import { logoArtRect } from '../game/logo/layout';
	import { logoState } from '../game/logo/state.svelte';
	import { portraitOptions } from '../game/portraitOptions.svelte';
	import { LogoStill } from '../game/logo/still';
	import { hudHiddenByModal } from '../ui/armoury/armouryView.svelte';

	const context = getContext();
	const still = new LogoStill({ fadeMs: LOGO.fadeMs, shadowBakeWidth: LOGO.still.shadowBakeWidth, artPx: LOGO.art });
	// on the stage itself (canvas px): see Z ORDER above
	const host = new PIXI.Container();
	host.label = 'logo';
	host.eventMode = 'none';
	host.interactiveChildren = false;
	host.addChild(still.root);
	getContextParent().addToParent(host);

	/** DEV (logo_probe.js): false = no logo in the canvas, so a shot has no logo at all (the chrome's <img> shows) */
	let stillEnabled = $state(true);
	let stillBuilt = $state(false);
	/** the HUD is away (uiHide .. uiShow), and the max win screen's deep hide (uiHide { deep }): even the kept HUD
	 *  elements go, and so does this */
	let hudOff = $state(false);
	let deep = $state(false);
	let mips = 1;

	const kind = $derived(layoutKind(context.stateLayoutDerived.layoutType()));
	/** the HUD's own rule for its logo (ui/Chrome.svelte): gone under a modal (but not under THE ARMOURY, which keeps the
	 *  game visible under its tint: the one shared rule, ui/armoury/armouryView hudHiddenByModal); a kept element in
	 *  landscape and portrait (only the deep hide takes it), and on the phone master it goes with the HUD */
	const hudShows = $derived(!hudHiddenByModal(stateModal.modal) && (kind === 'phone' ? !hudOff : !deep));
	const stillOn = $derived(stillBuilt && stillEnabled);
	const stillShown = $derived(stillOn && hudShows);

	// ---- the ticker: on only while the still fades ----
	let stillTicking = false;
	const stillTick = (ticker: PIXI.Ticker) => {
		if (!still.tick(ticker.deltaMS)) stopStill();
	};
	const startStill = () => {
		if (stillTicking || !still.ready) return;
		stillTicking = true;
		// NORMAL: before the render (LOW), like every other raw Pixi layer here
		context.stateApp.pixiApplication?.ticker.add(stillTick, undefined, PIXI.UPDATE_PRIORITY.NORMAL);
	};
	const stopStill = () => {
		if (!stillTicking) return;
		stillTicking = false;
		context.stateApp.pixiApplication?.ticker.remove(stillTick);
	};
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		const atlas = context.stateApp.loadedAssets as Record<string, PIXI.Texture> | undefined;
		if (stillBuilt || !app || !atlas?.logoStill) return;
		const renderer = app.renderer as PIXI.Renderer;
		// 1893 px (1280 on the phone tier) drawn at 140 to 760 CSS px: a mip chain, as the <img> has the browser's own downscale
		if (LOGO.mipmaps) {
			enableMipmaps(atlas.logoStill.source, renderer);
			mips = atlas.logoStill.source.autoGenerateMipmaps ? atlas.logoStill.source.mipLevelCount : 1;
		}
		still.build(atlas.logoStill);
		void renderer.prepare?.upload([atlas.logoStill.source]);
		stillBuilt = true;
	});
	// placement, every layout: the box the HTML rule gives, master -> canvas as MainContainer does
	$effect(() => {
		if (!stillBuilt) return;
		const master = context.stateLayoutDerived.mainLayout();
		const rect = kind === 'portrait' ? logoArtRect('portrait', context.stateLayoutDerived.canvasSizes().width / master.scale, isPhoneSizeType(context.stateLayoutDerived.canvasSizeType())) : logoArtRect(kind);
		const sh = LOGO.still.shadow[kind];
		untrack(() => still.place(master.x + (rect.x - master.width / 2) * master.scale, master.y + (rect.y - master.height / 2) * master.scale, rect.width * master.scale, { dy: sh.dy * master.scale, blur: sh.blur * master.scale, alpha: sh.alpha }));
	});
	let stillWasOn = false;
	$effect(() => {
		const on = stillOn;
		const visible = stillShown;
		untrack(() => {
			// the first show and a DEV switch are a cut; the HUD's own show / hide is a fade
			still.show(visible, !on || !stillWasOn);
			stillWasOn = on;
			if (on) startStill();
		});
	});
	// the chrome's <img> is hidden for as long as the canvas draws the logo: one logo, never two
	$effect(() => {
		logoState.canvas = stillOn;
	});

	context.eventEmitter.subscribeOnMount({
		// the HUD's own events: the logo is one of its kept elements (ui/Chrome.svelte)
		uiHide: (emitterEvent) => {
			hudOff = true;
			deep = emitterEvent.deep ?? false;
		},
		uiShow: () => {
			hudOff = false;
			deep = false;
		},
	});

	onMount(() => {
		// ---- DEV hook: __manticore.logo (tools/manticore/logo_probe.js) ------------------------------
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			Object.assign(((window as any).__manticore ??= {}), {
				/** THE PORTRAIT PHONE LOGO's option (constants LOGO.portraitPhoneEdge): 'current' (the old centre) or 'edge' (the
				 *  default since 2026-10-17: the tablet's left edge 2 CSS px from the screen's left edge). Returns the option in force. */
				logoPlace: (key: 'current' | 'edge') => {
					if (key === 'current' || key === 'edge') portraitOptions.logo = key;
					return portraitOptions.logo;
				},
				logo: {
					state: () => ({
						/** the still in the canvas: on (it is the logo), its art box in canvas px, the shadow, the file, the trace's place */
						still: { ...still.state(), on: stillOn, shownByHud: stillShown, ticking: stillTicking, mips },
						/** the stage bottom to top around the logo's host */
						order: (() => {
							const stage = host.parent?.children ?? [];
							const ix = (label: string) => stage.findIndex((c) => c.label === label);
							return { logo: stage.indexOf(host), scene: Math.max(ix('scene'), ix('scene-portrait')), creatureBehind: ix('creature-behind'), creatureFront: ix('creature-front'), count: stage.length, hostChildren: host.children.map((c) => c.label) };
						})(),
						canvasLogo: logoState.canvas,
						textures: (context.stateApp.pixiApplication?.renderer as any)?.texture?.managedTextures?.length ?? null,
					}),
					/** false = the still is not drawn (no logo in the canvas, the chrome's <img> shows) */
					enableStill: (on: boolean) => (stillEnabled = on),
				},
			});
		}
		return () => {
			stopStill();
			logoState.canvas = false;
			if (import.meta.env.DEV && typeof window !== 'undefined') {
				delete (window as any).__manticore?.logo;
				delete (window as any).__manticore?.logoPlace;
			}
			// the parent's unmount destroys the root without its children: they go here
			for (const child of host.removeChildren()) child.destroy({ children: true });
		};
	});
</script>
