import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameMode, MapId, MatchOutcome } from '@/types/game';
import { MAP_BY_ID } from '@/data/maps';
import { CHARACTERS } from '@/data/characters';
import { Arena3D, type Arena3DHandle, type SceneFighter } from '@/game/scene';
import { useWaterReactions, type WaterActor } from '@/components/water/useWaterReactions';
import { useSplashEvents, type SplashEvent } from '@/game/vfx';
import { useMatchSimulation } from '@/components/match/useMatchSimulation';
import { GameHud } from '@/components/hud/GameHud';
import { TouchControls } from '@/components/hud/TouchControls';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { useNavigation } from '@/state/NavigationContext';
import { useSettings } from '@/state/SettingsContext';

export interface MatchScreenProps {
  mode: GameMode;
  mapId: MapId;
  roomCode?: string;
}

const MATCH_DURATION_MS = 120_000;

/**
 * The match stage: arena behind, HUD in front, pause overlay on top.
 *
 * PLACEHOLDER(Block 3): input and state come from `useMatchSimulation`. Block 3
 * swaps that single hook for the real engine — the HUD, overlays and result
 * hand-off below stay as they are.
 */
export function MatchScreen({ mode, mapId, roomCode }: MatchScreenProps) {
  const { navigate, back } = useNavigation();
  const { settings } = useSettings();
  const map = MAP_BY_ID[mapId];

  const [paused, setPaused] = useState(false);
  const [charging, setCharging] = useState(false);
  const [submerged, setSubmerged] = useState(false);
  const arenaRef = useRef<Arena3DHandle | null>(null);

  const { hud, fighters, projectiles, splashes, finished } = useMatchSimulation({
    playerName: settings.playerName,
    opponentName: mode === 'localBots' ? 'Bot Alpha' : 'Challenger',
    durationMs: MATCH_DURATION_MS,
    paused,
    charging,
    submerged,
  });

  // --- Simulation -> 3D scene (Block 3A) ---------------------------------
  // The 2D arena mapped facing onto four screen-space names; in 3D facing is a
  // world angle, and which sprite orientation that becomes depends on where the
  // camera happens to be standing. The opponent is pointed at the player, which
  // is both what a fighter would do and what makes the four orientations
  // visibly cycle as the camera orbits.
  const sceneFighters = useMemo<SceneFighter[]>(() => {
    const self = fighters.find((f) => f.id === 'self');
    return fighters.map((fighter) => ({
      id: fighter.id,
      x: fighter.x,
      y: fighter.y,
      facing:
        fighter.id === 'self' || !self
          ? undefined
          : Math.atan2(self.y - fighter.y, self.x - fighter.x),
      animation: fighter.animation ?? (fighter.submerged ? 'dive' : 'idle'),
      submerged: fighter.submerged,
      isSelf: fighter.id === 'self',
      palette: { primary: fighter.colors.primary, accent: fighter.colors.secondary },
    }));
  }, [fighters]);

  // In 3D the water plane spans exactly the arena, so actor coordinates need no
  // rebasing — unlike the 2D stage, where the fighter layer started partway
  // down the canvas and every position had to be offset first.
  const actors = useMemo<WaterActor[]>(
    () => [
      ...fighters.map((f) => ({ id: f.id, x: f.x, y: f.y, submerged: f.submerged })),
      ...projectiles.map((p) => ({ id: `fx-${p.id}`, x: p.x, y: p.y })),
    ],
    [fighters, projectiles],
  );

  useWaterReactions(arenaRef, actors);
  // Both targets are the same object: the 3D scene throws the droplets *and*
  // owns the water they land in.
  useSplashEvents(arenaRef, arenaRef, splashes as SplashEvent[]);

  /** Demo keyboard bindings so the HUD can be exercised without a controller. */
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === 'Space') {
        event.preventDefault();
        setCharging(true);
      }
      if (event.code === 'ShiftLeft' || event.code === 'KeyS') setSubmerged((value) => !value);
      if (event.code === 'Escape') setPaused((value) => !value);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') setCharging(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const endMatch = useCallback(
    (victory: boolean) => {
      const outcome: MatchOutcome = buildOutcome(
        victory,
        mode,
        MATCH_DURATION_MS - hud.timeRemainingMs,
      );
      navigate('result', { mode, mapId, outcome, roomCode }, 'scale');
    },
    [hud.timeRemainingMs, mapId, mode, navigate, roomCode],
  );

  useEffect(() => {
    if (finished) endMatch(hud.self.health >= hud.opponent.health);
  }, [finished, endMatch, hud.self.health, hud.opponent.health]);

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <Arena3D
        map={map}
        fighters={sceneFighters}
        projectiles={projectiles}
        className="absolute inset-0"
        ref={arenaRef}
      />

      <GameHud
        state={hud}
        ultimateName={CHARACTERS[0].ultimate.name}
        showMinimap={settings.showMinimap}
        arenaAspect={map.size.width / map.size.depth}
        onPause={() => setPaused(true)}
        onActivateUltimate={() => {
          /* PLACEHOLDER(Block 3): fire the ultimate. */
        }}
      />

      {/* Touch layer — phones only; desktop uses the keyboard. */}
      <div className="md:hidden">
        <TouchControls
          submerged={submerged}
          mirrored={settings.leftHandedControls}
          onAttackDown={() => setCharging(true)}
          onAttackUp={() => setCharging(false)}
          onDiveToggle={() => setSubmerged((value) => !value)}
        />
      </div>

      {/* Desktop key hints. */}
      <div className="text-mist/50 pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 translate-y-8 text-[9px] tracking-[0.14em] uppercase md:block">
        Hold Space to charge · S to dive · Esc to pause
      </div>

      {paused && (
        <div className="bg-abyss/85 absolute inset-0 z-20 flex items-center justify-center p-4">
          <PixelPanel
            title="Paused"
            headerAside={roomCode ? `Room ${roomCode}` : undefined}
            className="w-full max-w-sm"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] tracking-[0.14em] uppercase">{map.name}</span>
                <PixelBadge tone="surf">
                  {hud.round.current}/{hud.round.total}
                </PixelBadge>
              </div>
              <PixelButton variant="primary" size="lg" fullWidth onClick={() => setPaused(false)}>
                Resume
              </PixelButton>
              <PixelButton variant="secondary" size="md" fullWidth onClick={() => endMatch(true)}>
                Simulate Victory
              </PixelButton>
              <PixelButton variant="secondary" size="md" fullWidth onClick={() => endMatch(false)}>
                Simulate Defeat
              </PixelButton>
              <PixelButton variant="danger" size="md" fullWidth onClick={back}>
                Forfeit
              </PixelButton>
            </div>
          </PixelPanel>
        </div>
      )}
    </div>
  );
}

/** PLACEHOLDER(Block 3/4): rewards come from the real match + economy rules. */
function buildOutcome(victory: boolean, mode: GameMode, durationMs: number): MatchOutcome {
  const base = victory ? 180 : 60;
  const modeMultiplier = mode === 'localBots' ? 0.5 : 1;
  return {
    victory,
    score: victory ? { self: 2, opponent: 1 } : { self: 1, opponent: 2 },
    durationMs,
    goldEarned: Math.round(base * modeMultiplier),
    xpEarned: victory ? 120 : 45,
    levelBefore: 7,
    levelAfter: 7,
    xpIntoLevel: 460,
    xpPerLevel: 900,
    stats: {
      damageDealt: victory ? 1240 : 780,
      splashesLanded: victory ? 34 : 21,
      timeSubmergedMs: 26_000,
    },
    eloDelta: mode === 'online' ? (victory ? 18 : -14) : null,
  };
}
