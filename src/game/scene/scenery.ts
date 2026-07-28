import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
} from 'three';
import type { GameMap } from '@/types/game';

/**
 * What surrounds the arena (Block 5).
 *
 * Before this, every map was the same scene with a different palette: a 16×16
 * water plane on a flat coloured square, and a solid-colour sky. Municipal Pool
 * and Resort Beach were the same place in different colours, and the water
 * simply *stopped* at the arena edge with nothing to explain why.
 *
 * Three things this fixes, in order of how obvious they are:
 *
 * 1. **The water no longer ends in mid-air.** Every map gets a surround that
 *    reaches past the far clip: a tiled deck for the pool, an open sea for the
 *    beach, a lagoon shelf for the resort. The arena edge is now a *border* you
 *    can see — coping, wet sand, coral — rather than a cut.
 * 2. **Maps look like different places.** Lane ropes and starting blocks, or
 *    parasols on a shore, or palms over a jetty. All flat-shaded boxes and
 *    planes, so it still reads as pixel art from inside the match.
 * 3. **A sky with a horizon**, so looking up or spinning the camera shows
 *    somewhere rather than a void.
 *
 * Everything here is static: built once per map, never updated per frame. The
 * cost is a few dozen draw calls of untextured boxes, which is why it can be
 * this literal without touching the frame budget (ARCHITECTURE.md §6).
 */

/** Arena edge length in world units. Mirrors `ARENA_SIZE` in `ArenaScene`. */
const ARENA = 16;
/** How far the surround reaches. Well inside the camera's 200-unit far plane. */
const WORLD = 150;

export type SceneryKind = 'pool' | 'beach' | 'lagoon';

/** Which scenery a map gets. Derived from the floor pattern it already declares. */
export function sceneryKindFor(map: GameMap): SceneryKind {
  if (map.surface.floorPattern === 'poolTiles') return 'pool';
  return map.surface.floorPattern === 'reef' ? 'lagoon' : 'beach';
}

export interface Scenery {
  root: Group;
  /** Sky texture for `scene.background`. Owned here, disposed with the rest. */
  sky: Texture;
  dispose(): void;
}

/* -------------------------------------------------------------------------- */
/* Small builders                                                             */
/* -------------------------------------------------------------------------- */

function shade(hex: string, amount: number): string {
  const color = new Color(hex);
  if (amount >= 0) color.lerp(new Color('#ffffff'), amount);
  else color.lerp(new Color('#000000'), -amount);
  return `#${color.getHexString()}`;
}

/** Flat-shaded box. Everything solid in a map is one of these. */
function box(
  width: number,
  height: number,
  depth: number,
  color: string,
  x: number,
  y: number,
  z: number,
  rotationY = 0,
): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(width, height, depth),
    new MeshBasicMaterial({ color: new Color(color) }),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotationY;
  return mesh;
}

/** Ground-hugging quad, drawn face-up. */
function ground(
  width: number,
  depth: number,
  color: string,
  y: number,
  x = 0,
  z = 0,
  texture?: Texture,
): Mesh {
  const mesh = new Mesh(
    new PlaneGeometry(width, depth),
    new MeshBasicMaterial({
      color: texture ? new Color('#ffffff') : new Color(color),
      map: texture,
      side: DoubleSide,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

/**
 * Deterministic pseudo-random, so a map's decorations land in the same place
 * every time it loads. `Math.random` here would rearrange the furniture on
 * every rematch.
 */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100_000) / 100_000;
  };
}

/**
 * Vertical gradient sky.
 *
 * Gradient only, deliberately. The first version painted a hard horizon band
 * into it — but `scene.background` is screen-space and the world horizon is
 * not, so the band floated as a dark stripe above the beach instead of sitting
 * on it. The horizon belongs to the ground geometry, which reaches past the far
 * clip and meets the sky wherever the camera happens to put it.
 */
function skyTexture(top: string, bottom: string): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1, 64);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  return texture;
}

/** Checkerboard for pool decking and tiling. */
function tileTexture(a: string, b: string, cells: number, repeat: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = cells;
  canvas.height = cells;
  const context = canvas.getContext('2d');
  if (context) {
    for (let y = 0; y < cells; y += 1) {
      for (let x = 0; x < cells; x += 1) {
        context.fillStyle = (x + y) % 2 === 0 ? a : b;
        context.fillRect(x, y, 1, 1);
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // Nearest, always: a smoothed checkerboard is a grey blur at distance.
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = 1000; // RepeatWrapping
  texture.wrapT = 1000;
  texture.repeat.set(repeat, repeat);
  return texture;
}

/* -------------------------------------------------------------------------- */
/* Municipal Pool                                                             */
/* -------------------------------------------------------------------------- */

function buildPool(map: GameMap, root: Group, textures: Texture[]): Texture {
  const deckA = map.palette.surround;
  const deckB = map.palette.surroundShade;
  const coping = shade(deckA, 0.35);
  const half = ARENA / 2;

  // Tiled deck reaching to the horizon. Big repeat so tiles stay small.
  const deckTexture = tileTexture(deckA, deckB, 2, WORLD / 3);
  textures.push(deckTexture);
  root.add(ground(WORLD * 2, WORLD * 2, deckA, -0.08, 0, 0, deckTexture));

  // Coping: a raised kerb around the water. This is the "edge" the water used
  // to be missing — the pool now reads as inset into the deck.
  const rim = 1.1;
  const rimH = 0.42;
  for (const [w, d, x, z] of [
    [ARENA + rim * 2, rim, 0, -half - rim / 2],
    [ARENA + rim * 2, rim, 0, half + rim / 2],
    [rim, ARENA, -half - rim / 2, 0],
    [rim, ARENA, half + rim / 2, 0],
  ] as const) {
    // Sat *on* the waterline, half of the kerb was under the water plane and
    // the other half z-fought it. It now stands proud, so the pool reads as
    // inset into the deck rather than painted onto it.
    root.add(box(w, rimH, d, coping, x, rimH / 2, z));
    // Dark lip along the inner face.
    root.add(box(w, 0.08, d, shade(deckB, -0.45), x, rimH, z));
  }

  // Lane ropes: floats strung across the pool, the pool's loudest signature.
  const laneColors = ['#e8fbff', '#ff4d5e'];
  for (let lane = 1; lane <= 5; lane += 1) {
    const z = -half + (lane * ARENA) / 6;
    for (let i = 0; i < 22; i += 1) {
      const x = -half + 0.35 + (i * ARENA) / 22;
      root.add(box(0.5, 0.18, 0.18, laneColors[i % 2], x, 0.09, z));
    }
  }

  // Starting blocks along the near edge.
  for (let lane = 0; lane < 6; lane += 1) {
    const x = -half + ARENA / 12 + (lane * ARENA) / 6;
    const z = half + rim + 0.9;
    root.add(box(1.1, 0.75, 1.1, shade(deckA, 0.5), x, 0.37, z));
    root.add(box(1.2, 0.14, 1.2, '#ffc247', x, 0.78, z));
  }

  // Far wall and a lifeguard chair. Both on +z: that is the direction the
  // camera looks from the player's spawn, so anything at -z is behind the lens
  // and may as well not exist.
  root.add(box(ARENA + 14, 3.2, 0.8, shade(deckB, -0.2), 0, 1.6, half + 16));
  root.add(box(0.35, 3.4, 0.35, '#e8cf94', -half - 3.5, 1.7, half + 6));
  root.add(box(1.6, 1.0, 1.3, '#ff4d5e', -half - 3.5, 3.5, half + 6));

  return skyTexture('#5aaedd', '#cfeaf6');
}

/* -------------------------------------------------------------------------- */
/* Beach                                                                      */
/* -------------------------------------------------------------------------- */

function buildBeach(map: GameMap, root: Group): Texture {
  const sand = map.palette.surround;
  const wet = map.palette.surroundShade;
  const deep = map.palette.depth[0];
  const half = ARENA / 2;
  const random = makeRandom(0xbea6);

  // Open sea past the arena, so the surf carries on to the horizon instead of
  // stopping at an invisible wall.
  root.add(ground(WORLD * 2, WORLD * 2, deep, -0.12));

  // The shore: sand behind the player's side only, so the map has a direction.
  root.add(ground(WORLD, WORLD, sand, -0.05, 0, half + WORLD / 2 - 2));
  // Wet band at the waterline — the border between the two.
  root.add(ground(WORLD, 3.2, wet, -0.03, 0, half + 1.2));
  root.add(ground(WORLD, 0.5, map.palette.crest, -0.02, 0, half - 0.2));

  // Parasols and towels on the sand.
  for (let i = 0; i < 7; i += 1) {
    const x = -ARENA + random() * ARENA * 2;
    const z = half + 4 + random() * 14;
    const hue = ['#ff4d5e', '#ffc247', '#34b6d8', '#e8fbff'][Math.floor(random() * 4)];
    const spin = random() * 0.8;
    root.add(box(0.22, 2.6, 0.22, '#8a6a3a', x, 1.3, z));
    // Two stacked tiers rather than one slab: a single 0.24-thick box seen from
    // a camera barely above the water is a plank floating next to a pole.
    root.add(box(3.4, 0.3, 3.4, hue, x, 2.32, z, spin));
    root.add(box(2.1, 0.32, 2.1, shade(hue, 0.22), x, 2.62, z, spin));
    root.add(box(0.5, 0.3, 0.5, shade(hue, -0.2), x, 2.86, z, spin));
    root.add(box(2.2, 0.06, 1.3, shade(hue, 0.25), x + 2, 0.02, z + 1.4, random() * 1.2));
  }

  // Headland rocks on both flanks: they close the frame without boxing it in.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i += 1) {
      const size = 2 + random() * 3.5;
      root.add(
        box(
          size,
          size * 0.8,
          size,
          shade('#6d6a63', (random() - 0.5) * 0.3),
          side * (half + 6 + i * 4 + random() * 3),
          size * 0.2,
          -half - i * 5 + random() * 6,
          random() * 1.5,
        ),
      );
    }
  }

  return skyTexture('#2f8fd0', '#ffe3b8');
}

/* -------------------------------------------------------------------------- */
/* Resort Beach (lagoon)                                                      */
/* -------------------------------------------------------------------------- */

function buildLagoon(map: GameMap, root: Group): Texture {
  const sand = map.palette.surround;
  // Pale coral sand, not the palette's dark `surroundShade`: at full strength
  // that brown ringed the lagoon like a wooden deck surround.
  const shelf = shade(map.palette.surround, -0.12);
  const deep = map.palette.depth[0];
  const shallow = map.palette.depth[2];
  const half = ARENA / 2;
  const random = makeRandom(0x1a900);

  // Deep ocean, then a shallow reef shelf ringing the lagoon: the arena sits in
  // a bowl, and the colour step at its edge *is* the border.
  root.add(ground(WORLD * 2, WORLD * 2, deep, -0.14));
  root.add(ground(ARENA + 26, ARENA + 26, shallow, -0.1));
  root.add(ground(ARENA + 9, ARENA + 9, shelf, -0.06));

  // Coral heads breaking the surface around the rim.
  const coral = ['#ff7ba6', '#ffb347', '#8be0c8', '#c98bff'];
  for (let i = 0; i < 30; i += 1) {
    const angle = (i / 30) * Math.PI * 2 + random() * 0.25;
    const radius = half + 1.4 + random() * 5;
    // Small and squat. The first pass used sizes up to 1.6 with a 1.7x height
    // multiplier, which put chest-high cubes on the rim of a 16-unit arena and
    // read as scenery dropped in at the wrong scale.
    const size = 0.35 + random() * 0.55;
    const height = size * (0.6 + random() * 0.7);
    root.add(
      box(
        size,
        height,
        size,
        coral[Math.floor(random() * coral.length)],
        Math.cos(angle) * radius,
        height / 2 - 0.12,
        Math.sin(angle) * radius,
        random() * 1.5,
      ),
    );
  }

  // Sand bar and palms on one side.
  root.add(ground(WORLD, WORLD, sand, -0.02, 0, half + WORLD / 2 + 4));
  for (let i = 0; i < 6; i += 1) {
    const x = -ARENA + random() * ARENA * 2;
    const z = half + 8 + random() * 16;
    const height = 4 + random() * 2.5;
    root.add(box(0.4, height, 0.4, '#7a5230', x, height / 2, z));
    for (let frond = 0; frond < 5; frond += 1) {
      const angle = (frond / 5) * Math.PI * 2;
      root.add(
        box(
          2.8,
          0.18,
          0.9,
          shade('#2f8f4f', (random() - 0.5) * 0.3),
          x + Math.cos(angle) * 1.3,
          height - 0.2,
          z + Math.sin(angle) * 1.3,
          angle,
        ),
      );
    }
  }

  // A jetty running out over the water — the one straight line in a soft map.
  const jettyX = -half - 3.5;
  for (let i = 0; i < 9; i += 1) {
    const z = half + 6 - i * 2.1;
    root.add(box(2.6, 0.22, 1.7, '#a9713f', jettyX, 0.28, z));
    root.add(box(0.28, 1.2, 0.28, '#7a5230', jettyX - 1, -0.2, z));
    root.add(box(0.28, 1.2, 0.28, '#7a5230', jettyX + 1, -0.2, z));
  }

  // Loungers at the head of the jetty.
  for (let i = 0; i < 3; i += 1) {
    root.add(box(2.2, 0.18, 1.0, '#f4f1e6', jettyX + 4 + i * 2.6, 0.2, half + 6.5));
    root.add(box(0.9, 0.9, 1.0, '#f4f1e6', jettyX + 3.4 + i * 2.6, 0.6, half + 6.5, 0.35));
  }

  return skyTexture('#1a6fae', '#ffd0a8');
}

/* -------------------------------------------------------------------------- */

/**
 * Builds the surround for a map. Call once; `dispose()` releases every geometry,
 * material and texture it created.
 */
export function buildScenery(map: GameMap): Scenery {
  const root = new Group();
  const textures: Texture[] = [];

  const kind = sceneryKindFor(map);
  const sky =
    kind === 'pool'
      ? buildPool(map, root, textures)
      : kind === 'beach'
        ? buildBeach(map, root)
        : buildLagoon(map, root);
  textures.push(sky);

  // Scenery never occludes gameplay: it is all outside the arena or below the
  // water, and it is drawn first so the water and sprites sort over it.
  root.renderOrder = -1;
  root.traverse((object: Object3D) => {
    object.renderOrder = -1;
  });

  return {
    root,
    sky,
    dispose() {
      root.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
          else material.dispose();
        }
      });
      for (const texture of textures) texture.dispose();
    },
  };
}
