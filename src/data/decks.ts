import type { AbilityCard, AbilitySlot, Deck } from '@/types/game';
import { CARDS, CARD_BY_ID, SLOT_ORDER } from './cards';

/** How many decks can be saved. Enough to keep one per playstyle, not a library. */
export const MAX_DECKS = 6;

/**
 * Decks have **no rarity rule**: three legendaries is a legal deck, so is three
 * commons, so is any mix. The only constraint is structural — one card per slot,
 * equipped in the slot it was authored for, and owned.
 */
export function canEquip(card: AbilityCard, slot: AbilitySlot): boolean {
  return card.slot === slot && card.owned;
}

/** First owned card for a slot — the fallback when a saved deck loses a card. */
export function defaultCardForSlot(slot: AbilitySlot): AbilityCard | undefined {
  return CARDS.find((card) => canEquip(card, slot));
}

export function deckCards(deck: Deck): (AbilityCard | undefined)[] {
  return SLOT_ORDER.map((slot) => CARD_BY_ID[deck.cards[slot]]);
}

/** A deck is complete when every slot holds a card the player can actually use. */
export function isDeckComplete(deck: Deck): boolean {
  return SLOT_ORDER.every((slot) => {
    const card = CARD_BY_ID[deck.cards[slot]];
    return card !== undefined && canEquip(card, slot);
  });
}

/**
 * Repairs a deck read back from storage.
 *
 * Saved decks outlive the catalogue: a card can be renamed, moved to another
 * slot, or (once Block 4 owns the inventory) stop being owned. Any of those
 * would otherwise leave a slot pointing at nothing and the match starting with a
 * missing ability, so each broken slot falls back to the first card that fits.
 * Returns `null` only when a slot has no usable card at all, which cannot happen
 * while the commons are ownable but is not worth crashing over if it does.
 */
export function sanitiseDeck(deck: Deck): Deck | null {
  const cards = {} as Record<AbilitySlot, string>;
  for (const slot of SLOT_ORDER) {
    const saved = CARD_BY_ID[deck.cards?.[slot]];
    const card = saved && canEquip(saved, slot) ? saved : defaultCardForSlot(slot);
    if (!card) return null;
    cards[slot] = card.id;
  }
  return { id: deck.id, name: deck.name, cards };
}

/**
 * The decks a new player starts with. One is all commons, the other all
 * legendaries: seeing both side by side is the fastest way to learn that a deck
 * is three slots and nothing else — no rarity budget, no "one legendary max".
 */
export const DEFAULT_DECKS: Deck[] = [
  {
    id: 'starter-pool-rules',
    name: 'Pool Rules',
    cards: { attack1: 'waterJet', attack2: 'undertowKick', ultimate: 'swell' },
  },
  {
    id: 'starter-deep-end',
    name: 'Deep End',
    cards: { attack1: 'leviathanSpout', attack2: 'tsunamiKick', ultimate: 'hurricane' },
  },
];

/** Name for the next deck the player creates: "Deck 3", "Deck 4", … */
export function nextDeckName(existing: Deck[]): string {
  const taken = new Set(existing.map((deck) => deck.name));
  for (let index = existing.length + 1; ; index += 1) {
    const name = `Deck ${index}`;
    if (!taken.has(name)) return name;
  }
}
