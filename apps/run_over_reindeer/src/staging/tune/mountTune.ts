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
