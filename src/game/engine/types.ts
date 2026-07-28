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

export interface EngineSnapshot {
  fighters: SnapshotFighter[];
  projectiles: SnapshotProjectile[];
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
