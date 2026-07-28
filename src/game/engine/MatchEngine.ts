import type { AbilityCard, AbilitySlot } from '@/types/game';
import type { AnimationId } from '@/game/sprites';
import { animationDurationMs } from '@/game/sprites';
import { MIN_SPLASH_CHARGE, splashTierFor, type SplashEvent, type SplashTier } from '@/game/vfx';
import { abilityAtLevel } from '@/data/cards';
import {
  ACCELERATION,
  ARENA,
  ARENA_MARGIN,
  BODY_RADIUS,
  CHARGING_SPEED_FACTOR,
  DAMAGE_SCALE,
  DRAG,
  OUT_OF_AIR_PENALTY,
  HIT_RADIUS,
  HIT_REACTION_S,
  KNOCKBACK_SPEED,
  MELEE_ARC,
  MELEE_RANGE,
  MOVE_SPEED,
  OXYGEN_DRAIN_PER_S,
  OXYGEN_REGEN_PER_S,
  PROJECTILE_SPEED,
  PULL_SPEED,
  ROUNDS_TOTAL,
  ROUNDS_TO_WIN,
  ROUND_BREAK_S,
  ROUND_GRACE_S,
  SUBMERGED_DAMAGE_FACTOR,
  SUBMERGED_SPEED,
  ULTIMATE_PER_DAMAGE,
  WINDED_RECOVERY,
} from './tuning';
import type {
  EngineSnapshot,
  FighterId,
  FighterState,
  Intent,
  Loadout,
  ProjectileState,
  SnapshotFighter,
} from './types';

/**
 * The match simulation (Block 3C).
 *
 * Framework-free and deterministic given its inputs, like `ArenaScene`: it is
 * driven by `step(dt, intents)` and answers with `snapshot()`. Nothing in here
 * knows about React, the DOM or Three.js, which is what makes it testable by
 * stepping it in a loop and reading the numbers back.
 *
 * The equipped deck (Block 3B) is the whole moveset. There is no hard-coded
 * "basic attack": what attack 1 does is whatever card sits in that slot, read
 * through `abilityAtLevel` so the damage a card advertises is the damage it
 * deals. Ability *tags* select behaviour — `Piercing` keeps a projectile alive
 * past its first hit, `Knockback` pushes, `Pull` drags, `Anti-dive` and
 * `Surfaces` reach submerged targets — so a new card is data, not code.
 */

export interface FighterConfig {
  id: FighterId;
  name: string;
  tag: string;
  colors: { primary: string; secondary: string };
  loadout: Loadout;
}

export interface MatchEngineOptions {
  self: FighterConfig;
  opponent: FighterConfig;
  durationMs: number;
}

/** How long the one-shot action animations hold, in seconds. */
const ACTION_S: Record<'attack' | 'kick', number> = {
  attack: animationDurationMs('attack') / 1000,
  kick: animationDurationMs('kick') / 1000,
};

/** Splashes are re-read every frame; keep only a short window. */
const SPLASH_WINDOW = 12;

const SLOTS: AbilitySlot[] = ['attack1', 'attack2', 'ultimate'];

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export class MatchEngine {
  private readonly options: MatchEngineOptions;
  private readonly fighters: Record<FighterId, FighterState>;
  private projectiles: ProjectileState[] = [];
  private splashes: SplashEvent[] = [];

  private elapsedS = 0;
  private roundIndex = 0;
  private score = { self: 0, opponent: 0 };
  private intermissionS = 0;
  private finished = false;
  private nextId = 1;
  /** Player-side totals for the result screen. Accumulated, never derived. */
  private stats = { damageDealt: 0, splashesLanded: 0, timeSubmergedMs: 0 };

  constructor(options: MatchEngineOptions) {
    this.options = options;
    // The player starts on the near side and the opponent on the far side.
    // Reversed, the opponent spawned *behind* the camera — which sits seven
    // units back along the player's facing — so every round opened with the
    // fight off-screen until you turned around.
    this.fighters = {
      self: this.makeFighter(options.self, 0.5, 0.22),
      opponent: this.makeFighter(options.opponent, 0.5, 0.76),
    };
    this.faceEachOther();
  }

  /* --- Setup ------------------------------------------------------------- */

  private makeFighter(config: FighterConfig, nx: number, nz: number): FighterState {
    return {
      ...config,
      x: nx * ARENA,
      z: nz * ARENA,
      vx: 0,
      vz: 0,
      facing: 0,
      health: 1,
      oxygen: 1,
      submerged: false,
      charge: 0,
      charging: false,
      ultimate: 0,
      cooldowns: { attack1: 0, attack2: 0, ultimate: 0 },
      actionS: 0,
      actionAnimation: null,
      hitS: 0,
      graceS: ROUND_GRACE_S,
      winded: false,
      prevAttack1: false,
      prevAttack2: false,
      prevUltimate: false,
    };
  }

  private faceEachOther(): void {
    const { self, opponent } = this.fighters;
    self.facing = Math.atan2(opponent.z - self.z, opponent.x - self.x);
    opponent.facing = Math.atan2(self.z - opponent.z, self.x - opponent.x);
  }

  /**
   * Resets both fighters for a new round. Ultimate charge deliberately carries
   * over: it is earned across the match, and wiping it would make the ultimate
   * slot worthless in a best-of-three that rarely reaches a full tank twice.
   */
  private startRound(): void {
    for (const [nx, nz, id] of [
      [0.5, 0.22, 'self'],
      [0.5, 0.76, 'opponent'],
    ] as const) {
      const fighter = this.fighters[id];
      fighter.x = nx * ARENA;
      fighter.z = nz * ARENA;
      fighter.vx = 0;
      fighter.vz = 0;
      fighter.health = 1;
      fighter.oxygen = 1;
      fighter.submerged = false;
      fighter.charge = 0;
      fighter.charging = false;
      fighter.hitS = 0;
      fighter.actionS = 0;
      fighter.actionAnimation = null;
      fighter.graceS = ROUND_GRACE_S;
      fighter.winded = false;
      fighter.cooldowns = { attack1: 0, attack2: 0, ultimate: 0 };
    }
    this.projectiles = [];
    this.faceEachOther();
  }

  /* --- Simulation -------------------------------------------------------- */

  /** Advances the match. `dt` is seconds; intents are one per fighter. */
  step(dt: number, intents: Record<FighterId, Intent>): void {
    if (this.finished) return;
    // A tab that was hidden or a slow frame must not teleport anyone through a
    // wall or skip a collision test.
    const delta = Math.min(dt, 1 / 20);

    if (this.intermissionS > 0) {
      this.intermissionS -= delta;
      if (this.intermissionS <= 0) {
        this.roundIndex += 1;
        this.startRound();
      }
      // Projectiles still fly during the break so the killing shot lands
      // visibly rather than vanishing at the moment it connects.
      this.stepProjectiles(delta);
      return;
    }

    this.elapsedS = Math.min(this.elapsedS + delta, this.options.durationMs / 1000);

    for (const id of ['self', 'opponent'] as const) {
      this.stepFighter(this.fighters[id], intents[id], delta);
    }
    this.separate();
    this.stepProjectiles(delta);
    this.resolveRound();
  }

  private stepFighter(fighter: FighterState, intent: Intent, dt: number): void {
    fighter.graceS = Math.max(0, fighter.graceS - dt);
    fighter.hitS = Math.max(0, fighter.hitS - dt);
    if (fighter.actionS > 0) {
      fighter.actionS = Math.max(0, fighter.actionS - dt);
      if (fighter.actionS === 0) fighter.actionAnimation = null;
    }
    for (const slot of SLOTS) {
      fighter.cooldowns[slot] = Math.max(0, fighter.cooldowns[slot] - dt);
    }

    fighter.facing = intent.facing;

    // --- Breath ------------------------------------------------------------
    // Diving is a decision with a clock on it: you surface when the lungs run
    // out whether you meant to or not, and you cannot go straight back down —
    // `winded` holds you up until you have actually caught your breath.
    if (fighter.winded && fighter.oxygen >= WINDED_RECOVERY) fighter.winded = false;
    fighter.submerged = intent.dive && !fighter.winded;

    if (fighter.submerged) {
      if (fighter.id === 'self') this.stats.timeSubmergedMs += dt * 1000;
      fighter.oxygen = Math.max(0, fighter.oxygen - dt * OXYGEN_DRAIN_PER_S);
      if (fighter.oxygen === 0) {
        // Charged once, on the way up, rather than per second: the cost of
        // overstaying should be a moment you feel, not a slow leak that a
        // player watching the health bar cannot attribute to anything.
        fighter.winded = true;
        fighter.submerged = false;
        fighter.health = Math.max(0, fighter.health - OUT_OF_AIR_PENALTY);
      }
    } else {
      fighter.oxygen = Math.min(1, fighter.oxygen + dt * OXYGEN_REGEN_PER_S);
    }

    // --- Movement ----------------------------------------------------------
    const length = Math.hypot(intent.moveX, intent.moveZ);
    const throttle = length > 1 ? 1 / length : 1;
    let speed = fighter.submerged ? SUBMERGED_SPEED : MOVE_SPEED;
    if (fighter.charging) speed *= CHARGING_SPEED_FACTOR;

    const targetVx = intent.moveX * throttle * speed;
    const targetVz = intent.moveZ * throttle * speed;
    // Accelerate toward the target then bleed off — the blend is what makes a
    // direction change read as water rather than as an instant snap.
    fighter.vx += (targetVx - fighter.vx) * Math.min(1, ACCELERATION * dt);
    fighter.vz += (targetVz - fighter.vz) * Math.min(1, ACCELERATION * dt);
    if (length === 0) {
      const decay = Math.max(0, 1 - DRAG * dt);
      fighter.vx *= decay;
      fighter.vz *= decay;
    }

    fighter.x = clamp(fighter.x + fighter.vx * dt, ARENA_MARGIN, ARENA - ARENA_MARGIN);
    fighter.z = clamp(fighter.z + fighter.vz * dt, ARENA_MARGIN, ARENA - ARENA_MARGIN);

    // --- Abilities ---------------------------------------------------------
    // Nothing fires from under water: the design rule is that water attacks
    // need the surface, and it is what makes diving a genuine trade.
    const canAct = !fighter.submerged;

    // Attack 1: hold to charge, release to fire. A card with no charge time
    // fires the moment it is pressed instead.
    const attack1 = abilityAtLevel(fighter.loadout.attack1);
    if (canAct && attack1.chargeS > 0) {
      if (intent.attack1 && fighter.cooldowns.attack1 === 0) {
        fighter.charging = true;
        fighter.charge = Math.min(1, fighter.charge + dt / attack1.chargeS);
      } else if (fighter.charging) {
        // Released (or interrupted): fire with whatever was banked.
        const charge = fighter.charge;
        fighter.charging = false;
        fighter.charge = 0;
        if (charge >= MIN_SPLASH_CHARGE) this.use(fighter, 'attack1', charge);
      }
    } else if (canAct && intent.attack1 && !fighter.prevAttack1) {
      this.use(fighter, 'attack1', 1);
    }
    if (!canAct || !intent.attack1) {
      fighter.charging = false;
      if (attack1.chargeS > 0) fighter.charge = Math.max(0, fighter.charge - dt * 3);
    }

    if (canAct && intent.attack2 && !fighter.prevAttack2) this.use(fighter, 'attack2', 1);
    if (canAct && intent.ultimate && !fighter.prevUltimate && fighter.ultimate >= 1) {
      this.use(fighter, 'ultimate', 1);
    }

    fighter.prevAttack1 = intent.attack1;
    fighter.prevAttack2 = intent.attack2;
    fighter.prevUltimate = intent.ultimate;

    // Passive ultimate fill. `cooldownS` on an ultimate card is how long the
    // tank takes to fill on its own, so a slower ultimate is the price of a
    // bigger one — the same trade every other slot makes.
    if (fighter.ultimate < 1) {
      const ultimate = abilityAtLevel(fighter.loadout.ultimate);
      fighter.ultimate = Math.min(1, fighter.ultimate + dt / Math.max(1, ultimate.cooldownS));
    }
  }

  /** Fires one slot. `power` scales damage — the released charge for attack 1. */
  private use(fighter: FighterState, slot: AbilitySlot, power: number): void {
    if (fighter.cooldowns[slot] > 0) return;
    const card = fighter.loadout[slot];
    const ability = abilityAtLevel(card);
    const tags = ability.tags;
    const has = (tag: string) => tags.includes(tag);

    fighter.cooldowns[slot] = slot === 'ultimate' ? 0 : ability.cooldownS;
    if (slot === 'ultimate') fighter.ultimate = 0;

    const animation: AnimationId = slot === 'attack2' ? 'kick' : 'attack';
    fighter.actionAnimation = animation;
    fighter.actionS = ACTION_S[animation === 'kick' ? 'kick' : 'attack'];

    const damage = ability.damage * DAMAGE_SCALE * power;
    const tier = splashTierFor(slot === 'ultimate' ? 1 : power);
    const hitsSubmerged = has('Anti-dive') || has('Surfaces') || has('Drowns') || has('Pull');
    const knockback = has('Knockback') || has('Launch') ? KNOCKBACK_SPEED : 0;
    const pull = has('Pull') || has('Grab');

    // Radial and arena-wide abilities land everywhere at once — they are the
    // reason ultimates read as ultimates — so they resolve immediately rather
    // than as a travelling shot.
    if (has('Radial') || has('Arena-wide') || has('Storm') || has('Zone')) {
      const radius = has('Arena-wide') || has('Storm') ? ARENA * 2 : ability.range;
      this.burst(fighter, radius, damage, { knockback, pull, hitsSubmerged, tier });
      return;
    }

    if (ability.range <= MELEE_RANGE) {
      this.melee(fighter, ability.range, damage, { knockback, pull, hitsSubmerged, tier });
      return;
    }

    this.projectiles.push({
      id: `p${this.nextId++}`,
      owner: fighter.id,
      // Spawned a body-radius ahead so it never starts inside its own owner.
      x: fighter.x + Math.cos(fighter.facing) * BODY_RADIUS,
      z: fighter.z + Math.sin(fighter.facing) * BODY_RADIUS,
      vx: Math.cos(fighter.facing) * PROJECTILE_SPEED,
      vz: Math.sin(fighter.facing) * PROJECTILE_SPEED,
      rangeLeft: ability.range,
      damage,
      piercing: has('Piercing'),
      homing: has('Homing'),
      hitsSubmerged,
      knockback,
      pull,
      tier,
      hits: [],
    });
  }

  private enemyOf(id: FighterId): FighterState {
    return this.fighters[id === 'self' ? 'opponent' : 'self'];
  }

  private melee(
    fighter: FighterState,
    range: number,
    damage: number,
    opts: { knockback: number; pull: boolean; hitsSubmerged: boolean; tier: SplashTier },
  ): void {
    const target = this.enemyOf(fighter.id);
    const dx = target.x - fighter.x;
    const dz = target.z - fighter.z;
    const distance = Math.hypot(dx, dz);
    // The splash plays wherever the swing lands, hit or miss — a whiffed kick
    // still throws water, and a silent miss reads as a broken button.
    const ax = fighter.x + Math.cos(fighter.facing) * Math.min(range, 1.6);
    const az = fighter.z + Math.sin(fighter.facing) * Math.min(range, 1.6);
    this.emitSplash(ax, az, opts.tier);

    if (distance > range + BODY_RADIUS) return;
    const angle = Math.abs(wrap(Math.atan2(dz, dx) - fighter.facing));
    if (angle > MELEE_ARC) return;
    this.damage(fighter, target, damage, opts);
  }

  private burst(
    fighter: FighterState,
    radius: number,
    damage: number,
    opts: { knockback: number; pull: boolean; hitsSubmerged: boolean; tier: SplashTier },
  ): void {
    this.emitSplash(fighter.x, fighter.z, opts.tier);
    const target = this.enemyOf(fighter.id);
    const distance = Math.hypot(target.x - fighter.x, target.z - fighter.z);
    if (distance > radius) return;
    this.damage(fighter, target, damage, opts);
    this.emitSplash(target.x, target.z, opts.tier);
  }

  private damage(
    source: FighterState,
    target: FighterState,
    amount: number,
    opts: { knockback: number; pull: boolean; hitsSubmerged: boolean },
  ): void {
    if (target.graceS > 0) return;
    if (target.submerged && !opts.hitsSubmerged) return;

    const scaled = target.submerged ? amount * SUBMERGED_DAMAGE_FACTOR : amount;
    target.health = Math.max(0, target.health - scaled);
    target.hitS = HIT_REACTION_S;
    // A hit interrupts a charge. Otherwise trading blows while holding a full
    // charge is strictly better than reacting.
    target.charging = false;
    target.charge = 0;

    if (opts.knockback > 0 || opts.pull) {
      const dx = target.x - source.x;
      const dz = target.z - source.z;
      const distance = Math.max(0.001, Math.hypot(dx, dz));
      const speed = opts.pull ? -PULL_SPEED : opts.knockback;
      target.vx += (dx / distance) * speed;
      target.vz += (dz / distance) * speed;
    }

    // Landing damage feeds the tank, so pressure is rewarded.
    source.ultimate = Math.min(1, source.ultimate + scaled * 100 * ULTIMATE_PER_DAMAGE);
    if (source.id === 'self') {
      this.stats.damageDealt += scaled * 100;
      this.stats.splashesLanded += 1;
    }
    // Abilities that drag their target up end the dive they were hiding in.
    if (opts.hitsSubmerged && target.submerged) target.oxygen = Math.min(target.oxygen, 0.35);
  }

  private stepProjectiles(dt: number): void {
    const alive: ProjectileState[] = [];

    for (const projectile of this.projectiles) {
      const target = this.enemyOf(projectile.owner);

      if (projectile.homing) {
        // Steer, don't snap: a shot that instantly points at its target cannot
        // be dodged, which is not the same thing as "cannot miss".
        const desired = Math.atan2(target.z - projectile.z, target.x - projectile.x);
        const current = Math.atan2(projectile.vz, projectile.vx);
        const turn = wrap(desired - current);
        const next = current + clamp(turn, -3 * dt, 3 * dt);
        projectile.vx = Math.cos(next) * PROJECTILE_SPEED;
        projectile.vz = Math.sin(next) * PROJECTILE_SPEED;
      }

      const stepX = projectile.vx * dt;
      const stepZ = projectile.vz * dt;
      projectile.x += stepX;
      projectile.z += stepZ;
      projectile.rangeLeft -= Math.hypot(stepX, stepZ);

      const owner = this.fighters[projectile.owner];
      const distance = Math.hypot(target.x - projectile.x, target.z - projectile.z);
      const canHit =
        !projectile.hits.includes(target.id) && (!target.submerged || projectile.hitsSubmerged);

      if (canHit && distance <= HIT_RADIUS) {
        this.damage(owner, target, projectile.damage, projectile);
        this.emitSplash(projectile.x, projectile.z, projectile.tier);
        projectile.hits.push(target.id);
        if (!projectile.piercing) continue;
      }

      const outOfBounds =
        projectile.x < 0 || projectile.x > ARENA || projectile.z < 0 || projectile.z > ARENA;
      if (projectile.rangeLeft <= 0 || outOfBounds) {
        // Spent shots still hit the water. A projectile that simply disappears
        // at maximum range makes the range limit invisible.
        this.emitSplash(
          clamp(projectile.x, 0, ARENA),
          clamp(projectile.z, 0, ARENA),
          Math.max(1, projectile.tier - 2) as SplashTier,
        );
        continue;
      }

      alive.push(projectile);
    }

    this.projectiles = alive;
  }

  /** Keeps two bodies from occupying the same water. */
  private separate(): void {
    const { self, opponent } = this.fighters;
    const dx = opponent.x - self.x;
    const dz = opponent.z - self.z;
    const distance = Math.hypot(dx, dz);
    const minimum = BODY_RADIUS * 2;
    if (distance >= minimum || distance === 0) return;
    const push = (minimum - distance) / 2;
    const nx = dx / distance;
    const nz = dz / distance;
    self.x = clamp(self.x - nx * push, ARENA_MARGIN, ARENA - ARENA_MARGIN);
    self.z = clamp(self.z - nz * push, ARENA_MARGIN, ARENA - ARENA_MARGIN);
    opponent.x = clamp(opponent.x + nx * push, ARENA_MARGIN, ARENA - ARENA_MARGIN);
    opponent.z = clamp(opponent.z + nz * push, ARENA_MARGIN, ARENA - ARENA_MARGIN);
  }

  private resolveRound(): void {
    const { self, opponent } = this.fighters;
    const selfDown = self.health <= 0;
    const opponentDown = opponent.health <= 0;
    const timeUp = this.elapsedS >= this.options.durationMs / 1000;

    if (!selfDown && !opponentDown && !timeUp) return;

    // Both down in the same tick, or time up: whoever has more health takes the
    // round, and an exact tie goes to nobody.
    if (selfDown && !opponentDown) this.score.opponent += 1;
    else if (opponentDown && !selfDown) this.score.self += 1;
    else if (timeUp && self.health !== opponent.health) {
      if (self.health > opponent.health) this.score.self += 1;
      else this.score.opponent += 1;
    }

    const decided =
      this.score.self >= ROUNDS_TO_WIN ||
      this.score.opponent >= ROUNDS_TO_WIN ||
      this.roundIndex + 1 >= ROUNDS_TOTAL ||
      timeUp;

    if (decided) {
      this.finished = true;
      return;
    }
    this.intermissionS = ROUND_BREAK_S;
  }

  private emitSplash(x: number, z: number, tier: SplashTier): void {
    this.splashes = [
      ...this.splashes,
      { id: this.nextId++, x: clamp(x / ARENA, 0, 1), y: clamp(z / ARENA, 0, 1), tier },
    ].slice(-SPLASH_WINDOW);
  }

  /* --- Reading ------------------------------------------------------------ */

  /**
   * Which sprite state a fighter is in.
   *
   * The priority order is the one the placeholder simulation established and
   * the engine keeps: a flinch overrides everything, then a one-shot action,
   * then the dive pose, then charging, then movement.
   */
  private animationFor(fighter: FighterState): AnimationId {
    if (fighter.hitS > 0) return 'hit';
    if (fighter.actionAnimation && fighter.actionS > 0) return fighter.actionAnimation;
    if (fighter.submerged) return 'dive';
    if (fighter.charging) return 'charge';
    return Math.hypot(fighter.vx, fighter.vz) > 0.6 ? 'swim' : 'idle';
  }

  private toSnapshot(fighter: FighterState): SnapshotFighter {
    return {
      id: fighter.id,
      name: fighter.name,
      tag: fighter.tag,
      x: fighter.x / ARENA,
      y: fighter.z / ARENA,
      facing: fighter.facing,
      animation: this.animationFor(fighter),
      submerged: fighter.submerged,
      health: fighter.health,
      oxygen: fighter.oxygen,
      charge: fighter.charge,
      ultimate: fighter.ultimate,
      colors: fighter.colors,
    };
  }

  snapshot(): EngineSnapshot {
    const { self, opponent } = this.fighters;
    return {
      fighters: [this.toSnapshot(self), this.toSnapshot(opponent)],
      projectiles: this.projectiles.map((p) => ({
        id: p.id,
        x: p.x / ARENA,
        y: p.z / ARENA,
      })),
      splashes: this.splashes,
      timeRemainingMs: Math.max(0, this.options.durationMs - this.elapsedS * 1000),
      round: { current: Math.min(this.roundIndex + 1, ROUNDS_TOTAL), total: ROUNDS_TOTAL },
      score: { ...this.score },
      intermission: this.intermissionS > 0,
      finished: this.finished,
      victory: this.score.self > this.score.opponent,
      stats: {
        damageDealt: Math.round(this.stats.damageDealt),
        splashesLanded: this.stats.splashesLanded,
        timeSubmergedMs: Math.round(this.stats.timeSubmergedMs),
      },
    };
  }

  /** Read-only access for the bot, which reasons in world units. */
  getFighter(id: FighterId): FighterState {
    return this.fighters[id];
  }

  /** The card in a slot, for HUD labels and cooldown readouts. */
  cardFor(id: FighterId, slot: AbilitySlot): AbilityCard {
    return this.fighters[id].loadout[slot];
  }

  cooldownFor(id: FighterId, slot: AbilitySlot): number {
    return this.fighters[id].cooldowns[slot];
  }
}

/** Wraps an angle to (-pi, pi]. */
function wrap(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value <= -Math.PI) value += Math.PI * 2;
  return value;
}
