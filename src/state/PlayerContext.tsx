import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AbilityCard, CardProgress, GameMode, MatchOutcome, Pack } from '@/types/game';
import { CARD_DEF_BY_ID, STARTER_COLLECTION, resolveCollection } from '@/data/cards';
import {
  DAILY_GOLD_CAP,
  MAX_CARD_LEVEL,
  applyXp,
  copiesForNextLevel,
  duplicateGold,
  matchReward,
  upgradeCostGold,
  xpForLevel,
} from '@/game/progression/economy';
import { rollPack, type PackPull } from '@/game/progression/packRoll';

const STORAGE_KEY = 'splash-royale:progress:v1';

export interface PlayerProfile {
  name: string;
  level: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  gold: number;
  /** Ranked rating. Matchmaking uses it from Block 6; shown as a badge now. */
  elo: number;
  /** Gold earned today, against the daily cap (design doc §4). */
  dailyGoldEarned: number;
  dailyGoldCap: number;
}

interface StoredProgress {
  gold: number;
  level: number;
  xpIntoLevel: number;
  elo: number;
  dailyGoldEarned: number;
  /** Local date the daily counter belongs to, so it resets on its own. */
  dailyGoldDate: string;
  cards: Record<string, CardProgress>;
}

/** Local date key. Deliberately local, not UTC — "today" is the player's day. */
function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

const INITIAL: StoredProgress = {
  gold: 900,
  level: 1,
  xpIntoLevel: 0,
  elo: 1000,
  dailyGoldEarned: 0,
  dailyGoldDate: todayKey(),
  cards: STARTER_COLLECTION,
};

function load(): StoredProgress {
  if (typeof localStorage === 'undefined') return INITIAL;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as Partial<StoredProgress>;

    // Card progress is filtered against the catalogue: a saved id for a card
    // that no longer exists would otherwise sit in the collection forever,
    // counted in the completion total and impossible to render.
    const cards: Record<string, CardProgress> = {};
    for (const [id, progress] of Object.entries(parsed.cards ?? {})) {
      const definition = CARD_DEF_BY_ID[id];
      if (!definition || !progress) continue;
      cards[id] = {
        level: Math.min(MAX_CARD_LEVEL, Math.max(1, Math.floor(progress.level ?? 1))),
        copies: Math.max(0, Math.floor(progress.copies ?? 0)),
      };
    }

    const sameDay = parsed.dailyGoldDate === todayKey();
    return {
      gold: Math.max(0, parsed.gold ?? INITIAL.gold),
      level: Math.max(1, parsed.level ?? INITIAL.level),
      xpIntoLevel: Math.max(0, parsed.xpIntoLevel ?? 0),
      elo: parsed.elo ?? INITIAL.elo,
      // A stale counter is a new day's counter, not yesterday's spend.
      dailyGoldEarned: sameDay ? Math.max(0, parsed.dailyGoldEarned ?? 0) : 0,
      dailyGoldDate: todayKey(),
      cards: Object.keys(cards).length > 0 ? cards : STARTER_COLLECTION,
    };
  } catch {
    return INITIAL;
  }
}

export interface PackOpening {
  packId: string;
  pulls: PackPull[];
  /** Gold refunded for duplicates of cards already at max level. */
  goldFromDuplicates: number;
}

interface PlayerValue {
  profile: PlayerProfile;
  /** The whole catalogue, resolved against this player's progress. */
  cards: AbilityCard[];
  cardById: Record<string, AbilityCard>;
  /** Returns false when the player cannot afford the cost. */
  spendGold: (amount: number) => boolean;
  addGold: (amount: number) => void;
  /**
   * Buys and opens a pack in one step, applying every pull. Returns what came
   * out so the ceremony can show it, or null when the gold is not there.
   */
  openPack: (pack: Pack) => PackOpening | null;
  /** Spends banked copies to level a card. False when it is not ready. */
  levelUpCard: (cardId: string) => boolean;
  /** Buys the next level outright with gold. False when unaffordable. */
  buyCardLevel: (cardId: string) => boolean;
  /** Credits a finished match. Returns the outcome with real reward numbers. */
  creditMatch: (
    outcome: Omit<MatchOutcome, 'goldEarned' | 'xpEarned' | 'levelBefore' | 'levelAfter' | 'xpIntoLevel' | 'xpPerLevel'>,
    mode: GameMode,
  ) => MatchOutcome;
  /** Wipes progress back to a new account. Used by Settings. */
  resetProgress: () => void;
}

const PlayerContext = createContext<PlayerValue | null>(null);

/**
 * The player's account: gold, level, and every card they own (Block 4).
 *
 * Device-local, like settings and decks; Block 6 moves it to Supabase. The
 * economy rules themselves live in `@/game/progression`, as pure functions —
 * this provider only holds the state and applies them, so the curve can be
 * swept headlessly without a React tree.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredProgress>(load);
  // Read by actions that must answer synchronously (buying, levelling), where a
  // `setState` updater has not necessarily run by the time the caller returns.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing / quota — progress simply doesn't persist.
    }
  }, [state]);

  const { cards, byId } = useMemo(() => resolveCollection(state.cards), [state.cards]);

  const profile = useMemo<PlayerProfile>(
    () => ({
      name: 'Rookie',
      level: state.level,
      xpIntoLevel: state.xpIntoLevel,
      xpPerLevel: xpForLevel(state.level),
      gold: state.gold,
      elo: state.elo,
      dailyGoldEarned: state.dailyGoldEarned,
      dailyGoldCap: DAILY_GOLD_CAP,
    }),
    [state],
  );

  const spendGold = useCallback((amount: number) => {
    if (amount > stateRef.current.gold) return false;
    setState((current) =>
      amount > current.gold ? current : { ...current, gold: current.gold - amount },
    );
    return true;
  }, []);

  const addGold = useCallback((amount: number) => {
    setState((current) => ({ ...current, gold: current.gold + amount }));
  }, []);

  const openPack = useCallback((pack: Pack): PackOpening | null => {
    const current = stateRef.current;
    if (pack.costGold > current.gold) return null;

    const { cards: resolved } = resolveCollection(current.cards);
    const owned = new Set(Object.keys(current.cards));
    const pulls = rollPack(pack, resolved, owned);

    // Apply every pull to a working copy, then commit once. Applying them one
    // at a time through setState would make each pull's "is this new" depend on
    // whether React had flushed the previous one.
    const nextCards: Record<string, CardProgress> = { ...current.cards };
    let goldFromDuplicates = 0;
    for (const pull of pulls) {
      const definition = CARD_DEF_BY_ID[pull.cardId];
      const existing = nextCards[pull.cardId];
      if (!existing) {
        nextCards[pull.cardId] = { level: 1, copies: 0 };
        continue;
      }
      if (existing.level >= MAX_CARD_LEVEL) {
        // Nothing left to feed: pay gold instead, so the best packs never get
        // worse the longer you play.
        goldFromDuplicates += duplicateGold(definition.rarity);
        continue;
      }
      nextCards[pull.cardId] = { ...existing, copies: existing.copies + pull.copies };
    }

    setState((latest) => ({
      ...latest,
      gold: latest.gold - pack.costGold + goldFromDuplicates,
      cards: nextCards,
    }));
    return { packId: pack.id, pulls, goldFromDuplicates };
  }, []);

  const levelUpCard = useCallback((cardId: string) => {
    const current = stateRef.current;
    const progress = current.cards[cardId];
    const definition = CARD_DEF_BY_ID[cardId];
    if (!progress || !definition || progress.level >= MAX_CARD_LEVEL) return false;
    const needed = copiesForNextLevel(definition.rarity, progress.level);
    if (progress.copies < needed) return false;

    setState((latest) => {
      const live = latest.cards[cardId];
      if (!live || live.copies < needed || live.level >= MAX_CARD_LEVEL) return latest;
      return {
        ...latest,
        cards: {
          ...latest.cards,
          // Surplus copies carry over — they were earned, and resetting to zero
          // punishes anyone who banks past the threshold before spending.
          [cardId]: { level: live.level + 1, copies: live.copies - needed },
        },
      };
    });
    return true;
  }, []);

  const buyCardLevel = useCallback((cardId: string) => {
    const current = stateRef.current;
    const progress = current.cards[cardId];
    const definition = CARD_DEF_BY_ID[cardId];
    if (!progress || !definition || progress.level >= MAX_CARD_LEVEL) return false;
    const cost = upgradeCostGold(definition.rarity, progress.level);
    if (cost > current.gold) return false;

    setState((latest) => {
      const live = latest.cards[cardId];
      if (!live || live.level >= MAX_CARD_LEVEL || cost > latest.gold) return latest;
      return {
        ...latest,
        gold: latest.gold - cost,
        cards: { ...latest.cards, [cardId]: { ...live, level: live.level + 1 } },
      };
    });
    return true;
  }, []);

  const creditMatch = useCallback<PlayerValue['creditMatch']>((outcome, mode) => {
    const current = stateRef.current;
    const sameDay = current.dailyGoldDate === todayKey();
    const earnedToday = sameDay ? current.dailyGoldEarned : 0;
    const reward = matchReward(outcome, mode, earnedToday);
    const levelled = applyXp(
      { level: current.level, xpIntoLevel: current.xpIntoLevel, xpPerLevel: xpForLevel(current.level) },
      reward.xpEarned,
    );

    setState((latest) => ({
      ...latest,
      gold: latest.gold + reward.goldPaid,
      level: levelled.level,
      xpIntoLevel: levelled.xpIntoLevel,
      dailyGoldEarned: earnedToday + reward.goldPaid,
      dailyGoldDate: todayKey(),
      elo: latest.elo + (outcome.eloDelta ?? 0),
    }));

    return {
      ...outcome,
      // What the match was worth, and what the cap actually paid — the result
      // screen shows both, so a capped payout is visible rather than silent.
      goldEarned: reward.goldPaid,
      goldCapped: reward.goldPaid < reward.goldEarned,
      xpEarned: reward.xpEarned,
      levelBefore: current.level,
      levelAfter: levelled.level,
      xpIntoLevel: levelled.xpIntoLevel,
      xpPerLevel: levelled.xpPerLevel,
    };
  }, []);

  const resetProgress = useCallback(() => setState({ ...INITIAL, dailyGoldDate: todayKey() }), []);

  const value = useMemo<PlayerValue>(
    () => ({
      profile,
      cards,
      cardById: byId,
      spendGold,
      addGold,
      openPack,
      levelUpCard,
      buyCardLevel,
      creditMatch,
      resetProgress,
    }),
    [
      profile,
      cards,
      byId,
      spendGold,
      addGold,
      openPack,
      levelUpCard,
      buyCardLevel,
      creditMatch,
      resetProgress,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerValue {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return context;
}

/** Convenience for the many screens that only need the resolved collection. */
export function useCollection(): { cards: AbilityCard[]; cardById: Record<string, AbilityCard> } {
  const { cards, cardById } = usePlayer();
  return { cards, cardById };
}
