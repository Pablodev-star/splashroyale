import { abilityAtLevel } from '@/data/cards';
import { BODY_RADIUS, BOT_PREFERRED_RANGE, MELEE_RANGE, ZONE_BODY_MARGIN } from './tuning';
import { botProfile, type BotDifficulty, type BotProfile } from './difficulty';
import type {
  FighterState,
  GeyserState,
  Intent,
  MineState,
  WaveState,
  ZoneState,
} from './types';

/**
 * What the bot can see coming. Supplied by `MatchEngine.threatsAgainst`, and
 * deliberately limited to hazards the *other* fighter owns — the same set a
 * human is watching for.
 */
export interface ThreatView {
  zones: readonly ZoneState[];
  waves: readonly WaveState[];
  mines: readonly MineState[];
  geysers: readonly GeyserState[];
}

const NO_THREATS: ThreatView = { zones: [], waves: [], mines: [], geysers: [] };

/**
 * The bot (Block 3C, difficulty in Block 10A).
 *
 * It plays the same game with the same rules — its deck decides its moveset, it
 * has to charge, it runs out of breath, it cannot act while submerged. Nothing
 * here reads state the player could not also see, so a bot that fights well is
 * fighting well rather than cheating.
 *
 * Three things the shape of this class exists for:
 *
 * - **Decisions are on a timer, aim is not.** Re-planning 60 times a second
 *   oscillates on the boundary of every threshold and reads as twitching; but a
 *   bot that only re-aims three times a second cannot track a moving target.
 * - **Presses are pulses, holds are holds.** The engine fires attack 2 and the
 *   ultimate on a rising edge, so an intent left `true` across frames fires
 *   exactly once and then never again. Attack 1 is the opposite: it is *meant*
 *   to be held, and fires when released.
 * - **Difficulty is behaviour, never stats.** A harder bot does not hit harder
 *   or survive longer; it reacts sooner, aims truer, spaces better, and — the
 *   part that actually changes how a fight feels — *sees hazards*. Threat
 *   handling below runs before anything else, and is gated on the profile, so
 *   a Rookie genuinely stands in poison while a Veteran genuinely walks out.
 */
export class Bot {
  private readonly profile: BotProfile;

  private thinkS = 0;
  private clockS = 0;
  private strafe = 1;

  /** Rising-edge actions, consumed by the next `update`. */
  private pulses = { attack1: false, attack2: false, ultimate: false };
  /** Lateral aim error in metres, resampled on every decision. */
  private aimError = 0;
  /** Attack 1 held down while a charge builds. */
  private holding = false;
  private releaseAtS = 0;
  private dive = false;
  private moveX = 0;
  private moveZ = 0;

  constructor(difficulty?: BotDifficulty) {
    this.profile = botProfile(difficulty);
  }

  update(dt: number, self: FighterState, target: FighterState, threats: ThreatView = NO_THREATS): Intent {
    this.clockS += dt;
    this.thinkS -= dt;
    if (this.thinkS <= 0) {
      this.thinkS = this.profile.thinkS;
      this.decide(self, target, threats);
    }
    if (this.holding && this.clockS >= this.releaseAtS) this.holding = false;

    const dx = target.x - self.x;
    const dz = target.z - self.z;
    const intent: Intent = {
      moveX: this.moveX,
      moveZ: this.moveZ,
      // The error is a fixed lateral offset for this decision, converted to an
      // angle against the current distance. Holding it steady between decisions
      // keeps the aim from jittering per frame; resampling it each decision
      // keeps successive shots independent, instead of a single oscillation the
      // firing rate can beat against and miss every time.
      facing: Math.atan2(dz, dx) + Math.atan2(this.aimError, Math.max(1, Math.hypot(dx, dz))),
      attack1: this.holding || this.pulses.attack1,
      attack2: this.pulses.attack2,
      ultimate: this.pulses.ultimate,
      dive: this.dive,
    };
    this.pulses = { attack1: false, attack2: false, ultimate: false };
    return intent;
  }

  private decide(self: FighterState, target: FighterState, threats: ThreatView): void {
    const profile = this.profile;
    const dx = target.x - self.x;
    const dz = target.z - self.z;
    const distance = Math.hypot(dx, dz);
    const nx = distance === 0 ? 0 : dx / distance;
    const nz = distance === 0 ? 0 : dz / distance;
    this.aimError = (Math.random() * 2 - 1) * profile.aimError;

    // A fumbled turn: stand still and do nothing until the next decision. This
    // is what separates a Rookie from a Standard far more than its aim does —
    // whiffing is forgivable, freezing at the wrong moment is what a beginner
    // actually does.
    if (profile.blunderChance > 0 && Math.random() < profile.blunderChance) {
      this.moveX = 0;
      this.moveZ = 0;
      this.holding = false;
      this.dive = false;
      return;
    }

    const attack1 = abilityAtLevel(self.loadout.attack1);
    const attack2 = abilityAtLevel(self.loadout.attack2);
    const ultimate = abilityAtLevel(self.loadout.ultimate);

    // Preferred distance comes from the deck, not a constant: a bot holding an
    // 11-metre Pressure Jet should keep away, one holding a 2.2-metre kick has
    // to close in. Difficulty then widens or tightens that by `spacing`.
    const preferred =
      Math.min(BOT_PREFERRED_RANGE, Math.max(attack1.range * 0.7, MELEE_RANGE)) * profile.spacing;
    const hurt = self.health < profile.panicHealth;

    // --- Threats -----------------------------------------------------------
    // Handled before anything else, because a poison cloud underfoot outranks
    // any opinion about spacing. Entirely skipped for the lower difficulties,
    // which is what makes them read as careless rather than merely inaccurate.
    if (profile.threatAware) {
      const inbound = this.incomingWave(self, threats.waves);
      if (inbound) {
        // Dive: a wave passes over a submerged fighter. This is the same
        // counter the player has, found the same way.
        this.dive = true;
        this.holding = false;
        // Keep moving out of its path too, in case the lungs run dry first.
        this.moveX = -inbound.dirZ;
        this.moveZ = inbound.dirX;
        return;
      }

      const escape = this.escapeVector(self, threats);
      if (escape) {
        this.moveX = escape.x;
        this.moveZ = escape.z;
        // Still shoot on the way out if something is off cooldown — walking
        // out of a cloud should not mean surrendering the trade.
        this.dive = false;
        this.holding = false;
        if (self.cooldowns.attack2 === 0 && distance <= attack2.range + 1) {
          this.pulses.attack2 = true;
        }
        return;
      }
    }

    // --- Breath ------------------------------------------------------------
    // Dive to break off when hurt and there is air to do it with; surface while
    // there is still air left, so it never drowns itself.
    this.dive = self.submerged ? hurt && self.oxygen > 0.25 : hurt && self.oxygen > 0.6;

    // --- Positioning -------------------------------------------------------
    if (hurt && !self.submerged) {
      this.moveX = -nx;
      this.moveZ = -nz;
    } else if (distance > preferred + 1) {
      this.moveX = nx;
      this.moveZ = nz;
    } else if (distance < preferred - 1.5) {
      this.moveX = -nx;
      this.moveZ = -nz;
    } else {
      // Perpendicular: strafing keeps it a moving target at its own best range.
      this.moveX = -nz * this.strafe;
      this.moveZ = nx * this.strafe;
      if (Math.random() < 0.25) this.strafe *= -1;
    }

    // --- Attacks -----------------------------------------------------------
    if (this.dive) {
      // Nothing fires from under water, for either side. Drop the charge too,
      // or the release timer keeps running while submerged and the shot comes
      // out the instant the bot surfaces, aimed at where the player used to be.
      this.holding = false;
      return;
    }

    // A patient bot waits for a window it can actually land in: the target has
    // to be in range and on the surface. Without patience the ultimate goes off
    // the instant the tank fills, which on a long cooldown is most of the value
    // of the slot thrown at an empty pool.
    const ultimateWorthIt = profile.ultimatePatience
      ? distance <= ultimate.range && !target.submerged
      : distance <= ultimate.range + 2;
    if (self.ultimate >= 1 && ultimateWorthIt) this.pulses.ultimate = true;

    if (self.cooldowns.attack2 === 0 && distance <= attack2.range + 1) this.pulses.attack2 = true;

    // Only *start* a charge here. Re-deciding while already holding pushed the
    // release deadline further out every think tick, so the bot charged forever
    // and never actually fired a shot.
    if (!this.holding && self.cooldowns.attack1 === 0 && distance <= attack1.range) {
      if (attack1.chargeS > 0) {
        this.holding = true;
        // How much of the charge window it commits to. A Rookie fires dribbles;
        // a Shark holds for the full shot nearly every time.
        const span = profile.chargeMax - profile.chargeMin;
        this.releaseAtS =
          this.clockS + attack1.chargeS * (profile.chargeMin + Math.random() * span);
      } else {
        this.pulses.attack1 = true;
      }
    }
  }

  /**
   * The first wave that will reach this fighter within the profile's dodge
   * window, or null.
   *
   * Geometry matches `stepWaves`: project onto the wave's travel axis, reject
   * anything outside its width, then ask how long until the crest arrives.
   * Waves already past are ignored, since diving under one that has gone by
   * only wastes air.
   */
  private incomingWave(self: FighterState, waves: readonly WaveState[]): WaveState | null {
    for (const wave of waves) {
      const rx = self.x - wave.originX;
      const rz = self.z - wave.originZ;
      const along = rx * wave.dirX + rz * wave.dirZ;
      const across = Math.abs(rx * -wave.dirZ + rz * wave.dirX);
      if (across > wave.width + BODY_RADIUS) continue;

      const gap = along - wave.travelled;
      if (gap < -BODY_RADIUS) continue; // Already swept past.
      const secondsAway = gap / Math.max(0.001, wave.speed);
      if (secondsAway <= this.profile.dodgeWindowS) return wave;
    }
    return null;
  }

  /**
   * A unit vector away from whatever hazard the bot is standing in or on top
   * of, or null when it is clear.
   *
   * Zones first, since standing in one is a continuous cost; then mines and
   * arming geysers, which are one-off but far larger hits. Only the nearest
   * threat is answered — averaging several escape directions produces a vector
   * that walks out of none of them.
   */
  private escapeVector(
    self: FighterState,
    threats: ThreatView,
  ): { x: number; z: number } | null {
    // Collected then reduced, rather than accumulated in a closure: assignments
    // made inside a callback are invisible to TypeScript's control-flow
    // analysis, so the "best so far" variable stayed typed as `null` and every
    // read of it failed to compile. A plain array sidesteps that entirely.
    const candidates: Array<{ x: number; z: number; urgency: number }> = [];

    const consider = (x: number, z: number, radius: number, urgency: number) => {
      const dx = self.x - x;
      const dz = self.z - z;
      const distance = Math.hypot(dx, dz);
      if (distance > radius) return;
      // Dead centre has no direction to flee; pick one rather than stalling.
      const centred = distance < 0.001;
      candidates.push({
        x: centred ? 1 : dx / distance,
        z: centred ? 0 : dz / distance,
        urgency,
      });
    };

    for (const zone of threats.zones) {
      // Urgency rises as it gets deeper in: the closer to the centre, the more
      // it wants out, so a bot clipping the edge does not abandon a good trade.
      const depth = 1 - Math.hypot(self.x - zone.x, self.z - zone.z) / zone.radius;
      consider(zone.x, zone.z, zone.radius + ZONE_BODY_MARGIN, 1 + depth);
    }
    for (const mine of threats.mines) {
      // A mine only matters once its fuse is nearly out — fleeing a charge with
      // two seconds left just gives up ground for free.
      if (mine.fuseS > 1.2) continue;
      consider(mine.x, mine.z, mine.radius + BODY_RADIUS, 3);
    }
    for (const geyser of threats.geysers) {
      consider(geyser.x, geyser.z, geyser.radius + BODY_RADIUS, 2.5);
    }

    if (candidates.length === 0) return null;
    let best = candidates[0];
    for (const candidate of candidates) {
      if (candidate.urgency > best.urgency) best = candidate;
    }
    return { x: best.x, z: best.z };
  }
}
