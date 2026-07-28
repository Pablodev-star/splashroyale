import type { AbilityCard, AbilitySlot } from '@/types/game';
import type { AnimationId } from '@/game/sprites';
import type { SplashEvent } from '@/game/vfx';

/**
 * Engine types (Block 3C).
 *
 * The engine speaks metres and world angles; the hook converts to the
 * normalised 0..1 the scene and HUD already use. Nothing in here imports React.
 */

export type FighterId = 'self' | 'opponent';

/** What a fighter is trying to do this tick, in world space. */
export interface Intent {
  /** Desired movement direction. Magnitude 0..1 — length is the throttle. */
  moveX: number;
  moveZ: number;
  /** Where the fighter is looking, as `atan2(dz, dx)`. */
  facing: number;
  /** Held, not pressed: attack 1 charges while this is true and fires on release. */
  attack1: boolean;
  /** Edge-triggered inside the engine. */
  attack2: boolean;
  ultimate: boolean;
  /** Desired submerged state, not a toggle — the engine owns the actual state. */
  dive: boolean;
}

export const IDLE_INTENT: Intent = {
  moveX: 0,
  moveZ: 0,
  facing: 0,
  attack1: false,
  attack2: false,
  ultimate: false,
  dive: false,
};

/** The three equipped cards, resolved once at match start. */
export type Loadout = Record<AbilitySlot, AbilityCard>;

export interface FighterState {
  id: FighterId;
  name: string;
  tag: string;
  colors: { primary: string; secondary: string };
  loadout: Loadout;

  /** Metres, 0..ARENA on both axes. */
  x: number;
  z: number;
  vx: number;
  vz: number;
  facing: number;

  health: number;
  oxygen: number;
  submerged: boolean;
  /** 0..1 charge on attack 1; 0 when not charging. */
  charge: number;
  charging: boolean;
  ultimate: number;

  /** Seconds remaining per slot. */
  cooldowns: Record<AbilitySlot, number>;
  /** Seconds left of a one-shot action animation, and which one. */
  actionS: number;
  actionAnimation: AnimationId | null;
  /** Seconds left of the hit flinch. */
  hitS: number;
  /** Seconds of remaining spawn invulnerability. */
  graceS: number;
  /** Out of air: cannot dive again until oxygen recovers past the floor. */
  winded: boolean;
  /**
   * Seconds left of being held by a grab. While this is above zero the fighter
   * cannot move or act — it is the one genuine stun in the game, which is why
   * only the long-cooldown legendaries have it.
   */
  heldS: number;
  /** A grab that also drowns: held *and* pinned under, lungs still draining. */
  heldUnder: boolean;
  /** Movement multiplier from whatever zone they are standing in, 1 when free. */
  slowFactor: number;
  /** Previous-tick edge state, so a held button fires once. */
  prevAttack1: boolean;
  prevAttack2: boolean;
  prevUltimate: boolean;
}

export interface ProjectileState {
  id: string;
  owner: FighterId;
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Metres of travel left before it fizzles. */
  rangeLeft: number;
  damage: number;
  /** Keeps going after a hit. */
  piercing: boolean;
  /** Curves toward the nearest enemy each tick. */
  homing: boolean;
  /** Can hit submerged fighters. */
  hitsSubmerged: boolean;
  knockback: number;
  /** Pulls the target toward the owner instead of away. */
  pull: boolean;
  /** Splash tier played where it lands. */
  tier: 1 | 2 | 3 | 4 | 5;
  /** Ids already hit, so a piercing shot cannot hit one fighter twice. */
  hits: FighterId[];
  /**
   * Surface skips left. Each one re-arms the shot — `hits` is cleared — which
   * is what makes a bouncing shot able to catch the same fighter twice, once
   * per skim, and is the whole point of aiming at the water instead of at them.
   */
  bounces: number;
  /** Metres between skips, so the bounce reads as a rhythm rather than noise. */
  bounceEveryM: number;
  /** Metres since the last skip. */
  sinceBounceM: number;
}

/**
 * A lingering patch of water. Unlike a projectile it does not move and does not
 * expire on contact — it works on whoever is inside it, every tick, until its
 * clock runs out.
 */
export interface ZoneState {
  id: string;
  owner: FighterId;
  flavour: 'poison' | 'chlorine' | 'whirlpool';
  x: number;
  z: number;
  radius: number;
  /** Seconds left before it fades. */
  remainingS: number;
  /** Its full lifetime, so the renderer can fade it out proportionally. */
  totalS: number;
  /** Health per second, already on the engine's 0..1 scale. */
  dps: number;
  pullSpeed: number;
  /** Movement multiplier for anyone inside. */
  slow: number;
  hitsSubmerged: boolean;
}

/** A wall of water crossing the arena. Dive to let it pass overhead. */
export interface WaveState {
  id: string;
  owner: FighterId;
  /** Where it started. */
  originX: number;
  originZ: number;
  /** Unit direction of travel. */
  dirX: number;
  dirZ: number;
  /** Metres covered so far. */
  travelled: number;
  travel: number;
  speed: number;
  /** Half-width either side of the centre line. */
  width: number;
  damage: number;
  carrySpeed: number;
  /** Ids already caught, so one wave hits a fighter once. */
  hits: FighterId[];
}

/** A sustained beam anchored to its owner while it lasts. */
export interface BeamState {
  id: string;
  owner: FighterId;
  /** Locked at cast: the beam does not track once it is firing. */
  angle: number;
  length: number;
  width: number;
  remainingS: number;
  totalS: number;
  /** Seconds between damage applications. */
  tickS: number;
  sinceTickS: number;
  damagePerTick: number;
}

/** A charge sinking toward a fuse. */
export interface MineState {
  id: string;
  owner: FighterId;
  x: number;
  z: number;
  fuseS: number;
  totalFuseS: number;
  radius: number;
  damage: number;
  hitsSubmerged: boolean;
  submergedBonus: number;
}

/**
 * One eruption. It telegraphs first and fires second — the warning is the whole
 * design of the ability, since "you cannot dodge all of them, you can dodge
 * most of them" needs the player to see where they are.
 */
export interface GeyserState {
  id: string;
  owner: FighterId;
  x: number;
  z: number;
  radius: number;
  /** Seconds of warning left; it fires when this reaches zero. */
  warnS: number;
  totalWarnS: number;
  /** Seconds the visible column stays after firing. */
  eruptS: number;
  damage: number;
  knockback: number;
  fired: boolean;
}

/** One fighter as the rest of the app sees it: normalised, ready to render. */
export interface SnapshotFighter {
  id: FighterId;
  name: string;
  tag: string;
  /** Normalised arena position, 0..1. */
  x: number;
  y: number;
  facing: number;
  animation: AnimationId;
  submerged: boolean;
  health: number;
  oxygen: number;
  charge: number;
  ultimate: number;
  colors: { primary: string; secondary: string };
}

export interface SnapshotProjectile {
  id: string;
  x: number;
  y: number;
}

/**
 * The lingering effects, normalised for the renderer.
 *
 * Radii are normalised the same way positions are (divided by the arena), so a
 * consumer never needs to know the arena is sixteen metres across. `progress`
 * is 0 at birth and 1 at expiry — one number the renderer can fade, shrink or
 * pulse on without re-deriving it from two clocks.
 */
export interface SnapshotZone {
  id: string;
  flavour: 'poison' | 'chlorine' | 'whirlpool';
  x: number;
  y: number;
  radius: number;
  progress: number;
  mine: boolean;
}

export interface SnapshotWave {
  id: string;
  /** Centre of the crest right now. */
  x: number;
  y: number;
  /** Direction of travel, radians. */
  angle: number;
  /** Half-width, normalised. */
  width: number;
  progress: number;
  mine: boolean;
}

export interface SnapshotBeam {
  id: string;
  /** Where it starts — the owner's position. */
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
  progress: number;
  mine: boolean;
}

export interface SnapshotMine {
  id: string;
  x: number;
  y: number;
  radius: number;
  /** 0 just placed, 1 about to detonate. */
  progress: number;
  mine: boolean;
}

export interface SnapshotGeyser {
  id: string;
  x: number;
  y: number;
  radius: number;
  /** True once it has erupted; before that it is only a warning ring. */
  erupting: boolean;
  /** Warning fill 0..1 while arming, then eruption fade 0..1. */
  progress: number;
  mine: boolean;
}

export interface EngineSnapshot {
  fighters: SnapshotFighter[];
  projectiles: SnapshotProjectile[];
  zones: SnapshotZone[];
  waves: SnapshotWave[];
  beams: SnapshotBeam[];
  mines: SnapshotMine[];
  geysers: SnapshotGeyser[];
  /** Rolling window of recent splashes; `useSplashEvents` dedupes on `id`. */
  splashes: SplashEvent[];
  timeRemainingMs: number;
  round: { current: number; total: number };
  score: { self: number; opponent: number };
  /** True between a knockout and the next round starting. */
  intermission: boolean;
  /** Set once the match is decided. */
  finished: boolean;
  victory: boolean;
  /** Player-side totals, for the result screen. */
  stats: { damageDealt: number; splashesLanded: number; timeSubmergedMs: number };
}
