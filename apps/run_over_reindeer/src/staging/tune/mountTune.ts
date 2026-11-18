// Mounts the tuning panel (`?tune=1`, or `?tune=<group>` to open one group) on document.body, outside the game's own
// tree. Imported dynamically, and only behind STAGING_TOOLS, from routes/+layout.svelte: a production bundle has
// neither this file nor the panel (scripts/check-production-bundle.mjs fails a build that carries ROR_TUNE_PANEL).
// Nothing is sent anywhere. Since 2026-11-17 the panel REMEMBERS its changed values across a reload (tuneStore.ts, one
// localStorage key, staging only): routes/+layout.svelte applies them before the board is built.
import { mount } from 'svelte';

import TunePanel from './TunePanel.svelte';

// the panel's styles, injected here so that no rule of it can reach a production stylesheet (as mountPerf.ts does)
const STYLES = `
.ror-tune { position: fixed; z-index: 2147482000; font: 12px/1.35 -apple-system, system-ui, sans-serif; color: #e8ecf2; pointer-events: auto; -webkit-user-select: none; user-select: none; }
.ror-tune * { box-sizing: border-box; }
.ror-tune button { font: inherit; color: inherit; cursor: pointer; }
.ror-tune .tab { min-width: 52px; min-height: 40px; padding: 6px 10px; background: rgba(8, 10, 14, 0.86); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 8px; font-weight: 700; touch-action: none; }
.ror-tune .tab .n { display: inline-block; margin-left: 6px; padding: 0 5px; border-radius: 8px; background: #e8c14a; color: #10141a; }
.ror-tune .box { width: min(360px, calc(100vw - 16px)); max-height: min(78vh, calc(100vh - 16px)); display: flex; flex-direction: column; background: rgba(8, 10, 14, 0.9); border: 1px solid rgba(255, 255, 255, 0.28); border-radius: 8px; overflow: hidden; }
.ror-tune .head { display: flex; align-items: center; gap: 4px; padding: 4px 6px; background: rgba(255, 255, 255, 0.08); touch-action: none; cursor: grab; }
.ror-tune .head .title { flex: 1; font-weight: 700; padding: 0 4px; }
.ror-tune .head button, .ror-tune .small { min-height: 32px; min-width: 32px; padding: 2px 8px; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 5px; }
.ror-tune .scroll { overflow: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; padding: 6px; }
.ror-tune details { margin-bottom: 6px; border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 6px; }
.ror-tune summary { display: flex; align-items: center; gap: 6px; padding: 6px 8px; min-height: 36px; cursor: pointer; list-style: none; }
.ror-tune summary::-webkit-details-marker { display: none; }
.ror-tune summary .g { font-weight: 700; flex: 1; }
.ror-tune .when { font-size: 10px; opacity: 0.7; }
.ror-tune .when.reload { color: #ff9a3c; opacity: 1; }
.ror-tune .rows { padding: 0 8px 8px; }
.ror-tune .sub { margin: 8px 0 2px; font-weight: 700; opacity: 0.8; }
.ror-tune .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 8px; align-items: center; padding: 3px 0; border-top: 1px solid rgba(255, 255, 255, 0.06); }
.ror-tune .row.changed .k { color: #e8c14a; }
.ror-tune .k { overflow-wrap: anywhere; }
.ror-tune .k .u { opacity: 0.6; }
.ror-tune .row input[type=range] { grid-column: 1 / -1; width: 100%; height: 28px; margin: 0; accent-color: #e8c14a; touch-action: pan-y; }
.ror-tune input[type=number], .ror-tune input[type=text], .ror-tune select { width: 96px; min-height: 30px; padding: 2px 4px; background: #10141a; color: #e8ecf2; border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 4px; font: 12px ui-monospace, Menlo, monospace; -webkit-user-select: text; user-select: text; }
.ror-tune .sw { width: 46px; height: 28px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.3); background: #3a3f4a; position: relative; padding: 0; }
.ror-tune .sw::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #e8ecf2; transition: left 0.1s; }
.ror-tune .sw.on { background: #5fd08a; }
.ror-tune .sw.on::after { left: 21px; }
.ror-tune .color { display: flex; align-items: center; gap: 4px; }
.ror-tune .chip { width: 18px; height: 18px; border-radius: 3px; border: 1px solid rgba(255, 255, 255, 0.4); }
.ror-tune .changes { margin-bottom: 8px; padding: 6px; border: 1px solid #e8c14a; border-radius: 6px; }
.ror-tune .changes textarea { width: 100%; min-height: 54px; background: #10141a; color: #e8ecf2; border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 4px; font: 11px/1.4 ui-monospace, Menlo, monospace; -webkit-user-select: text; user-select: text; resize: vertical; }
.ror-tune .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; align-items: center; }
.ror-tune .msg { opacity: 0.8; }
.ror-tune .find { padding: 6px 6px 4px; border-bottom: 1px solid rgba(255, 255, 255, 0.14); background: rgba(8, 10, 14, 0.96); }
.ror-tune .find input[type=search] { width: 100%; min-height: 32px; padding: 3px 8px; background: #10141a; color: #e8ecf2; border: 1px solid rgba(232, 193, 74, 0.6); border-radius: 5px; font: 13px -apple-system, system-ui, sans-serif; -webkit-user-select: text; user-select: text; }
.ror-tune .small.on { background: #e8c14a; color: #10141a; }
.ror-tune mark { background: #e8c14a; color: #10141a; border-radius: 2px; padding: 0 1px; }
.ror-tune summary .dot { display: inline-block; width: 7px; height: 7px; margin-left: 6px; border-radius: 50%; background: #e8c14a; vertical-align: middle; }
.ror-tune summary .cnt { font-size: 10px; opacity: 0.75; padding: 0 4px; border-radius: 6px; background: rgba(255, 255, 255, 0.1); }
.ror-tune .sub { position: sticky; top: -6px; z-index: 1; background: rgba(14, 17, 23, 0.98); padding: 3px 0; }
.ror-tune .k .key { display: block; font: 10px ui-monospace, Menlo, monospace; opacity: 0.7; }
.ror-tune .none { padding: 8px; }
.ror-tune .roam-ed { margin: 6px 0; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 6px; }
.ror-tune .roam-ed textarea { width: 100%; background: #10141a; color: #e8ecf2; border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 4px; font: 10px/1.35 ui-monospace, Menlo, monospace; -webkit-user-select: text; user-select: text; resize: vertical; }
.ror-tune .roam-overlay { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; z-index: -1; pointer-events: none; }
.ror-tune .roam-overlay svg { position: absolute; left: 0; top: 0; }
.ror-tune .roam-overlay .zone { fill: rgba(214, 22, 44, 0.22); stroke: rgba(214, 22, 44, 0.85); stroke-width: 1; }
.ror-tune .roam-overlay .zt { fill: #fff; font: 10px -apple-system, system-ui, sans-serif; paint-order: stroke; stroke: rgba(0, 0, 0, 0.7); stroke-width: 2px; }
.ror-tune .roam-overlay .path { fill: none; stroke: #e8c14a; stroke-width: 3; }
.ror-tune .roam-overlay .area { fill: rgba(232, 193, 74, 0.2); stroke: #e8c14a; stroke-width: 2; }
.ror-tune .roam-overlay .area.beyond { fill: rgba(232, 193, 74, 0.1); stroke: rgba(232, 193, 74, 0.5); stroke-dasharray: 6 4; }
.ror-tune .roam-overlay .to { fill: #fff; stroke: #10141a; stroke-width: 1.5; }
.ror-tune .roam-overlay .enter { stroke: #e8c14a; stroke-width: 2; stroke-dasharray: 6 5; }
.ror-tune .roam-overlay .body { fill: rgba(232, 193, 74, 0.1); stroke: rgba(232, 193, 74, 0.7); stroke-width: 1; stroke-dasharray: 3 3; }
.ror-tune .roam-overlay .body.picked { fill: rgba(95, 208, 138, 0.15); stroke: #5fd08a; }
.ror-tune .roam-overlay .me { fill: #5fd08a; stroke: #10141a; stroke-width: 1.5; }
.ror-tune .roam-overlay .wp { position: absolute; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; background: #e8c14a; color: #10141a; border: 2px solid #10141a; font-weight: 700; pointer-events: auto; touch-action: none; cursor: grab; padding: 0; }
.ror-tune .roam-overlay .wp.picked { background: #5fd08a; }
.ror-tune .roam-overlay .wp.enter { background: #fff; width: 34px; }
`;

let mounted = false;
export const mountTunePanel = (group: string | null) => {
	if (mounted || typeof document === 'undefined') return;
	mounted = true;
	const host = document.createElement('div');
	host.id = 'ror-tune-panel';
	// the bundle check's marker (scripts/check-production-bundle.mjs): it must be in no production build
	host.dataset.build = 'ROR_TUNE_PANEL';
	host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147482000';
	const style = document.createElement('style');
	style.textContent = STYLES;
	document.head.appendChild(style);
	document.body.appendChild(host);
	mount(TunePanel, { target: host, props: { group } });
};
