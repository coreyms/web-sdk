# HUD theme ("Frost", the house HUD from Manticore's round 5 "Drop 6" and round 6)

The HUD is Manticore's (`apps/manticore_mayhem/src/ui/hud`), copied with the same files, rules and numbers. Its look is
one theme block: `ui/hudTheme.ts`. It injects every token as a `--hud-<name>` CSS custom property on `:root`, so the
HUD planes and the modals all read it. No HUD component hard-codes a color. Colors used at many strengths are
`r, g, b` triplets (`rgba(var(--hud-accent-rgb), .55)`); the rest are plain values.

This game's theme is Frost, concept "Frost, Red Ring" from the Frost mock: pale ice glass over the dark beds, a bright
frosted top edge and an icy blue bottom edge, Rudolph-nose red for everything that is on, a red ring around the Spin
with a green track and spinner inside it, a holly green feature button that turns red with a mode on, gold white for a
win, icy blue words, white numbers, deep ice blue menus.

## Tokens (by role)

| Token | Role |
| --- | --- |
| `font`, `font-title` | HUD face (Outfit Black), the Autoplay title face (Overpass, this game's display face) |
| `ink-rgb` | numbers, icons, button words |
| `label-rgb`, `label-warm-rgb` | the small spaced words (BALANCE, key words); the second set (WIN, portrait, sideways) |
| `shadow-rgb` | text and drop shadows |
| `accent-rgb`, `accent-hi-rgb` | the red: open Menu and Auto, Turbo bars, chosen states, slider fill, the Spin's glow |
| `accent-ink-rgb`, `accent-cream-rgb`, `accent-deep-rgb` | the Ante amount, the palest red (Spin top light, words on the "on" button), the dark end of a red gradient |
| `win-rgb`, `win-hi-rgb`, `win-ink-rgb`, `win-cream-rgb` | NEW: a lit or big WIN (glow, word, number) |
| `glass-top-rgb`, `glass-mid-rgb`, `glass-bottom-rgb` + `glass-*-a` | the dock's fill gradient and its alphas |
| `panel-top-rgb`, `panel-mid-rgb`, `panel-bottom-rgb` + `panel-*-a` | NEW colors: the menu panels' fill (the help menu, `.am-glass`, the Autoplay switches) |
| `key-rgb` | a key's own glass (round keys, steppers, chips) |
| `key-a`, `key-rim-rgb`, `key-rim-a` | NEW (bet bar fix): that glass's strength; a key's one even 1 px rim and its strength |
| `menu-key-1/2-rgb`, `menu-key-a`, `menu-key-rim-rgb` | NEW (bet bar fix): the Menu key's own near opaque dark glass and rim |
| `key-on-1/2-rgb`, `key-on-a`, `key-on-ink-rgb` | NEW (bet bar fix): a lit key's fill and ink (Auto loaded, Turbo on, Menu open, the picked scene) |
| `key-hot-1/2-rgb`, `key-hot-ink-rgb` | NEW (bet bar fix): the hotter lit key (a run playing, Turbo at instant) |
| `edge-top-rgb`/`-a`, `edge-bottom-rgb`/`-a`, `spec-a` | the 1 px gradient edge (top, bottom) and the specular line |
| `edge-key-rgb` | NEW: a key's bottom edge (round keys, steppers, chips) |
| `spin-core-rgb`, `spin-deep-rgb`, `spin-rim-top/side/bottom` | the Spin hero |
| `spin-rim-w`, `spin-track-rgb`, `spin-track-a`, `spin-arc-rgb` | NEW: the rim's width, the thin circle inside it, the spinner (comet) and the free-spins arc |
| `feature-rgb`, `feature-hi-rgb`, `feature-deep-1/2-rgb`, `feature-rim-rgb`, `feature-ink` | the feature button (holly green) |
| `feature-edge-bottom-rgb` | NEW: the feature button's bottom edge |
| `feature-on-deep-1/2-rgb`, `feature-on-rim` | the feature button with a mode on (an Ante level, an armed buy): red |
| `disabled-a`, `locked-a` | a disabled key's opacity, a locked amount's opacity |
| `dim` | the dimmed scene behind a menu |
| `radius-panel`, `radius-chip` | panel and chip corners |

## The NEW tokens and Manticore

Manticore draws the NEW roles with its accent (gold) or its glass colors, so its hud.css says `accent` where this
copy says `win`, `edge-key`, `feature-edge-bottom` or `spin-arc`. Each NEW token's Manticore value is written beside it
in `hudTheme.ts`. Adding those lines to Manticore's `hudTheme.ts` and taking this copy's `hud.css`, `HudMenuPanel.svelte`
and the `.am-glass` rule changes nothing in Manticore's look and makes the two HUDs the same files again.

## The bet bar fix (2026-11-19)

Stake rejected the bar ("Poor bet UI bar"); Corey's fixes to the existing bar, the same in both games:

1. No stock glyph on the feature button: `HUD_CONFIG.featureGlyph` is `'none'` (the word alone); `FEATURE_GLYPHS` holds the
   candidates drawn from the game's own art (one line to switch).
2. No hard ended lines: every key has one even 1 px rim in one color, a top light and a bottom light that are 1 px inset
   crescents (they narrow to nothing round the curve), and the dock's edges and specular line fade out at their ends.
3. The Menu key has its own near opaque dark glass.
4. A lit Auto or Turbo key changes its fill, rim, glow and ink (ON and HOT).
5. Every key's hover is a veil and a brighter rim, 120 ms; the press sinks and darkens. States set CSS variables
   (`--rim`, `--hl`, `--lo`, `--ov`, `--glow`) so hover and press work on a lit key too.
6. The glass a step darker (HUD_GLASS).
7. The help menu has no tail: a plain panel over the bar (hudLayout `panelRect`, `PANEL_GAP`).

## Per-game words, glyph and mode

`HUD_CONFIG` in the same file: `featureName` (FAST LANE), `featureGlyph` (none, or a `FEATURE_GLYPHS` candidate; the old
road line path `featureIcon` is retired) and `topAnteKey` (ANTE_10: the mode that draws the hotter "on" state, the double rim; Manticore: SUPER_ANTE).
Every other HUD word is the game's own (controls.svelte.ts, `soc()` for social wording).

## What this game changed from Manticore's files

1. `ui/hudTheme.ts`: the Frost values, the NEW tokens, `HUD_CONFIG`.
2. `ui/hud/hudLayout.ts`: `portraitBoardBottoms` answers the board's five columns (game/layoutSpec.ts `boardRect`) in
   the plaque's place (no plaque, no frame art here); `PORTRAIT.plaqueShadowCss` is 0.
3. `ui/hud/HudFeature.svelte` is Manticore's `HudArmoury.svelte` under this game's name (its aria words and the top
   Ante key are this game's).
4. `ui/hud/hudState.ts`: the top Ante level is `HUD_CONFIG.topAnteKey`.
5. `ui/hud/hud.css`, `ui/hud/HudMenuPanel.svelte`, `ui/AutoplayModal.svelte`, `ui/BetAdjuster.svelte`,
   `ui/ChromeStyles.svelte` `.am-glass`: the NEW tokens in the places listed above.

## Where things live

- `ui/hud/hud.css` (via `HudStyles.svelte`): every HUD rule, in mock px, tokens only.
- `ui/hud/hudLayout.ts`: the planes (mock px scaled by the chrome's fit), the per-screen geometry, the glass outlines.
- `ui/hud/Hud*.svelte`: Spin, keys, feature button, steppers, readouts, glass, the help menu.
- `ui/Chrome{Landscape,Portrait,Phone}.svelte`: the three layouts. `ChromeStyles.svelte` `.am-glass`: the panel frame
  every HUD modal shares.
- `components/HudBeds.svelte`: the dark beds in the canvas under the HUD (the glass is pale ice over them).
