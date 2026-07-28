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
rarity, pulled from **card packs** ("sobres") bought with **gold** earned in combat.

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
    packs.ts               Card pack definitions + pull rates (Block 4 extends)

  state/                   React context stores. One concern per file.
    NavigationContext.tsx  Screen stack, route params, transition phase
    SettingsContext.tsx    Audio/video/gameplay settings (localStorage)

  hooks/                   Reusable, framework-level hooks
    useAnimationFrame.ts   rAF loop with fps cap + pause on hidden tab
    useReducedMotion.ts    prefers-reduced-motion

  game/                    Engine-side code. Never imports from screens/.
    sprites/               Pixel rig, keyframed animations, atlas bake, playback

  components/
    ui/                    Design-system primitives. No game knowledge.
    packs/                 3D card pack + pull-rate table
    cards/                 The ability card itself (rarity presentation)
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

| Block                                 | Owns                                                   | Consumes                                                                               |
| ------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **1 — UI** (done)                     | `components/**`, `screens/**`, `state/**`, `index.css` | —                                                                                      |
| **2A — Character sprites** (done)     | `game/sprites/**`                                      | Character palettes from `data/characters.ts`; exposes a sprite-playback API.            |
| **2B — Water & reactive environment** (done) | `components/water/**`                           | Map palettes from `data/maps.ts`; actor positions from the arena.                        |
| **2C — Splash animations**            | `game/vfx/**`                                          | Charge value from Block 3, ripple API from 2B.                                         |
| **3 — Controls / physics / combat**   | `game/**`                                              | Renders into the `<MatchScreen />` slot and feeds `HudState`.                          |
| **4 — Cards, shop, packs**            | `features/progression/**`                              | `ShopScreen`/`PackPreviewScreen`/`CollectionScreen`, `data/cards.ts`, `data/packs.ts`. |
| **5 — Card detail & level-up**        | `screens/CardDetailScreen.tsx`                         | The `cardDetail` route and card types from Block 4.                                    |

### 4.1 The sprite contract (Block 2A → Block 3)

Fighters are animated through one narrow surface, `@/game/sprites`:

```ts
const frame = useSpriteAnimation({ animation: 'swim' }); // AnimationId
<SpriteView palette={{ primary, accent }} orientation="left" animation="swim" frame={frame} />;
```

Block 3 only decides *which* `AnimationId` a fighter is in each tick; timing,
frame advance and drawing are already handled. The seven states are `idle`,
`swim`, `charge`, `attack`, `kick`, `dive` and `hit`. `dive` does not loop — it
holds its final frame, which **is** the submerged pose, so "underwater" needs no
eighth state.

**Why no `public/sprites/**` PNGs.** The art is a *pixel rig*: plain-text part
matrices in `game/sprites/rig.ts` plus per-frame offset tables in
`animations.ts`, baked into a real sprite-sheet canvas at runtime and cached per
palette. Every character is a recolour of the same rig, so shipping PNGs would
mean one binary per character per recolour, none of it reviewable in a diff.
Two rules the rig depends on:

- Every row of a part must be the same width, and every offset a whole number of
  pixels. `validateRig()` checks the first and runs automatically in dev.
- `right` is `left` mirrored at bake time by reflecting pixels inside the cell —
  never a canvas `scale(-1, 1)`, which can land art off the pixel grid.

### 4.2 The water contract (Block 2B → Block 3)

The surface answers back through two entry points:

```ts
// Anything that moves: wake and dive/surface events are derived for you.
useWaterReactions(waterRef, actors); // actors are in *canvas* space, 0..1
// One-off impacts (2C splashes, a projectile landing).
waterRef.current?.spawnRipple(nx, ny, strength);
```

Two things to know before touching it:

- **Actor coordinates are canvas space, not arena space.** The fighter layer
  starts partway down the frame (`WATER_TOP` in `ArenaView`), so arena `y` has to
  be rebased before the water sees it, or wakes appear above the swimmers.
- **`strength` sets a ripple's size, not its visibility.** Radius, ring width and
  life scale with it; foam brightness deliberately barely does. Scaling foam by
  strength as well pushes weak ripples under the foam threshold, where they
  render as literally nothing.

Ripples are a **height field**, not decoration: `sampleRipples` returns a `lift`
that is added to the wave height (so depth bands and caustics bend around a
ripple) and a separate, sharper `foam` that places the visible crest. Thresholding
the deformation rather than stroking a circle is what keeps a ring from reading as
a drawn ellipse — it breaks up over waves and where two ripples cross.

Cost is bounded by rejecting pixels outside each ripple's bounding box before any
`sqrt`. Measured on a full 44k-pixel arena buffer: 16% of the 24fps frame budget
with no ripples, 22% with thirty live.

### 4.3 The HUD contract (Block 1 → Block 3)

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

### 4.4 The navigation contract

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
