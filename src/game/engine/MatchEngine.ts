import type { AbilityCard, AbilityEffect, AbilitySlot } from '@/types/game';
import type { AnimationId } from '@/game/sprites';
import { animationDurationMs } from '@/game/sprites';
import { MIN_SPLASH_CHARGE, splashTierFor, type SplashEvent, type SplashTier } from '@/game/vfx';
import { abilityAtLevel } from '@/data/cards';
import {
  ACCELERATION,
  ARENA,
  ARENA_MARGIN,
  BODY_RADIUS,
  BOUNCE_INTERVAL_M,
  CHARGING_SPEED_FACTOR,
  DAMAGE_SCALE,
  DOT_TICK_S,
  DRAG,
  OUT_OF_AIR_PENALTY,
  HELD_SPEED,
  HIT_RADIUS,
  HIT_REACTION_S,
  MELEE_ARC,
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
  WAVE_HIT_GRACE_S,
  WINDED_RECOVERY,
  ZONE_BODY_MARGIN,
} from './tuning';
import type {
  BeamState,
  EngineSnapshot,
  FighterId,
  FighterState,
  GeyserState,
  Intent,
  Loadout,
  MineState,
  ProjectileState,
  SnapshotFighter,
  WaveState,
  ZoneState,
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
  private zones: ZoneState[] = [];
  private waves: WaveState[] = [];
  private beams: BeamState[] = [];
  private mines: MineState[] = [];
  private geysers: GeyserState[] = [];
  private splashes: SplashEvent[] = [];
  /** Seconds since each fighter last took damage-over-time, keyed by source. */
  private dotClocks = new Map<string, number>();
  /** Deterministic PRNG, so geyser placement is reproducible in tests. */
  private seed = 0x9e3779b9;

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
      heldS: 0,
      heldUnder: false,
      slowFactor: 1,
    };
  }

  /** xorshift32. Only used for geyser scatter; nothing balance-critical. */
  private random(): number {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 0xffffffff;
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
      fighter.heldS = 0;
      fighter.heldUnder = false;
      fighter.slowFactor = 1;
      fighter.cooldowns = { attack1: 0, attack2: 0, ultimate: 0 };
    }
    // Every lingering effect dies with the round. A poison cloud that outlived
    // the round that made it would tick against a fighter who had already
    // respawned somewhere else.
    this.projectiles = [];
    this.zones = [];
    this.waves = [];
    this.beams = [];
    this.mines = [];
    this.geysers = [];
    this.dotClocks.clear();
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
    // Lingering effects resolve after the fighters have moved, so standing in
    // a zone for a frame is what gets you hurt — not having been there when
    // the tick began.
    this.stepZones(delta);
    this.stepWaves(delta);
    this.stepBeams(delta);
    this.stepMines(delta);
    this.stepGeysers(delta);
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

    // --- Being held --------------------------------------------------------
    // A grab is the only thing in the game that takes control away, so it is
    // resolved before anything else reads the intent: while held, the intent
    // is simply not consulted. `heldUnder` additionally pins them below the
    // surface with the lungs still draining, which is what makes the
    // drowning legendaries frightening rather than merely long.
    if (fighter.heldS > 0) {
      fighter.heldS = Math.max(0, fighter.heldS - dt);
      fighter.vx *= HELD_SPEED;
      fighter.vz *= HELD_SPEED;
      if (fighter.heldUnder) {
        fighter.submerged = true;
        fighter.oxygen = Math.max(0, fighter.oxygen - dt * OXYGEN_DRAIN_PER_S * 2);
      }
      if (fighter.heldS === 0) fighter.heldUnder = false;
      // Cooldowns and the ultimate tank still tick — being held costs you the
      // window, not your progress.
      if (fighter.ultimate < 1) {
        const ultimate = abilityAtLevel(fighter.loadout.ultimate);
        fighter.ultimate = Math.min(1, fighter.ultimate + dt / Math.max(1, ultimate.cooldownS));
      }
      return;
    }

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
    // Set by whichever zone the fighter is standing in; reset every tick by
    // `stepZones`, so walking out restores full speed on the next frame.
    speed *= fighter.slowFactor;

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

  /**
   * Fires one slot. `power` scales damage — the released charge for attack 1.
   *
   * Dispatch is on `card.effect.kind`, which is authored data. It used to be a
   * search of the display tags for words like `Radial`, which meant the chips
   * shown on a card face were load-bearing: renaming a chip changed what the
   * ability did, and a chip the engine did not recognise silently did nothing.
   */
  private use(fighter: FighterState, slot: AbilitySlot, power: number): void {
    if (fighter.cooldowns[slot] > 0) return;
    const card = fighter.loadout[slot];
    const ability = abilityAtLevel(card);
    const effect = card.effect;

    fighter.cooldowns[slot] = slot === 'ultimate' ? 0 : ability.cooldownS;
    if (slot === 'ultimate') fighter.ultimate = 0;

    const animation: AnimationId = slot === 'attack2' ? 'kick' : 'attack';
    fighter.actionAnimation = animation;
    fighter.actionS = ACTION_S[animation === 'kick' ? 'kick' : 'attack'];

    const damage = ability.damage * DAMAGE_SCALE * power;
    const tier = splashTierFor(slot === 'ultimate' ? 1 : power);

    switch (effect.kind) {
      case 'projectile':
        this.fireProjectiles(fighter, effect, ability.range, damage, tier);
        return;

      case 'melee':
        this.melee(fighter, ability.range, damage, {
          knockback: effect.knockback ?? 0,
          pull: effect.pull ?? 0,
          hitsSubmerged: effect.hitsSubmerged ?? false,
          arc: effect.arcDeg ? (effect.arcDeg * Math.PI) / 360 : MELEE_ARC,
          tier,
        });
        return;

      case 'burst':
        this.burst(fighter, ability.range, damage, {
          knockback: effect.knockback ?? 0,
          hitsSubmerged: effect.hitsSubmerged ?? false,
          tier,
        });
        return;

      case 'zone':
        this.spawnZone(fighter, effect, ability.range, tier);
        return;

      case 'wave':
        this.spawnWave(fighter, effect, damage, tier);
        return;

      case 'beam':
        this.spawnBeam(fighter, effect, ability.range, damage);
        return;

      case 'mine':
        this.spawnMine(fighter, effect, ability.range, damage);
        return;

      case 'geysers':
        this.spawnGeysers(fighter, effect, damage);
        return;

      case 'grab':
        this.grab(fighter, effect, ability.range, damage, tier);
        return;
    }
  }

  /* --- Spawning ----------------------------------------------------------- */

  private fireProjectiles(
    fighter: FighterState,
    effect: Extract<AbilityEffect, { kind: 'projectile' }>,
    range: number,
    damage: number,
    tier: SplashTier,
  ): void {
    const shots = Math.max(1, effect.shots ?? 1);
    const spread = ((effect.spreadDeg ?? 0) * Math.PI) / 180;
    const speed = effect.speed ?? PROJECTILE_SPEED;

    for (let index = 0; index < shots; index += 1) {
      // Fan symmetrically about the aim: a single shot gets no offset, three
      // get -spread/2, 0, +spread/2.
      const offset = shots === 1 ? 0 : (index / (shots - 1) - 0.5) * spread;
      const angle = fighter.facing + offset;
      this.projectiles.push({
        id: `p${this.nextId++}`,
        owner: fighter.id,
        // Spawned a body-radius ahead so it never starts inside its own owner.
        x: fighter.x + Math.cos(angle) * BODY_RADIUS,
        z: fighter.z + Math.sin(angle) * BODY_RADIUS,
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        rangeLeft: range,
        // A volley splits its damage: three streams that each hit for the full
        // card number would make the epic strictly triple a common.
        damage: damage / shots,
        piercing: effect.pierce ?? false,
        homing: effect.homing ?? false,
        hitsSubmerged: false,
        knockback: effect.knockback ?? 0,
        pull: false,
        tier,
        hits: [],
        bounces: effect.bounces ?? 0,
        bounceEveryM: BOUNCE_INTERVAL_M,
        sinceBounceM: 0,
      });
    }
  }

  private spawnZone(
    fighter: FighterState,
    effect: Extract<AbilityEffect, { kind: 'zone' }>,
    range: number,
    tier: SplashTier,
  ): void {
    // Dropped at the caster's feet, or thrown out to the end of their aim.
    const distance = effect.atSelf ? 0 : range;
    const x = clamp(fighter.x + Math.cos(fighter.facing) * distance, 0, ARENA);
    const z = clamp(fighter.z + Math.sin(fighter.facing) * distance, 0, ARENA);

    this.zones.push({
      id: `z${this.nextId++}`,
      owner: fighter.id,
      flavour: effect.flavour,
      x,
      z,
      // The card's `range` is how far it is thrown; the puddle itself is sized
      // from the same number so a longer-ranged cloud is also a wider one.
      radius: Math.max(1.6, range * 0.55),
      remainingS: effect.durationS,
      totalS: effect.durationS,
      dps: effect.dps * DAMAGE_SCALE,
      pullSpeed: effect.pullSpeed ?? 0,
      slow: effect.slow ?? 1,
      hitsSubmerged: effect.hitsSubmerged ?? false,
    });
    this.emitSplash(x, z, tier);
  }

  private spawnWave(
    fighter: FighterState,
    effect: Extract<AbilityEffect, { kind: 'wave' }>,
    damage: number,
    tier: SplashTier,
  ): void {
    this.waves.push({
      id: `w${this.nextId++}`,
      owner: fighter.id,
      originX: fighter.x,
      originZ: fighter.z,
      dirX: Math.cos(fighter.facing),
      dirZ: Math.sin(fighter.facing),
      travelled: 0,
      travel: effect.travel,
      speed: effect.speed,
      width: effect.width,
      damage,
      carrySpeed: effect.carrySpeed,
      hits: [],
    });
    this.emitSplash(fighter.x, fighter.z, tier);
  }

  private spawnBeam(
    fighter: FighterState,
    effect: Extract<AbilityEffect, { kind: 'beam' }>,
    range: number,
    damage: number,
  ): void {
    // Damage is authored as the total over the whole beam, divided across its
    // ticks — otherwise a two-second beam ticking every 0.2s would deal ten
    // times its card number.
    const ticks = Math.max(1, Math.round(effect.durationS / effect.tickS));
    this.beams.push({
      id: `b${this.nextId++}`,
      owner: fighter.id,
      angle: fighter.facing,
      length: range,
      width: effect.width,
      remainingS: effect.durationS,
      totalS: effect.durationS,
      tickS: effect.tickS,
      sinceTickS: effect.tickS, // Fire on the first frame, not after a delay.
      damagePerTick: damage / ticks,
    });
  }

  private spawnMine(
    fighter: FighterState,
    effect: Extract<AbilityEffect, { kind: 'mine' }>,
    range: number,
    damage: number,
  ): void {
    const x = clamp(fighter.x + Math.cos(fighter.facing) * range, 0, ARENA);
    const z = clamp(fighter.z + Math.sin(fighter.facing) * range, 0, ARENA);
    this.mines.push({
      id: `m${this.nextId++}`,
      owner: fighter.id,
      x,
      z,
      fuseS: effect.fuseS,
      totalFuseS: effect.fuseS,
      radius: effect.radius,
      damage,
      hitsSubmerged: effect.hitsSubmerged ?? false,
      submergedBonus: effect.submergedBonus ?? 1,
    });
  }

  private spawnGeysers(
    fighter: FighterState,
    effect: Extract<AbilityEffect, { kind: 'geysers' }>,
    damage: number,
  ): void {
    const target = this.enemyOf(fighter.id);
    for (let index = 0; index < effect.count; index += 1) {
      // The first one is aimed at the enemy and the rest scatter: entirely
      // random placement made the ultimate a lottery, and all-aimed made it
      // undodgeable. One guaranteed threat plus noise is the intended "you
      // can dodge most of them".
      const aimed = index === 0;
      const x = aimed
        ? target.x
        : ARENA_MARGIN + this.random() * (ARENA - ARENA_MARGIN * 2);
      const z = aimed
        ? target.z
        : ARENA_MARGIN + this.random() * (ARENA - ARENA_MARGIN * 2);
      this.geysers.push({
        id: `g${this.nextId++}`,
        owner: fighter.id,
        x,
        z,
        radius: effect.radius,
        // Staggered so they erupt as a sequence you can run through rather
        // than one instant that either catches you or does not.
        warnS: effect.warnS + index * 0.28,
        totalWarnS: effect.warnS + index * 0.28,
        eruptS: 0.45,
        damage: damage / effect.count,
        knockback: effect.knockback ?? 0,
        fired: false,
      });
    }
  }

  private grab(
    fighter: FighterState,
    effect: Extract<AbilityEffect, { kind: 'grab' }>,
    range: number,
    damage: number,
    tier: SplashTier,
  ): void {
    const target = this.enemyOf(fighter.id);
    const dx = target.x - fighter.x;
    const dz = target.z - fighter.z;
    const distance = Math.hypot(dx, dz);
    this.emitSplash(target.x, target.z, tier);
    if (distance > range) return;

    // A grab reaches under water — being submerged is exactly what these are
    // the answer to.
    this.damage(fighter, target, damage, {
      knockback: 0,
      pull: false,
      hitsSubmerged: true,
    });
    if (target.health <= 0) return;

    target.heldS = effect.holdS;
    target.heldUnder = effect.drowns ?? false;
    if (effect.pullToSelf) {
      // Reeled to just outside body contact, not on top of the caster.
      const safe = Math.max(0.001, distance);
      const stop = BODY_RADIUS * 2.2;
      target.x = fighter.x + (dx / safe) * stop;
      target.z = fighter.z + (dz / safe) * stop;
      target.vx = 0;
      target.vz = 0;
    }
  }

  private enemyOf(id: FighterId): FighterState {
    return this.fighters[id === 'self' ? 'opponent' : 'self'];
  }

  private melee(
    fighter: FighterState,
    range: number,
    damage: number,
    opts: {
      knockback: number;
      pull: number;
      hitsSubmerged: boolean;
      arc: number;
      tier: SplashTier;
    },
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
    if (angle > opts.arc) return;
    this.damage(fighter, target, damage, {
      knockback: opts.knockback,
      pull: opts.pull > 0,
      pullSpeed: opts.pull,
      hitsSubmerged: opts.hitsSubmerged,
    });
  }

  private burst(
    fighter: FighterState,
    radius: number,
    damage: number,
    opts: { knockback: number; hitsSubmerged: boolean; tier: SplashTier },
  ): void {
    this.emitSplash(fighter.x, fighter.z, opts.tier);
    const target = this.enemyOf(fighter.id);
    const distance = Math.hypot(target.x - fighter.x, target.z - fighter.z);
    if (distance > radius) return;
    this.damage(fighter, target, damage, {
      knockback: opts.knockback,
      pull: false,
      hitsSubmerged: opts.hitsSubmerged,
    });
    this.emitSplash(target.x, target.z, opts.tier);
  }

  private damage(
    source: FighterState,
    target: FighterState,
    amount: number,
    opts: {
      knockback: number;
      pull: boolean;
      /** Overrides the default pull impulse; used by melee's `pull` metres/s. */
      pullSpeed?: number;
      hitsSubmerged: boolean;
      /** Damage-over-time: no flinch, no charge interrupt. See `stepZones`. */
      overTime?: boolean;
    },
  ): void {
    if (target.graceS > 0) return;
    if (target.submerged && !opts.hitsSubmerged) return;

    const scaled = target.submerged ? amount * SUBMERGED_DAMAGE_FACTOR : amount;
    target.health = Math.max(0, target.health - scaled);

    // Damage-over-time deliberately does neither of the next two things. A
    // poison cloud that re-triggered the flinch on every tick would freeze the
    // sprite in its hit pose for as long as you stood in it, and one that
    // wiped the charge every tick would make charging inside a cloud outright
    // impossible rather than merely a bad idea.
    if (!opts.overTime) {
      target.hitS = HIT_REACTION_S;
      // A hit interrupts a charge. Otherwise trading blows while holding a
      // full charge is strictly better than reacting.
      target.charging = false;
      target.charge = 0;
    }

    if (opts.knockback > 0 || opts.pull) {
      const dx = target.x - source.x;
      const dz = target.z - source.z;
      const distance = Math.max(0.001, Math.hypot(dx, dz));
      const speed = opts.pull ? -(opts.pullSpeed ?? PULL_SPEED) : opts.knockback;
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
      const stepped = Math.hypot(stepX, stepZ);
      projectile.rangeLeft -= stepped;

      // A skipping shot re-arms on each bounce off the surface: clearing the
      // hit list is what lets one shot catch the same fighter on two separate
      // skims, which is the reason to aim at the water instead of at them.
      if (projectile.bounces > 0) {
        projectile.sinceBounceM += stepped;
        if (projectile.sinceBounceM >= projectile.bounceEveryM) {
          projectile.sinceBounceM -= projectile.bounceEveryM;
          projectile.bounces -= 1;
          projectile.hits = [];
          this.emitSplash(projectile.x, projectile.z, 2);
        }
      }

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

  /* --- Lingering effects --------------------------------------------------- */

  /**
   * Applies damage-over-time on a fixed clock rather than per frame.
   *
   * Returns true when a tick was due. The key is per source *and* per target so
   * two overlapping clouds hurt independently, and so leaving and re-entering
   * one cloud does not reset another's timer.
   */
  private dotDue(key: string, dt: number): boolean {
    const elapsed = (this.dotClocks.get(key) ?? DOT_TICK_S) + dt;
    if (elapsed < DOT_TICK_S) {
      this.dotClocks.set(key, elapsed);
      return false;
    }
    this.dotClocks.set(key, elapsed - DOT_TICK_S);
    return true;
  }

  private stepZones(dt: number): void {
    // Cleared and re-applied every tick, so walking out of a cloud restores
    // full speed on the very next frame without any bookkeeping.
    for (const id of ['self', 'opponent'] as const) this.fighters[id].slowFactor = 1;

    const alive: ZoneState[] = [];
    for (const zone of this.zones) {
      zone.remainingS -= dt;
      if (zone.remainingS <= 0) {
        this.dotClocks.delete(`${zone.id}:self`);
        this.dotClocks.delete(`${zone.id}:opponent`);
        continue;
      }
      alive.push(zone);

      const target = this.enemyOf(zone.owner);
      const owner = this.fighters[zone.owner];
      const dx = target.x - zone.x;
      const dz = target.z - zone.z;
      const distance = Math.hypot(dx, dz);
      if (distance > zone.radius + ZONE_BODY_MARGIN) {
        this.dotClocks.delete(`${zone.id}:${target.id}`);
        continue;
      }
      if (target.submerged && !zone.hitsSubmerged) continue;

      if (zone.slow < 1) target.slowFactor = Math.min(target.slowFactor, zone.slow);

      // A whirlpool drags continuously rather than as an impulse: it is a
      // current, and a one-off shove would let a fighter simply out-accelerate
      // it on the next frame.
      if (zone.pullSpeed > 0 && distance > 0.05) {
        target.vx -= (dx / distance) * zone.pullSpeed * dt;
        target.vz -= (dz / distance) * zone.pullSpeed * dt;
      }

      if (zone.dps > 0 && this.dotDue(`${zone.id}:${target.id}`, dt)) {
        this.damage(owner, target, zone.dps * DOT_TICK_S, {
          knockback: 0,
          pull: false,
          hitsSubmerged: zone.hitsSubmerged,
          overTime: true,
        });
        this.emitSplash(target.x, target.z, 1);
      }
    }
    this.zones = alive;
  }

  private stepWaves(dt: number): void {
    const alive: WaveState[] = [];
    for (const wave of this.waves) {
      wave.travelled += wave.speed * dt;
      if (wave.travelled >= wave.travel) continue;
      alive.push(wave);

      const target = this.enemyOf(wave.owner);
      if (wave.hits.includes(target.id)) continue;
      // Diving is the counter. The wall passes overhead, which is what keeps
      // an arena-crossing attack fair rather than merely unavoidable.
      if (target.submerged) continue;

      // Distance along the wave's travel axis, and perpendicular to it.
      const rx = target.x - wave.originX;
      const rz = target.z - wave.originZ;
      const along = rx * wave.dirX + rz * wave.dirZ;
      const across = Math.abs(rx * -wave.dirZ + rz * wave.dirX);
      if (across > wave.width) continue;

      // The crest has thickness in time as well as space: without the grace
      // window a 12 m/s wall only connects on the frame its centre line is
      // within 20cm of you.
      const crestGap = Math.abs(along - wave.travelled);
      if (crestGap > wave.speed * WAVE_HIT_GRACE_S + BODY_RADIUS) continue;

      const owner = this.fighters[wave.owner];
      this.damage(owner, target, wave.damage, {
        knockback: 0,
        pull: false,
        hitsSubmerged: false,
      });
      // Carried along the wave's direction, not away from its caster: being
      // swept is the signature of the effect.
      target.vx += wave.dirX * wave.carrySpeed;
      target.vz += wave.dirZ * wave.carrySpeed;
      wave.hits.push(target.id);
      this.emitSplash(target.x, target.z, 4);
    }
    this.waves = alive;
  }

  private stepBeams(dt: number): void {
    const alive: BeamState[] = [];
    for (const beam of this.beams) {
      beam.remainingS -= dt;
      if (beam.remainingS <= 0) continue;
      alive.push(beam);

      beam.sinceTickS += dt;
      if (beam.sinceTickS < beam.tickS) continue;
      beam.sinceTickS -= beam.tickS;

      const owner = this.fighters[beam.owner];
      const target = this.enemyOf(beam.owner);
      if (target.submerged) continue;

      const rx = target.x - owner.x;
      const rz = target.z - owner.z;
      const along = rx * Math.cos(beam.angle) + rz * Math.sin(beam.angle);
      const across = Math.abs(rx * -Math.sin(beam.angle) + rz * Math.cos(beam.angle));
      if (along < 0 || along > beam.length || across > beam.width) continue;

      this.damage(owner, target, beam.damagePerTick, {
        knockback: 0,
        pull: false,
        hitsSubmerged: false,
        // Ticks fast enough that flinching on each would lock the sprite.
        overTime: true,
      });
      this.emitSplash(target.x, target.z, 2);
    }
    this.beams = alive;
  }

  private stepMines(dt: number): void {
    const alive: MineState[] = [];
    for (const mine of this.mines) {
      mine.fuseS -= dt;
      if (mine.fuseS > 0) {
        alive.push(mine);
        continue;
      }

      // Detonation.
      const owner = this.fighters[mine.owner];
      const target = this.enemyOf(mine.owner);
      const distance = Math.hypot(target.x - mine.x, target.z - mine.z);
      this.emitSplash(mine.x, mine.z, 4);
      if (distance > mine.radius) continue;
      if (target.submerged && !mine.hitsSubmerged) continue;

      // The anti-dive charge is the one thing in the game that hits *harder*
      // under water — otherwise diving would counter every delayed effect.
      const multiplier = target.submerged ? mine.submergedBonus : 1;
      this.damage(owner, target, mine.damage * multiplier, {
        knockback: 0,
        pull: false,
        hitsSubmerged: mine.hitsSubmerged,
      });
    }
    this.mines = alive;
  }

  private stepGeysers(dt: number): void {
    const alive: GeyserState[] = [];
    for (const geyser of this.geysers) {
      if (!geyser.fired) {
        geyser.warnS -= dt;
        if (geyser.warnS > 0) {
          alive.push(geyser);
          continue;
        }
        geyser.fired = true;
        this.emitSplash(geyser.x, geyser.z, 3);

        const owner = this.fighters[geyser.owner];
        const target = this.enemyOf(geyser.owner);
        const distance = Math.hypot(target.x - geyser.x, target.z - geyser.z);
        if (distance <= geyser.radius && !target.submerged) {
          this.damage(owner, target, geyser.damage, {
            knockback: geyser.knockback,
            pull: false,
            hitsSubmerged: false,
          });
        }
      }

      // The column lingers briefly after firing, purely so the player sees
      // what hit them.
      geyser.eruptS -= dt;
      if (geyser.eruptS > 0) alive.push(geyser);
    }
    this.geysers = alive;
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
      // `mine` lets the renderer tint an effect by whose it is without the
      // scene needing to know what a FighterId means.
      zones: this.zones.map((z) => ({
        id: z.id,
        flavour: z.flavour,
        x: z.x / ARENA,
        y: z.z / ARENA,
        radius: z.radius / ARENA,
        progress: 1 - z.remainingS / z.totalS,
        mine: z.owner === 'self',
      })),
      waves: this.waves.map((w) => ({
        id: w.id,
        x: (w.originX + w.dirX * w.travelled) / ARENA,
        y: (w.originZ + w.dirZ * w.travelled) / ARENA,
        angle: Math.atan2(w.dirZ, w.dirX),
        width: w.width / ARENA,
        progress: w.travelled / w.travel,
        mine: w.owner === 'self',
      })),
      beams: this.beams.map((b) => ({
        id: b.id,
        x: this.fighters[b.owner].x / ARENA,
        y: this.fighters[b.owner].z / ARENA,
        angle: b.angle,
        length: b.length / ARENA,
        width: b.width / ARENA,
        progress: 1 - b.remainingS / b.totalS,
        mine: b.owner === 'self',
      })),
      mines: this.mines.map((m) => ({
        id: m.id,
        x: m.x / ARENA,
        y: m.z / ARENA,
        radius: m.radius / ARENA,
        progress: 1 - m.fuseS / m.totalFuseS,
        mine: m.owner === 'self',
      })),
      geysers: this.geysers.map((g) => ({
        id: g.id,
        x: g.x / ARENA,
        y: g.z / ARENA,
        radius: g.radius / ARENA,
        erupting: g.fired,
        progress: g.fired ? 1 - g.eruptS / 0.45 : 1 - g.warnS / g.totalWarnS,
        mine: g.owner === 'self',
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
