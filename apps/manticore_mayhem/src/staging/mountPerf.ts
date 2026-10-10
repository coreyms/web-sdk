// Mounts the staging readout on document.body, outside the game's own tree (so nothing in the game's
// layout, HUD or Pixi stage knows it exists). Imported dynamically, and only behind STAGING_TOOLS, from
// routes/+layout.svelte: a production bundle has neither this file nor the component. MM_STAGING_PERF_MOUNT
import { mount } from 'svelte';

import PerfReadout from './PerfReadout.svelte';

// the readout's styles, injected here so that no rule of it can reach a production stylesheet
const STYLES = `
.mm-perf { position: fixed; left: 4px; top: 4px; z-index: 2147483000; max-width: min(340px, calc(100vw - 8px)); max-height: calc(100vh - 8px); overflow: auto; background: rgba(8, 10, 14, 0.86); color: #e8ecf2; border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 6px; font: 10px/1.35 ui-monospace, Menlo, Consolas, monospace; pointer-events: auto; -webkit-user-select: text; user-select: text; }
.mm-perf .head { display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 7px; background: none; border: 0; color: inherit; font: inherit; font-weight: 700; text-align: left; cursor: pointer; }
.mm-perf .hz { margin-left: auto; font-weight: 400; opacity: 0.8; }
.mm-perf .dot { width: 9px; height: 9px; border-radius: 50%; background: #8a93a3; flex: none; }
.mm-perf .dot.smooth { background: #5fd08a; }
.mm-perf .dot.some { background: #e8c14a; }
.mm-perf .dot.struggling { background: #ff5a4a; }
.mm-perf .dot.reduced { background: #ff9a3c; }
.mm-perf .body { padding: 0 7px 7px; }
.mm-perf .line { margin-top: 3px; }
.mm-perf .small { opacity: 0.75; }
.mm-perf .ua { word-break: break-all; }
.mm-perf table { width: 100%; margin-top: 4px; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.mm-perf th, .mm-perf td { padding: 0 4px 0 0; text-align: right; font-weight: 400; }
.mm-perf th { opacity: 0.6; }
.mm-perf tr.partial td { opacity: 0.6; }
.mm-perf .actions { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.mm-perf .copy { min-height: 32px; padding: 4px 10px; background: #e8ecf2; color: #10141a; border: 0; border-radius: 4px; font: inherit; font-weight: 700; cursor: pointer; }
.mm-perf textarea { width: 100%; margin-top: 5px; background: #10141a; color: #e8ecf2; border: 1px solid rgba(255, 255, 255, 0.25); font: inherit; }
`;

let mounted = false;
export const mountPerfReadout = () => {
	if (mounted || typeof document === 'undefined') return;
	mounted = true;
	const host = document.createElement('div');
	host.id = 'mm-staging-perf';
	// the host itself takes no taps and no room: only the box inside it does
	host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147483000';
	const style = document.createElement('style');
	style.textContent = STYLES;
	document.head.appendChild(style);
	document.body.appendChild(host);
	mount(PerfReadout, { target: host });
};
