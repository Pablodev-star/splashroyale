import type { AbilityCard, Rarity } from '@/types/game';

/**
 * PLACEHOLDER(Block 4): the real card catalogue, level curves and drop tables are
 * owned by the progression block. These entries exist so the collection grid and
 * the shop can be laid out and reviewed with realistic content.
 */
export const CARDS: AbilityCard[] = [
  {
    id: 'pressureJet',
    name: 'Pressure Jet',
    kind: 'attack',
    rarity: 'common',
    description: 'Charged shots travel 15% further.',
    level: 3,
    maxLevel: 5,
    copies: 7,
    copiesForNextLevel: 12,
    owned: true,
  },
  {
    id: 'splitStream',
    name: 'Split Stream',
    kind: 'attack',
    rarity: 'rare',
    description: 'Above 60% charge, the jet splits into two projectiles.',
    level: 2,
    maxLevel: 5,
    copies: 3,
    copiesForNextLevel: 8,
    owned: true,
  },
  {
    id: 'deepLungs',
    name: 'Deep Lungs',
    kind: 'defense',
    rarity: 'common',
    description: 'Oxygen drains 12% slower while submerged.',
    level: 4,
    maxLevel: 5,
    copies: 9,
    copiesForNextLevel: 16,
    owned: true,
  },
  {
    id: 'slipstream',
    name: 'Slipstream',
    kind: 'utility',
    rarity: 'common',
    description: 'Move 8% faster for 2s after surfacing.',
    level: 1,
    maxLevel: 5,
    copies: 2,
    copiesForNextLevel: 4,
    owned: true,
  },
  {
    id: 'undertowKick',
    name: 'Undertow Kick',
    kind: 'attack',
    rarity: 'rare',
    description: 'Kicks knock submerged enemies to the surface.',
    level: 1,
    maxLevel: 5,
    copies: 1,
    copiesForNextLevel: 4,
    owned: true,
  },
  {
    id: 'saltCrust',
    name: 'Salt Crust',
    kind: 'defense',
    rarity: 'epic',
    description: 'Take 20% less damage from splashes while at full charge.',
    level: 1,
    maxLevel: 5,
    copies: 0,
    copiesForNextLevel: 2,
    owned: true,
  },
  {
    id: 'tidalSurge',
    name: 'Tidal Surge',
    kind: 'ultimate',
    rarity: 'legendary',
    description: 'Ultimate charges 25% faster and its wave crosses the whole arena.',
    level: 1,
    maxLevel: 5,
    copies: 0,
    copiesForNextLevel: 1,
    owned: true,
  },
  {
    id: 'chlorineBurn',
    name: 'Chlorine Burn',
    kind: 'attack',
    rarity: 'epic',
    description: 'Direct hits blur the target for 1.5s.',
    level: 1,
    maxLevel: 5,
    copies: 0,
    copiesForNextLevel: 2,
    owned: false,
  },
  {
    id: 'anchorHeels',
    name: 'Anchor Heels',
    kind: 'defense',
    rarity: 'rare',
    description: 'Immune to knockback while charging above 80%.',
    level: 1,
    maxLevel: 5,
    copies: 0,
    copiesForNextLevel: 4,
    owned: false,
  },
  {
    id: 'bubbleShield',
    name: 'Bubble Shield',
    kind: 'defense',
    rarity: 'rare',
    description: 'Surfacing spawns a bubble that absorbs one hit.',
    level: 1,
    maxLevel: 5,
    copies: 0,
    copiesForNextLevel: 4,
    owned: false,
  },
  {
    id: 'skipShot',
    name: 'Skip Shot',
    kind: 'utility',
    rarity: 'common',
    description: 'Low-charge shots skim off the water once before landing.',
    level: 1,
    maxLevel: 5,
    copies: 0,
    copiesForNextLevel: 2,
    owned: false,
  },
  {
    id: 'leviathanCall',
    name: 'Leviathan Call',
    kind: 'ultimate',
    rarity: 'legendary',
    description: 'Ultimate summons a whirlpool that pulls and drowns.',
    level: 1,
    maxLevel: 5,
    copies: 0,
    copiesForNextLevel: 1,
    owned: false,
  },
];

export const CARD_BY_ID: Record<string, AbilityCard> = Object.fromEntries(
  CARDS.map((card) => [card.id, card]),
);

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

/** Tailwind token suffix for each rarity, e.g. `text-rarity-epic`. */
export const RARITY_TOKEN: Record<Rarity, string> = {
  common: 'rarity-common',
  rare: 'rarity-rare',
  epic: 'rarity-epic',
  legendary: 'rarity-legendary',
};

export const CARD_KIND_LABEL: Record<AbilityCard['kind'], string> = {
  attack: 'Attack',
  defense: 'Defense',
  utility: 'Utility',
  ultimate: 'Ultimate',
};
