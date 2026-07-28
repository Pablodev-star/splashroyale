import type { AbilityCard, AbilitySlot, Deck } from '@/types/game';
import { SLOT_ORDER } from './cards';

/** The player's resolved collection, keyed by id. */
export type CardLookup = Record<string, AbilityCard>;

/** How many decks can be saved. Enough to keep one per playstyle, not a library. */
export const MAX_DECKS = 6;

/**
 * Decks have **no rarity rule**: three legendaries is a legal deck, so is three
 * commons, so is any mix. The only constraint is structural — one card per slot,
 * equipped in the slot it was authored for, and owned.
 */
export function canEquip(card: AbilityCard, slot: AbilitySlot, ownedOnly = true): boolean {
  return card.slot === slot && (!ownedOnly || card.owned);
}

/** First usable card for a slot — the fallback when a saved deck loses a card. */
export function defaultCardForSlot(
  cards: CardLookup,
  slot: AbilitySlot,
  ownedOnly = true,
): AbilityCard | undefined {
  return Object.values(cards).find((card) => canEquip(card, slot, ownedOnly));
}

export function deckCards(deck: Deck, cards: CardLookup): (AbilityCard | undefined)[] {
  return SLOT_ORDER.map((slot) => cards[deck.cards[slot]]);
}

/** A deck is complete when every slot holds a card the player can actually use. */
export function isDeckComplete(deck: Deck, cards: CardLookup): boolean {
  return SLOT_ORDER.every((slot) => {
    const card = cards[deck.cards[slot]];
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
export function sanitiseDeck(deck: Deck, lookup: CardLookup, ownedOnly = true): Deck | null {
  const cards = {} as Record<AbilitySlot, string>;
  for (const slot of SLOT_ORDER) {
    const saved = lookup[deck.cards?.[slot]];
    const card =
      saved && canEquip(saved, slot, ownedOnly) ? saved : defaultCardForSlot(lookup, slot, ownedOnly);
    if (!card) return null;
    cards[slot] = card.id;
  }
  return { id: deck.id, name: deck.name, cards };
}

/**
 * The deck a new account starts with: the three starter commons.
 *
 * It used to also ship an all-legendary deck, to show the no-rarity-rule at a
 * glance. That was only honest while ownership was hand-authored — now that
 * cards are pulled, a new player owns three commons and nothing else, and a
 * deck referencing unowned legendaries would simply be repaired away on load.
 */
export const DEFAULT_DECKS: Deck[] = [
  {
    id: 'starter-pool-rules',
    name: 'Pool Rules',
    cards: { attack1: 'waterJet', attack2: 'undertowKick', ultimate: 'swell' },
  },
];

/**
 * What the bots bring (Block 3C).
 *
 * Not constrained by `owned` — the player's collection is the player's problem,
 * and a bot restricted to the starting cards would never show what the rest of
 * the catalogue does. Chosen to be a fair, readable fight: a ranged main attack
 * that has to be charged, a short-range disengage, and an ultimate that
 * telegraphs itself by crossing the whole arena.
 */
export const BOT_DECK: Deck = {
  id: 'bot',
  name: 'Bot Alpha',
  cards: { attack1: 'pressureJet', attack2: 'undertowKick', ultimate: 'tidalSurge' },
};

/** Name for the next deck the player creates: "Deck 3", "Deck 4", … */
export function nextDeckName(existing: Deck[]): string {
  const taken = new Set(existing.map((deck) => deck.name));
  for (let index = existing.length + 1; ; index += 1) {
    const name = `Deck ${index}`;
    if (!taken.has(name)) return name;
  }
}
