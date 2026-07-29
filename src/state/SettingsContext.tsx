import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { GameSettings } from '@/types/game';
import { DEFAULT_BOT_DIFFICULTY } from '@/game/engine/difficulty';

const STORAGE_KEY = 'splash-royale:settings:v1';

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  musicVolume: 60,
  sfxVolume: 90,
  screenShake: true,
  scanlines: true,
  showMinimap: true,
  leftHandedControls: false,
  controlScheme: 'auto',
  botDifficulty: DEFAULT_BOT_DIFFICULTY,
  playerName: 'Rookie',
};

function loadSettings(): GameSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    // Merge so settings added by later blocks fall back to their defaults.
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GameSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface SettingsValue {
  settings: GameSettings;
  update: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/**
 * Local settings store. Block 6 mirrors the player-facing fields (name, ELO) to
 * Supabase; everything here stays device-local.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GameSettings>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Private browsing / quota — settings simply don't persist.
    }
  }, [settings]);

  const update = useCallback(<K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const value = useMemo<SettingsValue>(
    () => ({ settings, update, reset }),
    [settings, update, reset],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside <SettingsProvider>');
  return context;
}
