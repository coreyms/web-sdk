// THE RENDER RESOLUTION CAP BY DEVICE, as pure functions of static signals (no window, no build flags), so a node
// check can put any device through them (tools/manticore/rescap_check.mjs) and game/deviceTier.ts can read them once
// at module load. The numbers are constants.ts PHONE_2X_ALLOW, PHONE_3X_ALLOW and RENDER_RESOLUTION_CAP.
import { PHONE_2X_ALLOW, PHONE_3X_ALLOW, RENDER_RESOLUTION_CAP } from './constants';

export type DeviceSignals = { userAgent: string; touchPoints: number; density: number; screenWidth: number; screenHeight: number };

/** THE PHONE ALLOWLIST (constants PHONE_2X_ALLOW): is this an iPhone 12 or newer, by its static signals? */
export const phoneAllowed2x = (d: DeviceSignals): boolean => {
	if (!PHONE_2X_ALLOW.on) return false;
	// an iPhone's own WebKit (every iOS browser is WebKit): the token, the engine and a touch screen
	const iphone = /\biPhone\b/.test(d.userAgent) && /AppleWebKit/.test(d.userAgent) && d.touchPoints > 0;
	const short = Math.min(d.screenWidth, d.screenHeight);
	return iphone && Math.abs(d.density - PHONE_2X_ALLOW.density) < 0.01 && short >= PHONE_2X_ALLOW.minShort && !(PHONE_2X_ALLOW.notShort as readonly number[]).includes(short);
};

/** THE LARGE IPHONES (constants PHONE_3X_ALLOW): on the 2x list, and a short side of at least minShort CSS px */
export const phoneAllowed3x = (d: DeviceSignals): boolean => PHONE_3X_ALLOW.on && phoneAllowed2x(d) && Math.min(d.screenWidth, d.screenHeight) >= PHONE_3X_ALLOW.minShort;

/** the cap for a device: off the phone tier the desktop cap (2); on it, 3 for a large allowlisted iPhone, 2 for an
 *  allowlisted one, 1.5 for every other phone. `?rescap=` is applied on top of this by game/deviceTier.ts. */
export const deviceResolutionCap = (phoneTier: boolean, d: DeviceSignals): number => {
	if (!phoneTier) return RENDER_RESOLUTION_CAP.desktop;
	if (phoneAllowed3x(d)) return RENDER_RESOLUTION_CAP.phone3x;
	return phoneAllowed2x(d) ? RENDER_RESOLUTION_CAP.desktop : RENDER_RESOLUTION_CAP.phone;
};
