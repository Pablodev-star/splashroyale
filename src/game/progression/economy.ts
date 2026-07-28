import type { MatchOutcome, Rarity } from '@/types/game';

/**
 * The economy (Block 4).
 *
 * Every number that decides what something costs and what it pays lives here,
 * as pure functions over plain values. Nothing imports React, so the whole
 * curve can be swept headlessly — which matters more here than anywhere else in
 * the game: a level curve that stalls or a pack that pays for itself is not
 * visible by reading, only by playing a few hundred matches at once.
 */

export const MAX_CARD_LEVEL = 5;

/**
 * Copies needed to go from `level` to `level + 1`.
 *
 * Rarer cards need fewer copies but drop far less often, so the *time* to a
 * level is comparable across rarities while the feel is not: commons trickle in
 * constantly, a legendary duplicate is an event.
 */
const COPIES_BASE: Record<Rarity, number> = {
  common: 4,
  rare: 3,
  epic: 2,
  legendary: 1,
};

export function copiesForNextLevel(rarity: Rarity, level: number): number {
  if (level >= MAX_CARD_LEVEL) return 0;
  // Doubling each level: 4, 8, 16, 32 for a common. The last step should feel
  // like a decision to commit to one card rather than something you pass by.
  return COPIES_BASE[rarity] * 2 ** (level - 1);
}

/** Gold to buy the next level outright, skipping the copies. */
const UPGRADE_BASE: Record<Rarity, number> = {
  common: 120,
  rare: 400,
  epic: 1200,
  legendary: 3000,
};

export function upgradeCostGold(rarity: Rarity, level: number): number {
  if (level >= MAX_CARD_LEVEL) return 0;
  return UPGRADE_BASE[rarity] * level;
}

/**
 * Gold paid for a duplicate of a card already at max level.
 *
 * Without this, every legendary duplicate after level 5 is worth nothing and
 * the best packs get *worse* the longer you play.
 */
const DUPLICATE_GOLD: Record<Rarity, number> = {
  common: 15,
  rare: 60,
  epic: 180,
  legendary: 600,
};

export function duplicateGold(rarity: Rarity): number {
  return DUPLICATE_GOLD[rarity];
}

/* --- Player level ---------------------------------------------------------- */

/** XP needed to clear `level`. Gentle curve — levels are pacing, not a wall. */
export function xpForLevel(level: number): number {
  return 600 + (level - 1) * 300;
}

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpPerLevel: number;
}

/** Applies XP, rolling over as many levels as it earns. */
export function applyXp(current: LevelProgress, xp: number): LevelProgress {
  let { level, xpIntoLevel } = current;
  let remaining = xp;
  while (remaining > 0) {
    const needed = xpForLevel(level) - xpIntoLevel;
    if (remaining < needed) {
      xpIntoLevel += remaining;
      remaining = 0;
    } else {
      remaining -= needed;
      level += 1;
      xpIntoLevel = 0;
    }
  }
  return { level, xpIntoLevel, xpPerLevel: xpForLevel(level) };
}

/* --- Match rewards ---------------------------------------------------------- */

export const DAILY_GOLD_CAP = 1500;

export interface MatchReward {
  /** Gold the match was worth before the daily cap. */
  goldEarned: number;
  /** Gold actually paid, after the cap. */
  goldPaid: number;
  xpEarned: number;
}

/**
 * What a finished match pays.
 *
 * The daily cap is the anti-snowball rule from the design doc: it limits *gold*
 * and never XP, so grinding past the cap still progresses the account but stops
 * buying packs. Bots pay half — they are practice, not a farm.
 */
export function matchReward(
  outcome: Pick<MatchOutcome, 'victory' | 'score'>,
  mode: 'localBots' | 'online' | 'privateRoom',
  goldEarnedToday: number,
): MatchReward {
  const base = outcome.victory ? 180 : 60;
  // A 2-0 should not pay the same as a 2-1 that went the distance.
  const roundBonus = outcome.score.self * 25;
  const modeMultiplier = mode === 'localBots' ? 0.5 : 1;
  const goldEarned = Math.round((base + roundBonus) * modeMultiplier);
  const headroom = Math.max(0, DAILY_GOLD_CAP - goldEarnedToday);
  return {
    goldEarned,
    goldPaid: Math.min(goldEarned, headroom),
    xpEarned: Math.round((outcome.victory ? 120 : 45) + outcome.score.self * 20),
  };
}
