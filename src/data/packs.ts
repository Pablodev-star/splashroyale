import type { Pack, PackTier, Rarity } from '@/types/game';

/**
 * Card packs ("sobres"). Cards are pulled from packs — never from crates or
 * boxes; the wording is part of the product identity.
 *
 * PLACEHOLDER(Block 4): prices and odds are first-pass balance values. The
 * shapes are final, so Block 4 replaces the numbers without touching the UI.
 */
export const PACKS: Pack[] = [
  {
    id: 'poolPack',
    name: 'Pool Pack',
    tagline: 'Straight from the vending machine.',
    description:
      'The everyday pack. Three cards, mostly commons, but the chlorine has been known to hide a surprise.',
    costGold: 250,
    cardCount: 3,
    guaranteed: 'common',
    tier: 'standard',
    odds: { common: 80, rare: 17, epic: 2.7, legendary: 0.3 },
    art: { base: '#1878a8', shade: '#0a2540', accent: '#9ef0f5', emblem: '≈' },
  },
  {
    id: 'lifeguardPack',
    name: 'Lifeguard Pack',
    tagline: 'One rare, whistle guaranteed.',
    description:
      'Five cards with at least one Rare. The reliable pick when you are building a deck on purpose.',
    costGold: 750,
    cardCount: 5,
    guaranteed: 'rare',
    tier: 'premium',
    odds: { common: 62, rare: 30, epic: 7, legendary: 1 },
    art: { base: '#ffc247', shade: '#b8791c', accent: '#04121f', emblem: '✦' },
  },
  {
    id: 'reefPack',
    name: 'Reef Pack',
    tagline: 'Deep water, deep pulls.',
    description:
      'Seven cards with a guaranteed Epic. Coral shelves hide the good stuff — this is where decks get sharp.',
    costGold: 1800,
    cardCount: 7,
    guaranteed: 'epic',
    tier: 'elite',
    odds: { common: 44, rare: 36, epic: 17, legendary: 3 },
    art: { base: '#b463ff', shade: '#4a1d7a', accent: '#e8fbff', emblem: '◈' },
  },
  {
    id: 'leviathanPack',
    name: 'Leviathan Pack',
    tagline: 'Something enormous is awake down there.',
    description:
      'Ten cards with a guaranteed Legendary. The whole ocean shakes when one of these opens.',
    costGold: 4500,
    cardCount: 10,
    guaranteed: 'legendary',
    tier: 'mythic',
    odds: { common: 28, rare: 38, epic: 26, legendary: 8 },
    art: { base: '#ffb31f', shade: '#7a4a00', accent: '#ffffff', emblem: '★' },
  },
];

export const PACK_BY_ID: Record<string, Pack> = Object.fromEntries(
  PACKS.map((pack) => [pack.id, pack]),
);

export const PACK_TIER_LABEL: Record<PackTier, string> = {
  standard: 'Standard',
  premium: 'Premium',
  elite: 'Elite',
  mythic: 'Mythic',
};

/** Order used when rendering an odds table, best rarity last. */
export const ODDS_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

/** Formats a pull rate: keeps one decimal only when it matters. */
export function formatOdds(value: number): string {
  return value < 1 || !Number.isInteger(value) ? `${value.toFixed(1)}%` : `${value}%`;
}
