# HUD theme (round 5, "Drop 6")

The HUD's look is one theme block: `ui/hudTheme.ts`. It injects every token as a `--hud-<name>` CSS custom property on
`:root`, so the HUD planes, the SKIP layer and the modals all read it. No HUD component hard-codes a colour.
Colours used at many strengths are `r, g, b` triplets (`rgba(var(--hud-accent-rgb), .55)`); the rest are plain values.

## Tokens (by role)

| Token | Role |
| --- | --- |
| `font`, `font-title` | HUD face (Outfit Black), the Autoplay title face (Cinzel) |
| `ink-rgb` | numbers, icons, button words |
| `label-rgb`, `label-warm-rgb` | the small spaced words (BALANCE, key words); the warmer ones (WIN, portrait) |
| `shadow-rgb` | text and drop shadows |
| `accent-rgb`, `accent-hi-rgb` | the gold: bottom edges, rims, chosen states, slider fill, Turbo bars |
| `accent-ink-rgb`, `accent-cream-rgb`, `accent-deep-rgb` | lit WIN / Ante amount, the palest gold, the dark end of a gold gradient |
| `glass-top-rgb`, `glass-mid-rgb`, `glass-bottom-rgb` + `glass-*-a` | the dock's fill gradient and its alphas |
| `panel-*-a` | the menu panels' fill alphas (same colours, near opaque) |
| `key-rgb` | a key's own glass (round keys, steppers, chips) |
| `edge-top-rgb`/`-a`, `edge-bottom-rgb`/`-a`, `spec-a` | the 1 px gradient edge (top, bottom) and the specular line |
| `spin-core-rgb`, `spin-deep-rgb`, `spin-rim-top/side/bottom` | the Spin hero (also LOAD and the skip prompt's Yes) |
| `feature-rgb`, `feature-hi-rgb`, `feature-deep-1/2-rgb`, `feature-rim-rgb`, `feature-ink` | the feature button (ember) |
| `feature-on-deep-1/2-rgb`, `feature-on-rim` | the feature button with a mode on (Ante, Super Ante, an armed buy): gold |
| `disabled-a`, `locked-a` | a disabled key's opacity, a locked amount's opacity |
| `dim` | the dimmed scene behind a menu |
| `radius-panel`, `radius-chip` | panel and chip corners |

## Per-game words and glyph

`HUD_CONFIG` in the same file: `featureName` (the feature button's word, ARMOURY) and `featureIcon` (its 24 x 24 line
path). Every other HUD word is the game's own (controls.svelte.ts, `soc()` for social wording).

## What a new game changes

1. `HUD_THEME`: the accent (gold) set, the feature (ember) set and its "on" set, the glass tints if the scene is
   lighter or darker. Edges, Spin and panels follow from the same tokens.
2. `HUD_CONFIG`: the feature button's word and icon path.
3. Nothing else for the look. Placement is `ui/hud/hudLayout.ts` (the mockup's numbers): a game with a different board
   or creature placement re-measures there, never in a component.

## Where things live

- `ui/hud/hud.css` (via `HudStyles.svelte`): every HUD rule, in mock px, tokens only.
- `ui/hud/hudLayout.ts`: the planes (mock px scaled by the chrome's fit), the per-screen geometry, the glass outlines.
- `ui/hud/Hud*.svelte`: Spin, keys, feature button, steppers, readouts, glass, the help menu.
- `ui/Chrome{Landscape,Portrait,Phone}.svelte`: the three layouts. `ChromeStyles.svelte` `.am-glass`: the panel frame
  every HUD modal shares.
