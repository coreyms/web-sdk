// @ts-nocheck: a node probe script, not app code (svelte-check picks up .mjs files)
// WATCHES: apps/run_over_reindeer/src/{components/Board.svelte,components/Sound.svelte,game/sound.ts};
// WATCHES: apps/run_over_reindeer/static/assets/audio/music.json;
// WATCHES: ; __reindeer.ambienceHold, __reindeer.atRest, __reindeer.fixtures, __reindeer.gameType, __reindeer.hud, __reindeer.musicLoop
// WATCHES: ; __reindeer.musicPlay, ROUND, bgm_base, bgm_bonus, bgm_super, .landing, .hudp, .spin
// THE MUSIC LOOP PROBE (Run Over Reindeer's own base, Free Spins and Super loops, wired 2026-11-15): the running game,
// nothing patched in it. For each of bgm_base, bgm_bonus and bgm_super it lets the track wrap and MEASURES THE WRAP:
// the game's music output is tapped (desktop Chromium: the track's own media element through a MediaElementSource;
// WebKit with an iPhone user agent, the iPhone path: Howler's master gain, which both the element streams and the
// decoded base loop feed), and the tap is lined up against the shipped file decoded in the page. Around the wrap it
// finds where the file's last 60 ms and its first 60 ms land in what was heard: gap = samples between the two (0 =
// seamless, more = a pause or repeated audio, less = audio lost), plus the longest silent run (5 ms windows under -60
// dBFS) within 0.5 s of the wrap. Element tracks are put 2.5 s before their end to save time (a seek, then a natural
// wrap); the decoded base loop on the iPhone path cannot seek, so it plays its whole 32 s.
// ROUND 2 (2026-11-15): all three loops are DECODED Web Audio loops on every platform now (game/sound.ts bufferedLoops),
// so every track is measured on its decoded loop, after one natural wrap (no seek: a decoded loop cannot be seeked),
// and the probe reports each decoded copy's memory (frames x channels x 4 bytes) and, off the iPhone path, the one
// hand-over from the stream to the loop (the capture's position in the file 0.6 s before and after it: 0 = no audio
// lost or repeated). Engines: chromium (desktop), webkit (iPhone user agent), webkit-desktop (a Mac Safari-class page:
// WebKit with its own user agent, no touch). The tap on the desktop pages takes both the track's media element and
// Howler's master gain (the loop feeds it), so the hand-over is heard whole.
// ROUNDS=1 (Chromium only) also plays a natural Free Spins round and a natural Super round and logs every music
// element start and pause against the round's events, to show when each track starts and stops.
//   NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules APP=http://localhost:3014 [ENGINES=chromium,webkit] \
//     [ROUNDS=1] [OUT=<file.json>] node tools/music_loop_probe.mjs
// KNOWN (Manticore's music_loop_probe, decimus 2026-11-01): Linux WebKit shows hand-over timing artifacts a real iPhone
// does not; this probe runs on the Mac. Uses the dev server that is already running. One headless browser at a time:
// take the shared lock around it (mkdir /tmp/hud_mock_shot.lock ... rmdir).
import { createRequire } from 'node:module';
import { pressRoundCards } from './round_card_press.mjs';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const pw = require('playwright');

const APP = process.env.APP || 'http://localhost:3014';
const ENGINES = (process.env.ENGINES || 'chromium,webkit,webkit-desktop').split(',');
const ROUNDS = process.env.ROUNDS === '1';
const OUT = process.env.OUT || '';
const TRACKS = ['bgm_base', 'bgm_bonus', 'bgm_super'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

let pass = 0;
let fail = 0;
const check = (ok, msg, detail) => {
	if (ok) pass += 1;
	else fail += 1;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${!ok && detail !== undefined ? ' ' + JSON.stringify(detail).slice(0, 300) : ''}`);
};

// SILENT OUTPUT (WebKit has no --mute-audio): every connection to an AudioContext's destination goes through one gain at
// 0 first, and a media element that is not routed into Web Audio is muted when it plays. The game and the tap run as
// ever (the tap reads before the destination), nothing reaches the speakers.
const SILENCE = () => {
	const connect = AudioNode.prototype.connect;
	AudioNode.prototype.connect = function (dest, ...rest) {
		if (typeof AudioDestinationNode !== 'undefined' && dest instanceof AudioDestinationNode && !this.__zero) {
			const ctx = dest.context;
			if (!ctx.__zero) {
				const z = ctx.createGain();
				z.gain.value = 0;
				z.__zero = true;
				connect.call(z, dest);
				ctx.__zero = z;
			}
			return connect.call(this, ctx.__zero, ...rest);
		}
		return connect.call(this, dest, ...rest);
	};
	for (const C of [window.AudioContext, window.webkitAudioContext].filter(Boolean)) {
		const make = C.prototype.createMediaElementSource;
		C.prototype.createMediaElementSource = function (el) {
			el.__routed = true;
			el.muted = false;
			return make.call(this, el);
		};
	}
	const play = HTMLMediaElement.prototype.play;
	HTMLMediaElement.prototype.play = function (...a) {
		if (!this.__routed) this.muted = true;
		return play.apply(this, a);
	};
};

// the tap, installed before the game loads
const TAP = (mode) => {
	const T = (window.__mtap = { mode, ring: null, n: 0, frozen: false, rate: 0, events: [] });
	const N = 1 << 19; // about 11 s at 48 kHz
	let node = null;
	const ensure = (ctx) => {
		if (node) return node;
		T.rate = ctx.sampleRate;
		T.ring = new Float32Array(N);
		node = ctx.createScriptProcessor(4096, 1, 1);
		node.onaudioprocess = (e) => {
			if (T.frozen) return;
			const d = e.inputBuffer.getChannelData(0);
			for (let i = 0; i < d.length; i++) T.ring[(T.n + i) & (N - 1)] = d[i];
			T.n += d.length;
		};
		const mute = ctx.createGain();
		mute.gain.value = 0;
		node.connect(mute);
		mute.connect(ctx.destination);
		return node;
	};
	T.ensure = ensure;
	const play = HTMLMediaElement.prototype.play;
	HTMLMediaElement.prototype.play = function (...a) {
		const src = this.currentSrc || this.src || '';
		const m = /(bgm_[a-z]+)\./.exec(src);
		if (m) {
			T.events.push({ t: performance.now(), what: 'play', track: m[1] });
			T.el = T.el || {};
			T.el[m[1]] = this;
			if (!this.__pl) {
				this.__pl = true;
				this.addEventListener('pause', () => T.events.push({ t: performance.now(), what: 'pause', track: m[1] }));
			}
			if (mode === 'element' && !this.__tapped && window.Howler && window.Howler.ctx) {
				this.__tapped = true;
				try {
					const ctx = window.Howler.ctx;
					const s = ctx.createMediaElementSource(this);
					s.connect(ctx.destination);
					s.connect(ensure(ctx));
				} catch (e) {
					T.error = String(e);
				}
			}
		}
		return play.apply(this, a);
	};
	// the iPhone path: everything Howler plays reaches its master gain
	T.tapMaster = () => {
		const H = window.Howler;
		if (!H || !H.ctx || !H.masterGain || T.master) return !!T.master;
		H.masterGain.connect(ensure(H.ctx));
		T.master = true;
		return true;
	};
	// THE HAND-OVER: where the capture 0.6 s before sample index `nd` and 0.6 s after it sit in the decoded file
	T.handover = async (url, nd, loopEnd) => {
		const ctx = window.Howler.ctx;
		const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
		// the tap hears the output down-mixed to mono (a one channel ScriptProcessor): the file down-mixed the same way
		const ref = new Float32Array(buf.length);
		for (let c = 0; c < buf.numberOfChannels; c++) {
			const d = buf.getChannelData(c);
			for (let i = 0; i < d.length; i++) ref[i] += d[i] / buf.numberOfChannels;
		}
		const sr = ctx.sampleRate;
		const L = Math.round(loopEnd * sr);
		const W = Math.round(0.06 * sr);
		const off = Math.round(0.6 * sr);
		const seg = (start) => {
			const out = new Float32Array(W);
			for (let k = 0; k < W; k++) out[k] = T.ring[(start + k) & (N - 1)];
			return out;
		};
		const a = seg(nd - off - W);
		const b = seg(nd + off);
		const score = (s, p, step) => {
			let dot = 0;
			let e1 = 0;
			let e2 = 0;
			for (let k = 0; k < W; k += step) {
				const r = ref[(p + k) % L];
				dot += s[k] * r;
				e1 += s[k] * s[k];
				e2 += r * r;
			}
			return dot / Math.sqrt(e1 * e2 + 1e-20);
		};
		const search = (s, from, to) => {
			let best = { p: -1, c: -2 };
			for (let p = from; p < to; p += 4) {
				const c = score(s, ((p % L) + L) % L, 4);
				if (c > best.c) best = { p, c };
			}
			const coarse = best.p;
			for (let p = coarse - 6; p <= coarse + 6; p++) {
				const c = score(s, ((p % L) + L) % L, 1);
				if (c > best.c || p === coarse - 6) best = c > best.c ? { p, c } : best;
			}
			return best;
		};
		const pa = search(a, 0, L);
		const expect = pa.p + 2 * off + W;
		const pb = search(b, expect - Math.round(0.4 * sr), expect + Math.round(0.4 * sr));
		const jump = pb.p - expect;
		return { jumpSamples: jump, jumpMs: Math.round((jump / sr) * 1e4) / 10, matchBefore: Math.round(pa.c * 1000) / 1000, matchAfter: Math.round(pb.c * 1000) / 1000 };
	};
	// line the capture up against the decoded file around its wrap
	T.measure = async (url, loopEnd) => {
		const ctx = window.Howler.ctx;
		const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
		// the tap hears the output down-mixed to mono (a one channel ScriptProcessor): the file down-mixed the same way
		const ref = new Float32Array(buf.length);
		for (let c = 0; c < buf.numberOfChannels; c++) {
			const d = buf.getChannelData(c);
			for (let i = 0; i < d.length; i++) ref[i] += d[i] / buf.numberOfChannels;
		}
		const L = Math.round(loopEnd * ctx.sampleRate);
		const W = Math.round(0.06 * ctx.sampleRate);
		const cap = [];
		const have = Math.min(T.n, N);
		for (let i = T.n - have; i < T.n; i++) cap.push(T.ring[i & (N - 1)]);
		const find = (seg, from, to) => {
			let best = -Infinity;
			let at = -1;
			let e2 = 0;
			for (let k = 0; k < seg.length; k++) e2 += seg[k] * seg[k];
			for (let p = Math.max(0, from); p < Math.min(cap.length - seg.length, to); p++) {
				let dot = 0;
				let c2 = 0;
				for (let k = 0; k < seg.length; k += 2) {
					dot += seg[k] * cap[p + k];
					c2 += cap[p + k] * cap[p + k];
				}
				const score = dot / Math.sqrt(c2 * (e2 / 2) + 1e-12);
				if (score > best) {
					best = score;
					at = p;
				}
			}
			return { at, score: best };
		};
		const tail = ref.subarray(L - W, L);
		const head = ref.subarray(0, W);
		const e = find(tail, 0, cap.length);
		const s = find(head, e.at, Math.min(cap.length, e.at + W + Math.round(2 * ctx.sampleRate)));
		const gap = s.at - (e.at + W);
		// silent 5 ms windows within 0.5 s of the wrap
		const w5 = Math.round(0.005 * ctx.sampleRate);
		let run = 0;
		let longest = 0;
		const c0 = e.at + W;
		for (let p = Math.max(0, c0 - ctx.sampleRate / 2); p + w5 < Math.min(cap.length, c0 + ctx.sampleRate / 2); p += w5) {
			let r = 0;
			for (let k = 0; k < w5; k++) r += cap[p + k] * cap[p + k];
			const db = 10 * Math.log10(r / w5 + 1e-20);
			run = db < -60 ? run + 1 : 0;
			longest = Math.max(longest, run);
		}
		let capRms = 0;
		for (let k = 0; k < W; k++) capRms += cap[s.at + k] ** 2;
		return { rate: ctx.sampleRate, decodedFrames: buf.length, loopFrames: L, gapSamples: gap, gapMs: Math.round((gap / ctx.sampleRate) * 1e4) / 10, matchEnd: Math.round(e.score * 1000) / 1000, matchStart: Math.round(s.score * 1000) / 1000, silentMs: longest * 5, capturedRmsDb: Math.round(10 * Math.log10(capRms / W + 1e-20) * 10) / 10 };
	};
};

async function boot(browser, engine) {
	const iphone = engine === 'webkit';
	const ctx = await browser.newContext(iphone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPHONE_UA } : { viewport: { width: 1440, height: 900 } });
	// (2026-11-17: the bonus entry waits for the press: round_card_press.mjs presses it on the old card's timing)
	await pressRoundCards(ctx);
	// every WebKit page is silenced by the init script (WebKit has no --mute-audio); Chromium runs with --mute-audio
	if (engine !== 'chromium') await ctx.addInitScript(SILENCE);
	await ctx.addInitScript(TAP, iphone ? 'master' : 'element');
	const p = await ctx.newPage();
	const errs = [];
	p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
	await p.goto(`${APP}/?lang=en&sessionID=mus${engine.replace(/\W/g, '')}${Date.now()}${iphone ? '&tier=phone' : ''}`, { waitUntil: 'domcontentloaded' });
	for (let i = 0; i < 200; i++) {
		const ok = await p.evaluate(() => !!(window.__reindeer && window.__reindeer.atRest && window.__reindeer.atRest() && !document.querySelector('.landing'))).catch(() => false);
		if (ok) break;
		if (i % 2 === 1) await p.mouse.click(iphone ? 195 : 720, iphone ? 250 : 270).catch(() => {});
		await sleep(600);
	}
	await sleep(1500);
	return { ctx, p, errs, iphone };
}

async function wrapOf(p, iphone, track) {
	const manifest = await p.evaluate(async () => (await (await fetch('./assets/audio/music.json', { cache: 'no-store' })).json()).tracks);
	const t = manifest[track];
	// (round 3: the road's ambience, an effects loop under the base game, plays through Howler's master too: held off,
	// so the capture is the music alone)
	await p.evaluate(() => window.__reindeer.ambienceHold?.(true));
	await p.evaluate((name) => window.__reindeer.musicPlay(name), track);
	await sleep(400);
	// the file the stream plays (the loop decodes the same one)
	const url = (await p.evaluate((name) => window.__mtap.el?.[name]?.currentSrc ?? null, track)) ?? t.src.find((s) => (iphone ? /\.m4a/ : /\.ogg/).test(s));
	await p.evaluate(() => window.__mtap.tapMaster());
	// the hand-over to the decoded loop (3 s after the start, once the context runs): its capture index
	let phase = null;
	let nd = null;
	const h0 = Date.now();
	while (Date.now() - h0 < 9000) {
		const st = await p.evaluate(() => ({ loop: window.__reindeer.musicLoop(), n: window.__mtap.n }));
		phase = st.loop?.phase ?? null;
		if ((phase === 'fading' || phase === 'on') && nd === null) nd = st.n;
		if (phase === 'on') break;
		await sleep(100);
	}
	const buffered = phase === 'on';
	let handover = null;
	let mem = null;
	if (buffered) {
		await sleep(1000);
		const st = await p.evaluate(() => window.__reindeer.musicLoop());
		mem = { frames: st.frames, channels: st.channels, sampleRate: st.sampleRate, bytes: st.frames * st.channels * 4, mb: Math.round(((st.frames * st.channels * 4) / 1e6) * 100) / 100, located: st.located };
		if (!iphone) {
			// (the iPhone path matches the stream by ear itself, an AnalyserNode: its own offset is `located`)
			await p.evaluate(() => (window.__mtap.frozen = true));
			handover = await p.evaluate(([u, n, d]) => window.__mtap.handover(u, n, d), [url, nd, t.duration]);
			await p.evaluate(() => (window.__mtap.frozen = false));
		}
		// one natural wrap of the decoded loop
		let last = -1;
		let wrapped = false;
		const t0 = Date.now();
		while (!wrapped && Date.now() - t0 < 60000) {
			const s2 = await p.evaluate(() => window.__reindeer.musicLoop());
			if (s2 && s2.phase === 'on' && typeof s2.position === 'number') {
				if (last >= 0 && s2.position < last - 1) wrapped = true;
				last = s2.position;
			}
			await sleep(200);
		}
		check(wrapped, `${track}: the decoded loop wrapped`);
	} else {
		check(false, `${track}: on its decoded loop (phase ${phase})`);
		await p.evaluate((name) => {
			const el = window.__mtap.el?.[name];
			if (el && el.duration) el.currentTime = Math.max(0, el.duration - 2.5);
		}, track);
		let wrapped = false;
		let last = -1;
		const t0 = Date.now();
		while (!wrapped && Date.now() - t0 < 15000) {
			const ct = await p.evaluate((name) => window.__mtap.el?.[name]?.currentTime ?? -1, track);
			if (last >= 0 && ct >= 0 && ct < last - 1) wrapped = true;
			last = ct;
			await sleep(100);
		}
		check(wrapped, `${track}: the element wrapped`);
	}
	await sleep(1500);
	await p.evaluate(() => (window.__mtap.frozen = true));
	const m = await p.evaluate(([u, d]) => window.__mtap.measure(u, d), [url, t.duration]);
	await p.evaluate(() => (window.__mtap.frozen = false));
	return { track, path: buffered ? 'decoded Web Audio loop' : 'media element', file: url.split('?')[0].split('/').pop(), duration: t.duration, memory: mem, handover, ...m };
}

(async () => {
	const results = [];
	for (const engine of ENGINES) {
		// Chromium muted at its output (--mute-audio); WebKit silenced by the SILENCE init script
		const browser = await pw[engine === 'chromium' ? 'chromium' : 'webkit'].launch(engine === 'chromium' ? { args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] } : {});
		try {
			const { ctx, p, errs, iphone } = await boot(browser, engine);
			// THE MANIFEST (2026-11-19): this game's three tracks and no other (Manticore's bgm_epic and bgm_maxwin left)
			const listed = Object.keys(await p.evaluate(async () => (await (await fetch('./assets/audio/music.json', { cache: 'no-store' })).json()).tracks)).sort();
			check(JSON.stringify(listed) === JSON.stringify([...TRACKS].sort()), `${engine}: music.json lists exactly ${TRACKS.join(', ')}`, listed);
			for (const track of TRACKS) {
				const r = await wrapOf(p, iphone, track);
				r.engine = engine;
				results.push(r);
				console.log(`  ${engine} ${track} (${r.path}, ${r.file}): gap ${r.gapSamples} samples (${r.gapMs} ms) at ${r.rate} Hz, longest silence ${r.silentMs} ms near the wrap, match ${r.matchEnd}/${r.matchStart}, level ${r.capturedRmsDb} dBFS`);
				if (r.memory) console.log(`  ${engine} ${track}: decoded copy ${r.memory.frames} frames x ${r.memory.channels} ch at ${r.memory.sampleRate} Hz = ${r.memory.mb} MB${r.memory.located ? `; stream located ${r.memory.located.offsetMs.toFixed(1)} ms from its currentTime (match ${r.memory.located.match.toFixed(3)})` : ''}`);
				if (r.handover) console.log(`  ${engine} ${track}: hand-over from the stream: ${r.handover.jumpSamples} samples (${r.handover.jumpMs} ms; + = audio skipped, - = repeated), match ${r.handover.matchBefore}/${r.handover.matchAfter}`);
				if (r.path !== 'media element') {
					// the decoded loop: the file found on both sides of the wrap, no samples between them, and no silence but the
					// master's own 4 ms fade out and 4 ms fade in (one or two 5 ms windows)
					check(r.matchEnd > 0.9 && r.matchStart > 0.9, `${engine} ${track}: the file's end and start were found in what played (${r.matchEnd}, ${r.matchStart})`);
					check(Math.abs(r.gapSamples) <= 2 && r.silentMs <= 10, `${engine} ${track}: seamless wrap (${r.gapSamples} samples, ${r.silentMs} ms under -60 dBFS)`);
				} else console.log(`  INFO ${engine} ${track}: a media element loop, MEASURED ONLY (the house method streams it; WebKit bug 230553 on iPhone, Chromium as it is). Match ${r.matchEnd}/${r.matchStart}: under 0.9 the gap figure is not reliable (a broken wrap does not line up with the file)`);
			}
			if (ROUNDS && engine === 'chromium') {
				await p.evaluate(() => window.__reindeer.musicPlay('bgm_base'));
				await sleep(800);
				for (const book of ['natural_free_spins', 'natural_super']) {
					await p.evaluate((b) => {
						window.__mtap.events.length = 0;
						window.__t0 = performance.now();
						window.__reindeer.fixtures.next(b);
					}, book);
					await p.click('.hudp button.spin');
					const t0 = Date.now();
					for (;;) {
						const st = await p.evaluate(() => ({ g: window.__reindeer.hud.gates(), idle: window.__reindeer.hud.idle(), rest: window.__reindeer.atRest(), gt: window.__reindeer.gameType() }));
						if (st.g > 0) await p.mouse.click(720, 360).catch(() => {});
						else if (st.idle && st.rest && Date.now() - t0 > 3000) break;
						if (Date.now() - t0 > 300000) break;
						await sleep(300);
					}
					const ev = await p.evaluate(() => window.__mtap.events.map((e) => ({ ...e, t: Math.round(e.t - window.__t0) })));
					console.log(`  ${book}: ` + ev.map((e) => `${e.t} ms ${e.what} ${e.track}`).join('; '));
					results.push({ engine, round: book, events: ev });
					const want = book === 'natural_super' ? 'bgm_super' : 'bgm_bonus';
					const into = ev.find((e) => e.what === 'play' && e.track === want);
					const back = ev.find((e) => e.what === 'play' && e.track === 'bgm_base' && into && e.t > into.t);
					check(!!into && !!back, `${book}: ${want} starts in the round and bgm_base comes back after it`);
				}
			}
			check(errs.length === 0, `${engine}: no page errors`, errs);
			await ctx.close();
		} finally {
			await browser.close();
		}
	}
	if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 1));
	console.log(`\n${pass} pass, ${fail} fail`);
	process.exit(fail ? 1 : 0);
})();
