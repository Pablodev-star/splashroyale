import type { GameMap, MapId } from '@/types/game';

/**
 * Map definitions. The palettes here drive both the menu water canvas (Block 1)
 * and the in-match water surface (Block 2B) — keep them in sync by keeping them
 * here, not in components.
 */
export const MAPS: GameMap[] = [
  {
    id: 'municipalPool',
    name: 'Municipal Pool',
    tagline: 'Six lanes. One winner.',
    description:
      'Chlorinated blue tiles and hard edges. Shallow water means shorter dives, so oxygen runs out fast.',
    size: { width: 24, depth: 14 },
    palette: {
      depth: ['#0b3f66', '#12588c', '#1e86b8', '#4fc4dd'],
      caustic: '#93e9f2',
      crest: '#e8fbff',
      sparkle: '#ffffff',
      surround: '#7f8fa0',
      surroundShade: '#5c6a79',
    },
    surface: {
      amplitude: 2,
      wavelength: 26,
      speed: 0.9,
      sparkleDensity: 0.05,
      floorPattern: 'poolTiles',
    },
    unlocked: true,
  },
  {
    id: 'beach',
    name: 'Beach',
    tagline: 'Waves push, sand slows.',
    description:
      'Open shoreline with a rolling swell. Waves shove projectiles off course and the shallows expose divers.',
    size: { width: 30, depth: 18 },
    palette: {
      depth: ['#07314f', '#0f5f83', '#1a97a8', '#5fd6c4'],
      caustic: '#a9f2dd',
      crest: '#f4ffff',
      sparkle: '#fdffe8',
      surround: '#e8cf94',
      surroundShade: '#c9a45f',
    },
    surface: {
      amplitude: 4,
      wavelength: 34,
      speed: 1.25,
      sparkleDensity: 0.07,
      floorPattern: 'sandRipples',
    },
    unlocked: true,
  },
  {
    id: 'resortBeach',
    name: 'Resort Beach',
    tagline: 'Infinity edge, infinite pain.',
    description:
      'A private lagoon with deep pockets and coral shelves. Deep water rewards long dives and ambushes.',
    size: { width: 28, depth: 20 },
    palette: {
      depth: ['#04223d', '#0a4a78', '#1580b5', '#46bfe0'],
      caustic: '#8ee3ff',
      crest: '#eef9ff',
      sparkle: '#ffe9a8',
      surround: '#f2d9a0',
      surroundShade: '#b8791c',
    },
    surface: {
      amplitude: 3,
      wavelength: 30,
      speed: 1.05,
      sparkleDensity: 0.09,
      floorPattern: 'reef',
    },
    unlocked: true,
  },
];

export const MAP_BY_ID: Record<MapId, GameMap> = MAPS.reduce(
  (acc, map) => {
    acc[map.id] = map;
    return acc;
  },
  {} as Record<MapId, GameMap>,
);

/** Palette used by menu backgrounds that are not tied to a specific map. */
export const MENU_PALETTE = MAP_BY_ID.resortBeach.palette;
