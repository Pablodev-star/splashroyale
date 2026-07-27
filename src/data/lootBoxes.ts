import type { LootBox } from '@/types/game';

/**
 * PLACEHOLDER(Block 4): costs, contents and probability tables are owned by the
 * progression block. Kept here so the shop screen has real-looking inventory.
 */
export const LOOT_BOXES: LootBox[] = [
  {
    id: 'poolBucket',
    name: 'Pool Bucket',
    description: '3 cards. Cheap, cheerful, mostly commons.',
    costGold: 250,
    cardCount: 3,
    guaranteed: 'common',
    accent: 'surf',
  },
  {
    id: 'coolerChest',
    name: 'Cooler Chest',
    description: '5 cards with at least one Rare.',
    costGold: 750,
    cardCount: 5,
    guaranteed: 'rare',
    accent: 'gold',
  },
  {
    id: 'reefVault',
    name: 'Reef Vault',
    description: '7 cards with at least one Epic.',
    costGold: 1800,
    cardCount: 7,
    guaranteed: 'epic',
    accent: 'rarity-epic',
  },
  {
    id: 'leviathanCrate',
    name: 'Leviathan Crate',
    description: '10 cards with a guaranteed Legendary.',
    costGold: 4500,
    cardCount: 10,
    guaranteed: 'legendary',
    accent: 'rarity-legendary',
  },
];
