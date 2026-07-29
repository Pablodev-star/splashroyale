/**
 * Bot difficulty (Block 10A).
 *
 * The rule this file exists to keep: **a difficulty must change how the bot
 * plays, not how much health it has.** Scaling damage or hit points would make
 * a harder bot a longer bot — the same opponent making the same mistakes, just
 * with more of a buffer. Every field below is either a decision the bot makes
 * or a limit on how well it can make it, so beating a Shark means out-playing
 * something that genuinely reads the board and out-spacing you.
 *
 * The three that matter most, in order:
 *
 * 1. `threatAware` — whether the bot sees zones, waves, mines and geysers at
 *    all. A Rookie walks into a poison cloud and stands in it. A Veteran walks
 *    out, and dives under a tsunami. This is the single biggest difference and
 *    it is a capability, not a number.
 * 2. `thinkS` — how often it re-decides, which is its reaction time. At 0.6s a
 *    Rookie is still walking where you *were*; at 0.14s a Shark tracks you.
 * 3. `aimError` — lateral metres of miss, comparable to the 0.85m hit radius.
 *    Above it most shots miss; below it most land.
 *
 * Nothing here lets the bot read anything a player could not also see.
 */

import type { BotDifficulty } from '@/types/game';

export type { BotDifficulty };

export interface BotProfile {
  id: BotDifficulty;
  label: string;
  /** One line, shown on the picker. */
  blurb: string;
  /** What actually changes, in the player's words. Shown under the blurb. */
  tells: string[];

  /** Seconds between decisions. This is the bot's reaction time. */
  thinkS: number;
  /**
   * Lateral aim error in **metres of miss at the target**, not radians.
   *
   * Expressed as a distance so it stays comparable to `HIT_RADIUS` (0.85m) at
   * any range: a fixed angular error would make the bot deadly up close and
   * useless far away, which is not a difficulty, it is a bug.
   */
  aimError: number;
  /** Fraction of the charge window used before releasing attack 1. */
  chargeMin: number;
  chargeMax: number;
  /** Health below which it breaks off and dives. */
  panicHealth: number;
  /**
   * Whether it perceives lingering hazards at all: enemy zones underfoot,
   * inbound waves, armed mines, arming geysers.
   */
  threatAware: boolean;
  /** Seconds of lead time it needs to dive under an inbound wave. */
  dodgeWindowS: number;
  /** Chance per decision that it simply fumbles the turn and does nothing. */
  blunderChance: number;
  /**
   * Holds the ultimate for a window where it can actually land, instead of
   * firing the moment the tank fills.
   */
  ultimatePatience: boolean;
  /** Multiplies its preferred engagement distance. Below 1 crowds you. */
  spacing: number;
  /** Level its cards are resolved at, so its numbers grow with difficulty. */
  cardLevel: number;
}

export const BOT_PROFILES: Record<BotDifficulty, BotProfile> = {
  rookie: {
    id: 'rookie',
    label: 'Rookie',
    blurb: 'Learning which end of the pool is which.',
    tells: ['Slow to react', 'Misses a lot', 'Walks into hazards'],
    thinkS: 0.6,
    // Well above the 0.85m hit radius: most shots go wide, and the ones that
    // land feel like the bot got lucky rather than aimed.
    aimError: 2.6,
    chargeMin: 0.35,
    chargeMax: 0.7,
    panicHealth: 0.25,
    threatAware: false,
    dodgeWindowS: 0,
    blunderChance: 0.25,
    ultimatePatience: false,
    spacing: 1,
    cardLevel: 1,
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    blurb: 'Knows the moves. Does not always pick the right one.',
    tells: ['Fair reactions', 'Trades hits', 'Ignores most hazards'],
    thinkS: 0.35,
    aimError: 1.2,
    chargeMin: 0.6,
    chargeMax: 1.05,
    panicHealth: 0.35,
    threatAware: false,
    dodgeWindowS: 0,
    blunderChance: 0.08,
    ultimatePatience: false,
    spacing: 1,
    cardLevel: 2,
  },
  veteran: {
    id: 'veteran',
    label: 'Veteran',
    blurb: 'Reads the water. Will not stand in your poison.',
    tells: ['Dodges hazards', 'Dives under waves', 'Saves its ultimate'],
    thinkS: 0.22,
    // Just inside the hit radius: most shots land, some do not.
    aimError: 0.75,
    chargeMin: 0.8,
    chargeMax: 1,
    panicHealth: 0.4,
    threatAware: true,
    dodgeWindowS: 0.55,
    blunderChance: 0.02,
    ultimatePatience: true,
    spacing: 1.1,
    cardLevel: 3,
  },
  shark: {
    id: 'shark',
    label: 'Shark',
    blurb: 'Hunts. Punishes every charge you hold too long.',
    tells: ['Near-instant reactions', 'Rarely misses', 'Keeps you at its range'],
    thinkS: 0.14,
    aimError: 0.35,
    chargeMin: 0.95,
    chargeMax: 1,
    panicHealth: 0.45,
    threatAware: true,
    dodgeWindowS: 0.85,
    blunderChance: 0,
    ultimatePatience: true,
    spacing: 1.2,
    cardLevel: 5,
  },
};

export const BOT_DIFFICULTY_ORDER: BotDifficulty[] = [
  'rookie',
  'standard',
  'veteran',
  'shark',
];

export const DEFAULT_BOT_DIFFICULTY: BotDifficulty = 'standard';

/** Falls back to the default rather than throwing on an unknown stored value. */
export function botProfile(difficulty: BotDifficulty | undefined): BotProfile {
  return BOT_PROFILES[difficulty ?? DEFAULT_BOT_DIFFICULTY] ?? BOT_PROFILES[DEFAULT_BOT_DIFFICULTY];
}
