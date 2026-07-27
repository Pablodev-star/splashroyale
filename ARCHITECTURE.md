# Splash Royale — Architecture

> Read this file **before generating code** for any block. It defines the folder
> layout, the module boundaries, and the contracts between blocks so that PRs
> written by different authors (human or AI) stay consistent.

## 1. Product in one paragraph

Splash Royale is a PvP pixel art combat game. Characters are 2D sprites that
always face the camera ("billboard sprites") inside a pseudo-3D aquatic space
(pool / beach). Combat revolves around **chargeable water attacks**, a
**kick** that launches water, and **defensive submersion** limited by an
**oxygen bar**. Progression is delivered as **ability cards** of varying
rarity, obtained from **loot boxes** bought with **gold** earned in combat.

## 2. Stack

| Concern                                        | Choice                                                                                                                  | Notes                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| App shell / UI                                 | **React 19 + TypeScript**                                                                                               | All menus, HUD, shop, collection.                                                        |
| Styling                                        | **Tailwind CSS v4** (`@theme` tokens in `src/index.css`)                                                                | No CSS-in-JS. No `<form>` tags anywhere.                                                 |
| Build                                          | **Vite**                                                                                                                | `base: './'` so the static build works under the GitHub Pages sub-path.                  |
| Rendering (menus, water backgrounds, previews) | **Canvas2D**, low-resolution offscreen buffer upscaled with `image-rendering: pixelated`                                | See `src/components/water/`.                                                             |
| Rendering (match scene)                        | **Three.js** with billboard sprites — decided in Block 3                                                                | Not yet installed; Block 3 adds the dependency.                                          |
| Online / backend                               | **Supabase** (Realtime channels + presence for matchmaking and rooms, Postgres for accounts, gold, inventory, missions) | GitHub Pages cannot host WebSockets, so the client talks to Supabase directly. Block 6+. |
| Hosting                                        | **GitHub Pages** (100% static)                                                                                          |                                                                                          |

### 2.1 Why Canvas2D for the water background and Three.js for the match

The animated menu backgrounds and map previews are cheap, palette-driven pixel
effects that need no depth, no lighting, and no camera. A ~200×112 `ImageData`
buffer upscaled by CSS is far cheaper than booting a WebGL context on every
menu screen (and it degrades gracefully on low-end mobile).

The match scene needs depth sorting, a camera, and billboard sprites, so it
gets Three.js. The two renderers never share a canvas; the water **palettes**
(`src/data/maps.ts`) are shared data so both look identical.

## 3. Folder layout

```
src/
  main.tsx                 App entry; mounts <App />
  App.tsx                  Providers + <ScreenRouter />
  index.css                Tailwind import, @theme tokens, keyframes, @utility

  types/                   Shared types only. No logic, no imports from app code.
    game.ts                ScreenId, GameMode, MapId, Rarity, HudState, ...

  data/                    Static, serialisable placeholder data ("the game DB")
    maps.ts                Map definitions + water palettes
    characters.ts          Placeholder roster
    cards.ts               Placeholder ability cards (Block 4/5 extend)
    lootBoxes.ts           Placeholder box definitions (Block 4 extends)

  state/                   React context stores. One concern per file.
    NavigationContext.tsx  Screen stack, route params, transition phase
    SettingsContext.tsx    Audio/video/gameplay settings (localStorage)

  hooks/                   Reusable, framework-level hooks
    useAnimationFrame.ts   rAF loop with fps cap + pause on hidden tab
    useReducedMotion.ts    prefers-reduced-motion

  components/
    ui/                    Design-system primitives. No game knowledge.
    water/                 Pixel water renderer (reused by Block 2B)
    brand/                 Logo / wordmark
    hud/                   In-match HUD widgets (pure, prop-driven)

  screens/                 One file per screen. Composes ui/ + hud/.
```

### Rules

1. **`components/ui/` knows nothing about the game.** It takes props, emits
   callbacks. If a primitive needs to import from `data/`, it belongs in a
   screen or a feature folder instead.
2. **`screens/` never contains simulation logic.** Block 1 ships a clearly
   labelled `useMatchSimulation` placeholder; Block 3 deletes it and feeds the
   HUD from the real match engine.
3. **`data/` is placeholder-shaped but final-typed.** Later blocks replace the
   contents (or fetch from Supabase) without touching the types.
4. **No `<form>` elements.** Inputs are controlled components with explicit
   button handlers. (Requirement from the design doc.)
5. **Absolute imports** via the `@/` alias (`@/components/ui/PixelButton`).

## 4. Block contracts

Each block owns a slice of the tree and consumes the previous block through a
narrow, typed interface.

| Block                                 | Owns                                                   | Consumes                                                                            |
| ------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| **1 — UI** (this PR)                  | `components/**`, `screens/**`, `state/**`, `index.css` | —                                                                                   |
| **2A — Character sprites**            | `game/sprites/**`, `public/sprites/**`                 | Nothing from UI; exposes a sprite-playback API.                                     |
| **2B — Water & reactive environment** | `components/water/**` (extends), shaders               | Map palettes from `data/maps.ts`.                                                   |
| **2C — Splash animations**            | `game/vfx/**`                                          | Charge value from Block 3, ripple API from 2B.                                      |
| **3 — Controls / physics / combat**   | `game/**`                                              | Renders into the `<MatchScreen />` slot and feeds `HudState`.                       |
| **4 — Cards, shop, loot boxes**       | `features/progression/**`                              | `ShopScreen`/`CollectionScreen` placeholders, `data/cards.ts`, `data/lootBoxes.ts`. |
| **5 — Card detail & level-up**        | `screens/CardDetailScreen.tsx`                         | The `cardDetail` route and card types from Block 4.                                 |

### 4.1 The HUD contract (Block 1 → Block 3)

`HudState` in `src/types/game.ts` is the single hand-off point. Block 3 must
produce this object every frame; the HUD is otherwise pure and stateless:

```ts
interface HudState {
  self: FighterHudState; // health, oxygen, submerged, charge, ultimate
  opponent: FighterHudState;
  timeRemainingMs: number;
  round: { current: number; total: number };
  entities: MinimapEntity[]; // normalised 0..1 arena coordinates
}
```

### 4.2 The navigation contract

Screens never import each other. They call `useNavigation()`:

```ts
const { navigate, back } = useNavigation();
navigate('mapSelect', { mode: 'localBots' }); // push
back(); // pop
```

Route params are typed per screen in `types/game.ts` (`RouteParams`), so adding
a screen means adding one `ScreenId` + one params entry + one router case.

## 5. Naming conventions

- Components: `PascalCase.tsx`, one component per file, named export **and**
  default-free (`export function PixelButton()`), so imports stay greppable.
- Hooks: `useThing.ts`. Contexts: `ThingContext.tsx` exporting `ThingProvider`
  and `useThing`.
- Types: `PascalCase`. Unions of string literals over enums.
- Data ids: `camelCase` string literals (`'municipalPool'`, `'resortBeach'`).
- Placeholder code that a later block must delete is marked with a
  `// PLACEHOLDER(Block N):` comment so it is grep-able.

## 6. Performance budget

- Menu water canvas: **24 fps**, ≤ 200×112 logical pixels, one `ImageData`
  write per frame, paused when the tab is hidden or the canvas is offscreen.
- Map previews: same renderer at 128×72, at most three visible at once.
- Respect `prefers-reduced-motion`: render a single static frame instead of
  animating, and skip screen transitions.
- No layout-thrashing animations: transforms and opacity only.

## 7. Accessibility

- Every interactive element is a real `<button>` / `<input>` with a focus ring
  (`focus-visible`), reachable by keyboard.
- The HUD mirrors its bars with `role="meter"` + `aria-valuenow`.
- Colour is never the only signal: rarity, health state, and oxygen warnings
  also change label text or add an icon.
