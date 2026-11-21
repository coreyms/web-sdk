<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { onMount, onDestroy, type Snippet } from 'svelte';
	import { devicePixelRatio } from 'svelte/reactivity/window';

	import { getContextApp } from '../context.svelte';
	import { preloadFont } from '../utils.svelte';

	type Props = {
		children: Snippet;
		/** DEPTH AND STENCIL BUFFERS (default true: unchanged). Pixi 8.8.1 makes its WebGL context with `stencil: true`
		 *  hard-coded and the browser's default depth (true) (rendering/renderers/gl/context/GlContextSystem.mjs init), and
		 *  takes no option for either. false: this component makes the context itself, with the very attributes Pixi would
		 *  ask for but depth and stencil false, and hands Pixi the canvas and the context (the `canvas` and `context`
		 *  options: GlContextSystem.initFromContext). Pixi then needs a stencil buffer only for a stencil mask
		 *  (StencilMaskPipe, renderTarget.ensureDepthStencil): a game that passes false must draw no mask. */
		depthStencil?: boolean;
	};

	const props: Props = $props();
	const context = getContextApp();

	let wrap: HTMLDivElement;
	let initialised = $state(false);

	const initialiseApplication = async () => {
		PIXI.Assets.reset();

		await preloadFont();
		context.stateApp.pixiApplication = new PIXI.Application<PIXI.Renderer<HTMLCanvasElement>>();
		const options: Partial<PIXI.ApplicationOptions> = {
			autoDensity: true,
			backgroundAlpha: 0,
			hello: true,
			multiView: false,
			antialias: true,
			clearBeforeRender: true,
			// Pixi 8.8.1's WebGPU batcher assumes 32 samplers without requesting requiredLimits — devices that
			// grant the spec-default 16 (maxSampledTexturesPerShaderStage) render a black canvas. WebGL until >=8.15.
			preference: 'webgl',
			powerPreference: 'high-performance',
			resolution: devicePixelRatio.current,
			resizeTo: window,
		};
		if (props.depthStencil === false) {
			// Pixi's own attributes (GlContextSystem init): alpha when the background is not opaque, premultipliedAlpha
			// true, antialias (no back buffer), preserveDrawingBuffer false, the power preference; WebGL 2 first, then 1
			const canvas = document.createElement('canvas');
			const attributes: WebGLContextAttributes = {
				alpha: (options.backgroundAlpha ?? 1) < 1,
				premultipliedAlpha: true,
				antialias: !!options.antialias,
				depth: false,
				stencil: false,
				preserveDrawingBuffer: false,
				powerPreference: options.powerPreference ?? 'default',
			};
			const gl = canvas.getContext('webgl2', attributes) ?? canvas.getContext('webgl', attributes);
			if (gl) {
				options.canvas = canvas;
				options.context = gl as WebGL2RenderingContext;
			}
		}
		// (a context without a stencil buffer: Pixi's validateContext warns once that masks may not render; this app
		// asked for it and draws none, so that one line is kept out of the console while init runs)
		const warn = console.warn;
		if (options.context) {
			console.warn = (...args: unknown[]) => {
				if (args.some((a) => typeof a === 'string' && a.includes('does not have a stencil buffer'))) return;
				warn(...args);
			};
		}
		try {
			await context.stateApp.pixiApplication.init(options);
		} finally {
			console.warn = warn;
		}

		wrap.appendChild(context.stateApp.pixiApplication.canvas);

		// to prevent that you can't scroll the page with touch on the canvas. https://github.com/pixijs/pixijs/issues/4824
		context.stateApp.pixiApplication.renderer.events.autoPreventDefault = false;
		context.stateApp.pixiApplication.renderer.canvas.style.touchAction = 'auto';
	};

	onMount(async () => {
		try {
			if (!initialised) await initialiseApplication();
			initialised = true;
		} catch (error) {
			console.error(error);
		}
	});

	onDestroy(() => {
		if (context.stateApp.pixiApplication) {
			context.stateApp.pixiApplication.destroy();
		}
	});
</script>

<div bind:this={wrap}>
	{#if initialised}
		{@render props.children()}
	{/if}
</div>
