import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

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

/**
 * PLACEHOLDER(Block 4): profile lives in Supabase from Block 6 onward. Block 4
 * replaces this provider with the real economy (gold, missions, inventory).
 */
const PLACEHOLDER_PROFILE: PlayerProfile = {
  name: 'Rookie',
  level: 7,
  xpIntoLevel: 340,
  xpPerLevel: 900,
  gold: 2450,
  elo: 1180,
  dailyGoldEarned: 620,
  dailyGoldCap: 1500,
};

interface PlayerValue {
  profile: PlayerProfile;
  /** Returns false when the player cannot afford the cost. */
  spendGold: (amount: number) => boolean;
  addGold: (amount: number) => void;
}

const PlayerContext = createContext<PlayerValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<PlayerProfile>(PLACEHOLDER_PROFILE);

  const value = useMemo<PlayerValue>(
    () => ({
      profile,
      spendGold: (amount) => {
        if (amount > profile.gold) return false;
        setProfile((current) => ({ ...current, gold: current.gold - amount }));
        return true;
      },
      addGold: (amount) => setProfile((current) => ({ ...current, gold: current.gold + amount })),
    }),
    [profile],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerValue {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return context;
}
