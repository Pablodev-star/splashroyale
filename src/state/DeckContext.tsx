import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AbilitySlot, Deck } from '@/types/game';
import { DEFAULT_DECKS, MAX_DECKS, nextDeckName, sanitiseDeck } from '@/data/decks';

const STORAGE_KEY = 'splash-royale:decks:v1';

interface StoredState {
  decks: Deck[];
  activeDeckId: string;
}

const DEFAULT_STATE: StoredState = {
  decks: DEFAULT_DECKS,
  activeDeckId: DEFAULT_DECKS[0].id,
};

function load(): StoredState {
  if (typeof localStorage === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<StoredState>;

    // Every saved deck is repaired against the current catalogue rather than
    // trusted: a card that moved slot or stopped being owned would otherwise
    // start a match with an empty ability.
    const decks = (Array.isArray(parsed.decks) ? parsed.decks : [])
      .map((deck) => (deck && typeof deck.id === 'string' ? sanitiseDeck(deck) : null))
      .filter((deck): deck is Deck => deck !== null)
      .slice(0, MAX_DECKS);
    if (decks.length === 0) return DEFAULT_STATE;

    const activeDeckId = decks.some((deck) => deck.id === parsed.activeDeckId)
      ? (parsed.activeDeckId as string)
      : decks[0].id;
    return { decks, activeDeckId };
  } catch {
    return DEFAULT_STATE;
  }
}

interface DeckValue {
  decks: Deck[];
  /** Never undefined — the store always keeps at least one complete deck. */
  activeDeck: Deck;
  activeDeckId: string;
  selectDeck: (id: string) => void;
  /** Equips a card into one slot of a deck. Slot mismatches are the caller's job. */
  equip: (deckId: string, slot: AbilitySlot, cardId: string) => void;
  renameDeck: (id: string, name: string) => void;
  /** Returns the new deck's id, or null when the deck limit is reached. */
  createDeck: () => string | null;
  /** No-op on the last remaining deck — there must always be one to play. */
  deleteDeck: (id: string) => void;
}

const DeckContext = createContext<DeckValue | null>(null);

/**
 * Saved decks (Block 3B). Device-local, like settings: Block 6 mirrors them to
 * Supabase so a deck follows the account instead of the browser.
 */
export function DeckProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredState>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing / quota — decks simply don't persist.
    }
  }, [state]);

  const selectDeck = useCallback((id: string) => {
    setState((current) =>
      current.decks.some((deck) => deck.id === id) ? { ...current, activeDeckId: id } : current,
    );
  }, []);

  const equip = useCallback((deckId: string, slot: AbilitySlot, cardId: string) => {
    setState((current) => ({
      ...current,
      decks: current.decks.map((deck) =>
        deck.id === deckId ? { ...deck, cards: { ...deck.cards, [slot]: cardId } } : deck,
      ),
    }));
  }, []);

  const renameDeck = useCallback((id: string, name: string) => {
    const trimmed = name.trim().slice(0, 16);
    if (!trimmed) return;
    setState((current) => ({
      ...current,
      decks: current.decks.map((deck) => (deck.id === id ? { ...deck, name: trimmed } : deck)),
    }));
  }, []);

  const createDeck = useCallback(() => {
    let created: string | null = null;
    setState((current) => {
      if (current.decks.length >= MAX_DECKS) return current;
      // Copying the active deck beats an empty one: the new deck is already
      // playable, and editing from a working loadout is how decks actually get
      // built.
      const source = current.decks.find((deck) => deck.id === current.activeDeckId);
      const base = source ?? current.decks[0];
      created = `deck-${Date.now().toString(36)}`;
      const deck: Deck = { id: created, name: nextDeckName(current.decks), cards: { ...base.cards } };
      return { decks: [...current.decks, deck], activeDeckId: created };
    });
    return created;
  }, []);

  const deleteDeck = useCallback((id: string) => {
    setState((current) => {
      if (current.decks.length <= 1) return current;
      const decks = current.decks.filter((deck) => deck.id !== id);
      if (decks.length === current.decks.length) return current;
      return {
        decks,
        activeDeckId: current.activeDeckId === id ? decks[0].id : current.activeDeckId,
      };
    });
  }, []);

  const value = useMemo<DeckValue>(() => {
    const activeDeck =
      state.decks.find((deck) => deck.id === state.activeDeckId) ?? state.decks[0];
    return {
      decks: state.decks,
      activeDeck,
      activeDeckId: activeDeck.id,
      selectDeck,
      equip,
      renameDeck,
      createDeck,
      deleteDeck,
    };
  }, [state, selectDeck, equip, renameDeck, createDeck, deleteDeck]);

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDecks(): DeckValue {
  const context = useContext(DeckContext);
  if (!context) throw new Error('useDecks must be used inside <DeckProvider>');
  return context;
}
