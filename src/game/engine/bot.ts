import { abilityAtLevel } from '@/data/cards';
import {
  BOT_AIM_ERROR,
  BOT_PANIC_HEALTH,
  BOT_PREFERRED_RANGE,
  BOT_THINK_S,
  MELEE_RANGE,
} from './tuning';
import type { FighterState, Intent } from './types';

/**
 * The bot (Block 3C).
 *
 * It plays the same game with the same rules — its deck decides its moveset, it
 * has to charge, it runs out of breath, it cannot act while submerged. Nothing
 * here reads state the player could not also see, so a bot that fights well is
 * fighting well rather than cheating.
 *
 * Two things the shape of this class exists for:
 *
 * - **Decisions are on a timer, aim is not.** Re-planning 60 times a second
 *   oscillates on the boundary of every threshold and reads as twitching; but a
 *   bot that only re-aims three times a second cannot track a moving target.
 * - **Presses are pulses, holds are holds.** The engine fires attack 2 and the
 *   ultimate on a rising edge, so an intent left `true` across frames fires
 *   exactly once and then never again. Attack 1 is the opposite: it is *meant*
 *   to be held, and fires when released.
 */
export class Bot {
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

  update(dt: number, self: FighterState, target: FighterState): Intent {
    this.clockS += dt;
    this.thinkS -= dt;
    if (this.thinkS <= 0) {
      this.thinkS = BOT_THINK_S;
      this.decide(self, target);
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

  private decide(self: FighterState, target: FighterState): void {
    const dx = target.x - self.x;
    const dz = target.z - self.z;
    const distance = Math.hypot(dx, dz);
    const nx = distance === 0 ? 0 : dx / distance;
    const nz = distance === 0 ? 0 : dz / distance;
    this.aimError = (Math.random() * 2 - 1) * BOT_AIM_ERROR;

    const attack1 = abilityAtLevel(self.loadout.attack1);
    const attack2 = abilityAtLevel(self.loadout.attack2);
    const ultimate = abilityAtLevel(self.loadout.ultimate);

    // Preferred distance comes from the deck, not a constant: a bot holding an
    // 11-metre Pressure Jet should keep away, one holding a 2.2-metre kick has
    // to close in.
    const preferred = Math.min(BOT_PREFERRED_RANGE, Math.max(attack1.range * 0.7, MELEE_RANGE));
    const hurt = self.health < BOT_PANIC_HEALTH;

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

    if (self.ultimate >= 1 && distance <= ultimate.range + 2) this.pulses.ultimate = true;
    if (self.cooldowns.attack2 === 0 && distance <= attack2.range + 1) this.pulses.attack2 = true;

    // Only *start* a charge here. Re-deciding while already holding pushed the
    // release deadline further out every think tick, so the bot charged forever
    // and never actually fired a shot.
    if (!this.holding && self.cooldowns.attack1 === 0 && distance <= attack1.range) {
      if (attack1.chargeS > 0) {
        this.holding = true;
        // Most of the charge window, but not always all of it: real shots
        // rather than a stream of minimum-charge dribbles, without the bot
        // being perfectly consistent.
        this.releaseAtS = this.clockS + attack1.chargeS * (0.6 + Math.random() * 0.45);
      } else {
        this.pulses.attack1 = true;
      }
    }
  }
}
