/**
 * Shared types for Splash Royale.
 *
 * This file is the contract between blocks: it must stay free of logic and must
 * never import from app code. See ARCHITECTURE.md §4.
 */

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 */
/* -------------------------------------------------------------------------- */

export type ScreenId =
  | 'mainMenu'
  | 'modeSelect'
  | 'mapSelect'
  | 'match'
  | 'result'
  | 'shop'
  | 'collection'
  | 'cardDetail'
  | 'settings';

export type GameMode = 'localBots' | 'online' | 'privateRoom';

export type TransitionKind = 'fade' | 'slideForward' | 'slideBack' | 'scale';

/** Params accepted by each screen. Add an entry when adding a screen. */
export interface RouteParams {
  mainMenu: undefined;
  modeSelect: undefined;
  mapSelect: { mode: GameMode; roomCode?: string };
  match: { mode: GameMode; mapId: MapId; roomCode?: string };
  result: { mode: GameMode; mapId: MapId; outcome: MatchOutcome };
  shop: undefined;
  collection: undefined;
  cardDetail: { cardId: string };
  settings: undefined;
}

export type Route = {
  [K in ScreenId]: { screen: K; params: RouteParams[K] };
}[ScreenId];

/* -------------------------------------------------------------------------- */
/* Maps                                                                       */
/* -------------------------------------------------------------------------- */

export type MapId = 'municipalPool' | 'beach' | 'resortBeach';

/**
 * Palette for the pixel water renderer. Colours are ordered from the deepest
 * water to the brightest foam so the renderer can index them by depth band.
 * Shared with Block 2B (shader / tile generation) — keep it serialisable.
 */
export interface WaterPalette {
  /** 4 depth bands, deep → shallow. */
  depth: [string, string, string, string];
  /** Caustic net highlight. */
  caustic: string;
  /** Wave crest / foam line. */
  crest: string;
  /** Sparkle pixels on the surface. */
  sparkle: string;
  /** Colour of the surrounding deck / sand shown at the edges. */
  surround: string;
  /** Secondary surround colour used for the pixel edge pattern. */
  surroundShade: string;
}

export interface GameMap {
  id: MapId;
  name: string;
  tagline: string;
  /** Short description shown under the animated preview. */
  description: string;
  /** Arena size in world units (used by Block 3 physics). */
  size: { width: number; depth: number };
  palette: WaterPalette;
  /** Renderer hints for the water surface look. */
  surface: {
    /** Wave amplitude in logical pixels. */
    amplitude: number;
    /** Wavelength in logical pixels. */
    wavelength: number;
    /** Scroll speed multiplier. */
    speed: number;
    /** 0..1 density of sparkle pixels. */
    sparkleDensity: number;
    /** Lane pattern drawn on the floor (pool tiles vs. sand ripples). */
    floorPattern: 'poolTiles' | 'sandRipples' | 'reef';
  };
  /** Set false for maps that are visible but not yet playable. */
  unlocked: boolean;
}

/* -------------------------------------------------------------------------- */
/* Characters                                                                 */
/* -------------------------------------------------------------------------- */

export interface CharacterStats {
  health: number;
  speed: number;
  /** Damage of a fully charged basic attack. */
  power: number;
  /** Seconds of air available while submerged. */
  lungCapacity: number;
}

export interface Character {
  id: string;
  name: string;
  title: string;
  stats: CharacterStats;
  ultimate: { name: string; description: string };
  /** Two-colour identity used by placeholder art and nameplates. */
  colors: { primary: string; secondary: string };
}

/* -------------------------------------------------------------------------- */
/* Cards (placeholder shape — Block 4 owns the real economy)                   */
/* -------------------------------------------------------------------------- */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type CardKind = 'attack' | 'defense' | 'utility' | 'ultimate';

export interface AbilityCard {
  id: string;
  name: string;
  kind: CardKind;
  rarity: Rarity;
  /** Effect copy shown on the card face. */
  description: string;
  level: number;
  maxLevel: number;
  /** Copies owned toward the next level. */
  copies: number;
  copiesForNextLevel: number;
  /** True once the player has pulled it from a loot box. */
  owned: boolean;
}

export interface LootBox {
  id: string;
  name: string;
  description: string;
  costGold: number;
  cardCount: number;
  /** Rarity that is guaranteed to appear at least once. */
  guaranteed: Rarity;
  /** Accent colour token name used by the shop card. */
  accent: 'surf' | 'gold' | 'rarity-epic' | 'rarity-legendary';
}

/* -------------------------------------------------------------------------- */
/* HUD contract (Block 1 → Block 3)                                           */
/* -------------------------------------------------------------------------- */

export interface FighterHudState {
  name: string;
  /** 0..1 */
  health: number;
  /** 0..1 — only surfaced in the UI while `submerged` is true. */
  oxygen: number;
  submerged: boolean;
  /** 0..1 attack charge; 0 when not charging. */
  charge: number;
  /** 0..1 ultimate energy; 1 means ready. */
  ultimate: number;
  /** Rank badge / bot label shown on the nameplate. */
  tag: string;
}

export interface MinimapEntity {
  id: string;
  /** Normalised arena coordinates, 0..1. */
  x: number;
  y: number;
  kind: 'self' | 'opponent' | 'projectile';
  submerged?: boolean;
}

export interface HudState {
  self: FighterHudState;
  opponent: FighterHudState;
  timeRemainingMs: number;
  round: { current: number; total: number };
  entities: MinimapEntity[];
}

/* -------------------------------------------------------------------------- */
/* Match result                                                               */
/* -------------------------------------------------------------------------- */

export interface MatchOutcome {
  victory: boolean;
  /** Rounds won by each side. */
  score: { self: number; opponent: number };
  durationMs: number;
  goldEarned: number;
  xpEarned: number;
  /** XP progress toward the next level, after the match. */
  levelBefore: number;
  levelAfter: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  stats: { damageDealt: number; splashesLanded: number; timeSubmergedMs: number };
  /** Ranked delta; null in unranked modes. */
  eloDelta: number | null;
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  scanlines: boolean;
  showMinimap: boolean;
  /** Mirrors touch controls on the opposite side for left-handed players. */
  leftHandedControls: boolean;
  playerName: string;
}
