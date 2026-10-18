// THE CREATURE SHEET DECODER (game/stripUpload.ts, constants CREATURE.upload; Safari, 2026-10-18). One of his sheets'
// pictures (the file itself: the main thread fetched it, so the page's own requests and the HTTP cache the prefetch
// filled are exactly as before, and this worker never goes to the network) decoded here, OFF the main thread, into raw
// premultiplied RGBA, handed back by transfer (no copy). On the main thread Safari spent about 75 ms on the first touch of
// a decoded ~3,900 x 3,700 picture whatever was uploaded from it; raw pixels upload in strips at about 1 ms each.
// A same-origin file, never a blob: worker (engine.io's CSP has no blob:).
type Ask = { id: number; file: Blob };

self.onmessage = async (e: MessageEvent<Ask>) => {
	const { id, file } = e.data;
	try {
		const bmp = await createImageBitmap(file);
		const canvas = new OffscreenCanvas(bmp.width, bmp.height);
		const ctx = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D | null;
		if (!ctx) throw new Error('no 2d');
		ctx.drawImage(bmp, 0, 0);
		bmp.close();
		const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
		// getImageData hands back straight alpha; the GPU copy is premultiplied (alphaMode 'premultiplied-alpha')
		for (let i = 0; i < px.length; i += 4) {
			const a = px[i + 3];
			if (a === 255) continue;
			px[i] = (px[i] * a + 127) / 255;
			px[i + 1] = (px[i + 1] * a + 127) / 255;
			px[i + 2] = (px[i + 2] * a + 127) / 255;
		}
		(self as unknown as Worker).postMessage({ id, w: canvas.width, h: canvas.height, buf: px.buffer }, [px.buffer]);
	} catch (err) {
		(self as unknown as Worker).postMessage({ id, error: String(err) });
	}
};
