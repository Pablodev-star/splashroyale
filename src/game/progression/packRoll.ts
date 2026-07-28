import type { AbilityCard, Pack, Rarity } from '@/types/game';
import { RARITY_ORDER } from '@/data/cards';

/**
 * Rolling a pack (Block 4).
 *
 * Pure: cards in, pulls out, randomness injected. That is what lets the odds be
 * checked by opening a hundred thousand packs in a loop — the only way to tell a
 * correct drop table from one that is merely plausible.
 */

export interface PackPull {
  cardId: string;
  rarity: Rarity;
  /** True when the player did not own this card before the pull. */
  isNew: boolean;
  /** Copies this pull is worth (always 1 today; kept for bundle pulls later). */
  copies: number;
}

export type RandomSource = () => number;

/** Picks a rarity against the pack's odds. */
export function rollRarity(odds: Pack['odds'], random: RandomSource): Rarity {
  const total = RARITY_ORDER.reduce((sum, rarity) => sum + odds[rarity], 0);
  let ticket = random() * total;
  for (const rarity of RARITY_ORDER) {
    ticket -= odds[rarity];
    if (ticket <= 0) return rarity;
  }
  // Only reachable through floating-point drift on the final boundary.
  return RARITY_ORDER[RARITY_ORDER.length - 1];
}

/**
 * Opens one pack.
 *
 * The guarantee is applied by *upgrading* the best card in the roll rather than
 * appending an extra one: a five-card pack must hand over five cards whether or
 * not the odds happened to be kind, and the alternative — rolling until the
 * guarantee lands — makes a generous roll pay less than a stingy one.
 */
export function rollPack(
  pack: Pack,
  cards: AbilityCard[],
  ownedIds: ReadonlySet<string>,
  random: RandomSource = Math.random,
): PackPull[] {
  const byRarity = new Map<Rarity, AbilityCard[]>();
  for (const rarity of RARITY_ORDER) {
    byRarity.set(
      rarity,
      cards.filter((card) => card.rarity === rarity),
    );
  }

  const pickRarity = (rarity: Rarity): Rarity => {
    // A rarity with no cards authored for it would otherwise deadlock the pull.
    // Step down until something exists; the catalogue covers every rarity, so
    // this is a guard rather than an expected path.
    let index = RARITY_ORDER.indexOf(rarity);
    while (index > 0 && (byRarity.get(RARITY_ORDER[index]) ?? []).length === 0) index -= 1;
    return RARITY_ORDER[index];
  };

  const rarities: Rarity[] = [];
  for (let i = 0; i < pack.cardCount; i += 1) {
    rarities.push(pickRarity(rollRarity(pack.odds, random)));
  }

  // Apply the guarantee to whichever slot is already closest to it, so the
  // upgrade costs the player the least value.
  const floor = RARITY_ORDER.indexOf(pack.guaranteed);
  if (!rarities.some((rarity) => RARITY_ORDER.indexOf(rarity) >= floor)) {
    let best = 0;
    for (let i = 1; i < rarities.length; i += 1) {
      if (RARITY_ORDER.indexOf(rarities[i]) > RARITY_ORDER.indexOf(rarities[best])) best = i;
    }
    rarities[best] = pickRarity(pack.guaranteed);
  }

  // `seen` makes "new" mean new *to the player*, counting earlier pulls in this
  // same pack — otherwise a pack containing two copies of one unowned card
  // announces the same discovery twice. It also drives the bias below, so a
  // ten-card pack does not hand you the same new legendary twice.
  const seen = new Set(ownedIds);
  return rarities.map((rarity) => {
    const pool = byRarity.get(rarity) ?? [];
    const missing = pool.filter((card) => !seen.has(card.id));
    // Prefer cards you do not have, *within* the rolled rarity. The advertised
    // odds are a promise about rarity, not about which card, so this leaves the
    // pull-rate table exactly true while removing the coupon-collector tail:
    // uniform picking left the last few legendaries to chance and stretched a
    // complete collection from ~30 capped days to anywhere up to 320.
    const biased = missing.length > 0 && random() < NEW_CARD_BIAS;
    const source = biased ? missing : pool;
    const card = source[Math.floor(random() * source.length) % source.length];
    const isNew = !seen.has(card.id);
    seen.add(card.id);
    return { cardId: card.id, rarity, isNew, copies: 1 };
  });
}

/**
 * How often a pull prefers a card you are missing over one you already have.
 *
 * Not 1: duplicates are how cards level up, and a pack that never repeats would
 * make levelling impossible until the collection was complete.
 */
const NEW_CARD_BIAS = 0.7;
