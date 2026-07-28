import type { PackPull } from '@/game/progression/packRoll';

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
  | 'deckSelect'
  | 'matchmaking'
  | 'roomLobby'
  | 'match'
  | 'result'
  | 'shop'
  | 'packPreview'
  | 'packOpen'
  | 'collection'
  | 'cardDetail'
  | 'settings';

export type GameMode = 'localBots' | 'online' | 'privateRoom';

export type TransitionKind = 'fade' | 'slideForward' | 'slideBack' | 'scale';

/**
 * Where the deck screen goes once a deck is confirmed. `null` means it was
 * opened from the menu to edit decks, so there is no match waiting.
 */
export interface MatchTarget {
  mode: GameMode;
  mapId: MapId;
  roomCode?: string;
}

/** Params accepted by each screen. Add an entry when adding a screen. */
export interface RouteParams {
  mainMenu: undefined;
  modeSelect: undefined;
  mapSelect: { mode: GameMode; roomCode?: string };
  deckSelect: { next: MatchTarget | null };
  matchmaking: { mapId: MapId };
  roomLobby: { roomCode: string; isHost: boolean };
  match: { mode: GameMode; mapId: MapId; roomCode?: string };
  result: { mode: GameMode; mapId: MapId; outcome: MatchOutcome; roomCode?: string };
  shop: undefined;
  packPreview: { packId: string };
  /** Pulls arrive already applied — the ceremony only presents them. */
  packOpen: { packId: string; pulls: PackPull[]; goldFromDuplicates: number };
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
/* Cards as abilities, and the decks built from them (Block 3B)                */
/* -------------------------------------------------------------------------- */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/**
 * The three things a fighter can do, and therefore the three slots a deck has.
 *
 * A card **is** an ability, not a modifier: equipping `undertowKick` in
 * `attack2` means pressing the second attack performs that kick. Every rarity
 * has cards for every slot, so rarity buys spectacle and power, never access —
 * a deck may mix rarities freely or be all one rarity.
 */
export type AbilitySlot = 'attack1' | 'attack2' | 'ultimate';

/**
 * What an ability physically *does*, as data.
 *
 * Behaviour used to be inferred from the display tags: the engine looked for
 * the word `Radial` or `Zone` in the chip list and picked one of three shapes
 * — travelling shot, cone, or instant ring. Everything else was a
 * re-skin. Chlorine Cloud claimed to burn "whoever stays in it" and in fact
 * dealt its damage once, on cast, exactly like Swell; Depth Charge promised a
 * two-second fuse and detonated immediately. Twenty-four cards, three
 * behaviours, and text that described things the engine could not do.
 *
 * Each variant below is a distinct shape the engine implements outright, and
 * the tags go back to being what they always should have been: labels. A card
 * that lingers has `kind: 'zone'` and genuinely lingers.
 */
export type AbilityEffect =
  /** A shot that travels. */
  | {
      kind: 'projectile';
      /** Fired at once, fanned evenly across `spreadDeg`. */
      shots?: number;
      spreadDeg?: number;
      /** Survives its first hit and keeps going. */
      pierce?: boolean;
      /** Steers toward the enemy — steers, so it can still be outrun. */
      homing?: boolean;
      /** Skims off the surface this many times, able to hit again after each. */
      bounces?: number;
      /** m/s. Defaults to the standard projectile speed. */
      speed?: number;
      knockback?: number;
    }
  /** Resolves instantly in a cone in front of the user. No travel time. */
  | {
      kind: 'melee';
      arcDeg?: number;
      knockback?: number;
      /** Drags the target toward the user at this m/s. */
      pull?: number;
      hitsSubmerged?: boolean;
    }
  /** Resolves instantly in a ring centred on the user. */
  | { kind: 'burst'; knockback?: number; hitsSubmerged?: boolean }
  /**
   * A patch of water that stays on the arena floor and works on whoever is
   * standing in it, every tick, until it expires.
   */
  | {
      kind: 'zone';
      /** Drives both the look and the secondary behaviour. */
      flavour: 'poison' | 'chlorine' | 'whirlpool';
      durationS: number;
      /** Health per second on the 0..100 card scale, applied continuously. */
      dps: number;
      /** Drags anyone inside toward the centre at this m/s. */
      pullSpeed?: number;
      /** Multiplies movement speed inside, 0..1. */
      slow?: number;
      /** Drops at the user's feet rather than at the end of their aim. */
      atSelf?: boolean;
      hitsSubmerged?: boolean;
    }
  /**
   * A wall of water crossing the arena. Diving is the counter: it passes
   * overhead, which is what makes a huge unavoidable-looking attack fair.
   */
  | {
      kind: 'wave';
      speed: number;
      /** Half-width of the wall, in metres either side of its centre line. */
      width: number;
      /** m/s the wave shoves whoever it catches, along its travel direction. */
      carrySpeed: number;
      /** Metres it covers before dissipating. */
      travel: number;
    }
  /** A sustained beam that keeps hitting for as long as it lasts. */
  | { kind: 'beam'; durationS: number; tickS: number; width: number }
  /** A charge that sinks, waits out a fuse, then detonates. */
  | {
      kind: 'mine';
      fuseS: number;
      radius: number;
      hitsSubmerged?: boolean;
      /** Extra damage multiplier against a submerged target. */
      submergedBonus?: number;
    }
  /** Several eruptions across the arena, each telegraphed before it fires. */
  | { kind: 'geysers'; count: number; radius: number; warnS: number; knockback?: number }
  /** Seizes the nearest fighter and holds them still. */
  | {
      kind: 'grab';
      holdS: number;
      flavour: 'tentacle' | 'spout' | 'riptide';
      /** Reels them in to the user instead of pinning them where they stand. */
      pullToSelf?: boolean;
      /** Holds them under: they cannot surface, and the lungs keep draining. */
      drowns?: boolean;
    };

/**
 * A card as authored: what it does and what it costs, with no player state.
 *
 * Level, copies and ownership belong to the *player*, not the catalogue — two
 * accounts see the same definitions and different progress. `AbilityCard` below
 * is a definition resolved against one player's progress, and it is what every
 * screen and the combat engine consume.
 */
export interface CardDefinition {
  id: string;
  name: string;
  /** The only slot this card can be equipped in. */
  slot: AbilitySlot;
  rarity: Rarity;
  /** Effect copy shown on the card face. */
  description: string;
  /** How it feels to use. Shown on the detail screen, never on the card face. */
  flavour: string;
  /** Combat numbers. Block 3C reads these; the UI shows them on the card. */
  ability: {
    /** Damage of one full-power use, as a share of a fighter's health bar. */
    damage: number;
    /** Seconds before the ability can be used again. */
    cooldownS: number;
    /** Reach in arena units (the arena is 16 across). */
    range: number;
    /** Seconds to reach full charge. 0 for abilities that fire instantly. */
    chargeS: number;
    /** Short effect tags, shown as chips: 'Knockback', 'Piercing', … */
    tags: string[];
  };
  /** How it behaves in the arena. The engine dispatches on `effect.kind`. */
  effect: AbilityEffect;
  /** The one number that grows with level, shown on the detail screen. */
  stat: {
    label: string;
    /** Value at level 1. */
    base: number;
    /** Added per level above 1. */
    perLevel: number;
    unit: string;
    /**
     * Which `ability` field this stat *is*, when it is one of them.
     *
     * Without this the level curve and the combat numbers are two independent
     * copies of the same value, and they drift: a level-3 Water Jet would show
     * "Jet damage 18" on its detail page while its card face and every deck
     * total still said 14. `abilityAtLevel()` is the only reader.
     */
    drives?: 'damage' | 'range' | 'cooldownS' | 'chargeS';
  };
}

/** One player's progress on one card. Absent from the record means unowned. */
export interface CardProgress {
  level: number;
  /** Copies banked toward the next level. */
  copies: number;
}

/** A definition resolved against a player's progress — what the UI renders. */
export interface AbilityCard extends CardDefinition {
  level: number;
  maxLevel: number;
  copies: number;
  copiesForNextLevel: number;
  /** True once the player has pulled it from a pack. */
  owned: boolean;
}

/** Three cards, one per slot. Saved so a deck is picked once, not every match. */
export interface Deck {
  id: string;
  name: string;
  cards: Record<AbilitySlot, string>;
}

/* -------------------------------------------------------------------------- */
/* Card packs ("sobres")                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Presentation tier of a pack. Drives how much spectacle the 3D preview gets:
 * `standard` is clean and quiet, `mythic` is the full light-show.
 */
export type PackTier = 'standard' | 'premium' | 'elite' | 'mythic';

/** Per-card pull rates. Must sum to 100. */
export type RarityOdds = Record<Rarity, number>;

export interface Pack {
  id: string;
  name: string;
  /** One-line hook shown under the name. */
  tagline: string;
  description: string;
  costGold: number;
  cardCount: number;
  /** Rarity guaranteed to appear at least once. */
  guaranteed: Rarity;
  tier: PackTier;
  odds: RarityOdds;
  /** Wrapper art configuration for the 3D pack faces. */
  art: {
    /** Foil base colour of the wrapper. */
    base: string;
    /** Darker shade used for bands and the back face. */
    shade: string;
    /** Accent used for trim, emblem and highlights. */
    accent: string;
    /** Emblem glyph stamped on both faces. */
    emblem: string;
  };
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
  /** Gold actually paid, after the daily cap. */
  goldEarned: number;
  /** True when the daily cap clipped the payout, so the UI can say why. */
  goldCapped?: boolean;
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

/**
 * Which control surface to show in a match.
 *
 * `auto` asks the device (see `useInputMode`) and is right almost always. The
 * explicit values exist because "almost" is not "always": a tablet paired with
 * a keyboard case, or a desktop with a touch monitor, is a genuine judgement
 * call the player can make faster than any media query.
 */
export type ControlScheme = 'auto' | 'touch' | 'keyboard';

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  scanlines: boolean;
  showMinimap: boolean;
  /** Mirrors touch controls on the opposite side for left-handed players. */
  leftHandedControls: boolean;
  controlScheme: ControlScheme;
  playerName: string;
}
