# Splash Royale — Visual & Code Style Guide

> Read this file **before generating code** for any block. Everything here is
> already implemented as Tailwind v4 tokens and utilities in `src/index.css`;
> use the tokens, never raw hex values.

## 1. Language

**The entire game is in English.** UI labels, ability names, card effects,
mission text, tooltips, and in-game messages. No Spanish strings in shipped
code. Code comments are English too.

## 2. Palette

Aquatic blues and teals, whites for foam, gold reserved for _progression_
(currency, rarity, rewards). Gold never used for plain UI chrome.

| Token      | Hex       | Use                                       |
| ---------- | --------- | ----------------------------------------- |
| `abyss`    | `#04121f` | Page background, deepest water            |
| `deep`     | `#0a2540` | Panel background                          |
| `ocean`    | `#10466e` | Panel background (raised), inactive fills |
| `lagoon`   | `#1878a8` | Borders, mid water                        |
| `surf`     | `#34b6d8` | Primary accent, active borders            |
| `foam`     | `#9ef0f5` | Highlights, wave crests                   |
| `mist`     | `#e8fbff` | Body text on dark                         |
| `sand`     | `#f2d9a0` | Beach maps, secondary surfaces            |
| `gold`     | `#ffc247` | Currency, legendary, rewards              |
| `goldDeep` | `#b8791c` | Gold shading / 1px bevel under gold       |
| `hp`       | `#45e07a` | Health bar                                |
| `oxygen`   | `#4fd8ff` | Oxygen bar                                |
| `charge`   | `#ffd54a` | Attack charge bar                         |
| `danger`   | `#ff4d5e` | Damage, defeat, destructive actions       |

Rarity: `common #b8c6d1` · `rare #4fa8ff` · `epic #b463ff` · `legendary #ffb31f`.

Tailwind usage: `bg-deep`, `text-mist`, `border-lagoon`, `text-rarity-epic`.

## 3. Pixel-art rules (non-negotiable)

1. **No antialiasing, no soft shadows, no blur, no border-radius.** Everything
   is hard-edged. `border-radius: 0` is the default; do not reintroduce it.
2. **No CSS gradients for surfaces.** Use flat fills plus 1–2 px bevel lines
   (`.pixel-panel` does this) to fake depth.
3. **Borders are thick and chunky:** 3–4 px at 1× (`.pixel-border`), drawn with
   `box-shadow` steps so they scale as whole pixels.
4. **All raster art is upscaled by integer factors** and rendered with
   `image-rendering: pixelated`. Never scale a sprite by 1.5×.
5. **Particles are square pixels**, minimum 2×2 CSS px at 1×, no opacity
   gradients within a single particle — fade by swapping palette steps.
6. **Animate on a step timeline.** Use `animation-timing-function: steps(n)`
   for anything meant to read as sprite animation; reserve smooth easing for
   screen transitions and panel motion only.

## 4. Typography

- Token: `--font-pixel`. Currently a tight monospace stack; drop a real bitmap
  font (Silkscreen / Press Start 2P) into `public/fonts/` and point the token
  at it without touching components.
- Headings: uppercase, `tracking-[0.15em]`, chunky text shadow
  (`.text-pixel-shadow`).
- Body: sentence case, `tracking-[0.03em]`, minimum 12 px.
- Never use italic (bitmap fonts have no oblique).

## 5. Motion vocabulary

| Name      | Duration   | Curve                                          | Use                                |
| --------- | ---------- | ---------------------------------------------- | ---------------------------------- |
| `fade`    | 200 ms     | `ease-out`                                     | Overlays, HUD elements appearing   |
| `slide`   | 260 ms     | `cubic-bezier(.2,.8,.2,1)`                     | Forward/back screen navigation     |
| `scale`   | 220 ms     | `cubic-bezier(.2,1.3,.4,1)` (slight overshoot) | Modals, reward popups              |
| `bob`     | 2.4 s loop | `ease-in-out`                                  | Idle float on logo / cards         |
| `shimmer` | 1.6 s loop | `linear`                                       | Gold / legendary highlights        |
| `press`   | 90 ms      | `steps(2)`                                     | Button press (translate down 2 px) |

Screen transitions are two-phase: **exit (180 ms) → enter (260 ms)**, handled
centrally by `NavigationContext` + `ScreenTransition`. Screens must not animate
their own mount/unmount.

Hover/focus micro-animations: buttons lift 2 px and brighten their top bevel;
they never change size (that would break pixel alignment).

## 6. Layout & responsiveness

- The game targets a 16:9 stage but must be usable from 360 px wide to 4K.
- Use the `.stage` wrapper: it centres content, caps width at `1280px`, and
  keeps a safe-area inset on mobile.
- Menus use a single-column layout below `md`, two columns at `md+`.
- HUD is anchored to the viewport corners with `clamp()`-based sizing so it
  never overlaps the arena centre on short screens.
- Touch targets: minimum 44×44 px.

## 7. Component conventions

- Primitives live in `components/ui/`, take `className` last and merge it, and
  expose a `variant` prop instead of ad-hoc styling.
- Prop order: data → state → callbacks → `className`.
- Never pass Tailwind classes down as "theme" props; use `variant`.
- Every stateful widget accepts a controlled value plus `onChange`; no internal
  state that the parent can't read.
- Bars (`PixelBar`) are always segmented — the segment count is part of the
  pixel look and communicates quantity without numbers.

## 8. Copy tone

Short, punchy, slightly arcade. Uppercase for buttons and screen titles
(`PLAY`, `SELECT MAP`). Sentence case for descriptions. Numbers are formatted
with thin separators (`1 250`) — never locale-dependent commas.

## 9. Rarity presentation

Rarity is the loudest signal in the game. It escalates deliberately — if
everything glows, nothing does.

| Rarity    | Frame                                                | Art well                 | Effects                                           |
| --------- | ---------------------------------------------------- | ------------------------ | ------------------------------------------------- |
| Common    | Flat `rarity-common` border                          | Clean, no sheen          | None                                              |
| Rare      | Flat `rarity-rare` border                            | Faint holo sweep (30%)   | None                                              |
| Epic      | Flat `rarity-epic` border                            | Holo sweep (45%)         | Pulsing outer aura + 4 rising sparks              |
| Legendary | **Frame cycles the full spectrum** (`rainbow-frame`) | Rainbow holo sweep (75%) | Rainbow aura + 7 sparks + rainbow name and banner |

Rules:

1. The rainbow is driven by **discrete colour-stop keyframes**, never
   `filter: hue-rotate` — a filter would recolour the card art along with the
   frame and blur the pixel edges.
2. Glows live **outside** the element they belong to, on a wrapper. Putting a
   blurred aura inside a clipped card washes over its own text.
3. Sparks and particles stay square and hard-edged, minimum 3×3 px.

## 10. Card packs in 3D

Packs are real 3D objects, not images: a `preserve-3d` box with a distinct
front and back face plus side edges, levitating and rotating on Y.

- Faces stay **flat-filled with hard edges** so the pack still reads as pixel
  art while it turns. Only the foil sheen overlay uses a gradient.
- Spectacle scales with `PackTier`: `standard` gets nothing, `premium` adds
  sparks, `elite` adds rotating rays and orbiting shards, `mythic` adds the
  rainbow ray set and the strongest aura.
- A pack tile in the shop is the _same component_ at `size="tile"` — never a
  separate flat mock-up.
