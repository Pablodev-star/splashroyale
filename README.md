# Splash Royale

PvP pixel art aquatic combat. Characters are 2D sprites that always face the
camera inside a pseudo-3D pool. Charge your water attacks to extend their range,
speed and damage, dive to escape at the cost of your oxygen, and unlock
abilities as collectible cards pulled from card packs bought with gold.

The whole game is in **English** and ships as a **static build** (GitHub Pages);
the online layer lands later via Supabase Realtime.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

Requires Node 20.19+ or 22.12+.

## Before you write code

Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) (folder layout, module boundaries,
the contract each block hands to the next) and [`STYLEGUIDE.md`](./STYLEGUIDE.md)
(palette, pixel-art rules, motion vocabulary, component conventions). Both apply
to every contributor, human or AI, so PRs from different authors stay coherent.

## Block status

| Block                                     | Status                                                    |
| ----------------------------------------- | --------------------------------------------------------- |
| **1 — UI**                                | ✅ Done — menus, HUD, shop/collection shells, transitions |
| **2A — Character sprites**                | ⏳ Placeholder CSS billboards in `components/match/`      |
| **2B — Water & reactive environment**     | ⏳ Canvas2D water shipped; reactivity API stubbed         |
| **2C — Splash animations**                | ⏳ Charge tiers reserved in the HUD (5 notches)           |
| **3 — Controls, physics, combat**         | ⏳ Scripted `useMatchSimulation` stands in                |
| **4 — Cards, economy, packs**             | ⏳ Static data + pack shop & 3D preview                   |
| **5 — Card detail & level-up**            | ⏳ Route + layout skeleton                                |
| **6+ — Supabase matchmaking, ranking, …** | 🔜                                                        |

Everything a later block must replace is tagged with a
`// PLACEHOLDER(Block N):` comment — `grep -rn "PLACEHOLDER(Block" src` lists the
full work queue.

## What Block 1 ships

- **Main menu** over an animated pixel water background (waves, caustics,
  sparkles, ambient ripples), logo, level/gold/ELO chrome.
- **Mode select**: Local vs Bots, Competitive Online, Private Room with room-code
  hosting and joining.
- **Map select** with a live animated preview of each map (Municipal Pool, Beach,
  Resort Beach), each with its own palette and surface behaviour.
- **In-match HUD**: health, oxygen (only while submerged), charge meter with the
  five splash tiers marked, ultimate energy tank, minimap, round clock, pause
  overlay, and a touch control layer for phones.
- **Result screen** with counted-up gold/XP, rating delta and match summary.
- **Card pack shop** with a 3D pack preview (rotating wrapper, front and back
  faces, tier-scaled effects, pull-rate table) and a **card collection** where
  rarity drives the presentation — wired to the routes Block 4
  and Block 5 will fill in.
- **Settings** (name, volumes, scanlines, screen shake, minimap, left-handed
  controls) persisted to `localStorage`.

Keyboard in a match: hold `Space` to charge, `S` to dive/surface, `Esc` to pause.

## Controls & accessibility notes

- Every control is a real button/input with a visible focus ring.
- Bars expose `role="meter"` with live values.
- `prefers-reduced-motion` freezes the water canvases on a single frame and skips
  screen transitions.
