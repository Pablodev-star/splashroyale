import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AbilityCard, AbilitySlot, GameMode, MapId } from '@/types/game';
import { MAP_BY_ID } from '@/data/maps';
import { SLOT_ORDER } from '@/data/cards';
import { Arena3D, type Arena3DHandle, type SceneFighter } from '@/game/scene';
import { useMatchEngine } from '@/game/engine';
import { useWaterReactions, type WaterActor } from '@/components/water/useWaterReactions';
import { useSplashEvents } from '@/game/vfx';
import { GameHud } from '@/components/hud/GameHud';
import { TouchControls } from '@/components/hud/TouchControls';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { useNavigation } from '@/state/NavigationContext';
import { useSettings } from '@/state/SettingsContext';
import { useDecks } from '@/state/DeckContext';
import { usePlayer } from '@/state/PlayerContext';

export interface MatchScreenProps {
  mode: GameMode;
  mapId: MapId;
  roomCode?: string;
}

const MATCH_DURATION_MS = 120_000;

/**
 * The match stage: arena behind, HUD in front, pause overlay on top.
 *
 * This screen is input and presentation only (ARCHITECTURE.md §3): it writes
 * intent into the engine's input ref and renders the snapshot back. No physics,
 * no damage, no AI here — those live in `@/game/engine`, which has no idea React
 * exists.
 */
export function MatchScreen({ mode, mapId, roomCode }: MatchScreenProps) {
  const { navigate, back } = useNavigation();
  const { settings } = useSettings();
  const { activeDeck } = useDecks();
  const { cardById, creditMatch } = usePlayer();
  const map = MAP_BY_ID[mapId];

  const [paused, setPaused] = useState(false);
  const arenaRef = useRef<Arena3DHandle | null>(null);

  const { snapshot, hud, cooldowns, inputRef, concede } = useMatchEngine({
    playerName: settings.playerName,
    opponentName: mode === 'localBots' ? 'Bot Alpha' : 'Challenger',
    deck: activeDeck,
    durationMs: MATCH_DURATION_MS,
    paused,
  });

  /** The equipped cards, for HUD labels and the touch pads. */
  const abilities = useMemo(() => {
    const equipped: Partial<Record<AbilitySlot, AbilityCard>> = {};
    for (const slot of SLOT_ORDER) {
      const card = cardById[activeDeck.cards[slot]];
      if (card) equipped[slot] = card;
    }
    return equipped;
  }, [activeDeck, cardById]);

  // --- Input ---------------------------------------------------------------
  // `dive` is a toggle in the UI but a held state in the engine, so the button
  // presses flip a local mirror that is written straight through.
  const [submerged, setSubmerged] = useState(false);
  useEffect(() => {
    inputRef.current.dive = submerged;
  }, [submerged, inputRef]);
  // The engine surfaces you when the lungs run out, so the button has to follow
  // the engine rather than the other way round.
  const engineSubmerged = hud.self.submerged;
  useEffect(() => {
    if (!engineSubmerged) setSubmerged(false);
  }, [engineSubmerged]);

  /** Keyboard: WASD/arrows move, Space charges, E kicks, Q ultimate, Shift dives. */
  const heldRef = useRef({ up: false, down: false, left: false, right: false });
  useEffect(() => {
    const applyMove = () => {
      const held = heldRef.current;
      inputRef.current.moveX = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      inputRef.current.moveY = (held.up ? 1 : 0) - (held.down ? 1 : 0);
    };
    const axis = (code: string): keyof typeof heldRef.current | null => {
      if (code === 'KeyW' || code === 'ArrowUp') return 'up';
      if (code === 'KeyS' || code === 'ArrowDown') return 'down';
      if (code === 'KeyA' || code === 'ArrowLeft') return 'left';
      if (code === 'KeyD' || code === 'ArrowRight') return 'right';
      return null;
    };

    const down = (event: KeyboardEvent) => {
      const key = axis(event.code);
      if (key) {
        event.preventDefault();
        heldRef.current[key] = true;
        applyMove();
        return;
      }
      if (event.repeat) return;
      if (event.code === 'Space') {
        event.preventDefault();
        inputRef.current.attack1 = true;
      }
      if (event.code === 'KeyE') inputRef.current.attack2 = true;
      if (event.code === 'KeyQ') inputRef.current.ultimate = true;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        setSubmerged((value) => !value);
      }
      if (event.code === 'Escape') setPaused((value) => !value);
    };

    const up = (event: KeyboardEvent) => {
      const key = axis(event.code);
      if (key) {
        heldRef.current[key] = false;
        applyMove();
        return;
      }
      if (event.code === 'Space') inputRef.current.attack1 = false;
    };

    // Losing focus mid-key would otherwise leave the fighter swimming into a
    // wall forever, since the keyup never arrives.
    const release = () => {
      heldRef.current = { up: false, down: false, left: false, right: false };
      applyMove();
      inputRef.current.attack1 = false;
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
    };
  }, [inputRef]);

  const onYawChange = useCallback(
    (yaw: number) => {
      inputRef.current.yaw = yaw;
    },
    [inputRef],
  );

  // --- Simulation -> scene -------------------------------------------------
  // The local player's facing is the camera's, so it is left undefined and the
  // scene derives it; the opponent carries a real world angle from the engine.
  const sceneFighters = useMemo<SceneFighter[]>(
    () =>
      snapshot.fighters.map((fighter) => ({
        id: fighter.id,
        x: fighter.x,
        y: fighter.y,
        facing: fighter.id === 'self' ? undefined : fighter.facing,
        animation: fighter.animation,
        submerged: fighter.submerged,
        isSelf: fighter.id === 'self',
        palette: { primary: fighter.colors.primary, accent: fighter.colors.secondary },
      })),
    [snapshot.fighters],
  );

  const actors = useMemo<WaterActor[]>(
    () => [
      ...snapshot.fighters.map((f) => ({
        id: f.id,
        x: f.x,
        y: f.y,
        submerged: f.submerged,
      })),
      ...snapshot.projectiles.map((p) => ({ id: `fx-${p.id}`, x: p.x, y: p.y })),
    ],
    [snapshot.fighters, snapshot.projectiles],
  );

  useWaterReactions(arenaRef, actors);
  useSplashEvents(arenaRef, arenaRef, snapshot.splashes);

  const endMatch = useCallback(
    (victory: boolean) => {
      // The rewards are *credited* here, not merely displayed: `creditMatch`
      // applies the gold (capped), the XP and any levels, and hands back the
      // outcome with the numbers it actually paid.
      const outcome = creditMatch(
        {
          victory,
          score: snapshot.score,
          durationMs: MATCH_DURATION_MS - snapshot.timeRemainingMs,
          stats: snapshot.stats,
          eloDelta: mode === 'online' ? (victory ? 18 : -14) : null,
        },
        mode,
      );
      navigate('result', { mode, mapId, outcome, roomCode }, 'scale');
    },
    [creditMatch, mapId, mode, navigate, roomCode, snapshot],
  );

  const finished = snapshot.finished;
  const victory = snapshot.victory;
  useEffect(() => {
    if (finished) endMatch(victory);
    // `endMatch` closes over the snapshot and changes every tick; depending on
    // it here would fire the navigation repeatedly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, victory]);

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <Arena3D
        map={map}
        fighters={sceneFighters}
        projectiles={snapshot.projectiles}
        onYawChange={onYawChange}
        className="absolute inset-0"
        ref={arenaRef}
      />

      <GameHud
        state={hud}
        ultimateName={abilities.ultimate?.name ?? 'Ultimate'}
        abilities={abilities}
        cooldowns={cooldowns}
        score={snapshot.score}
        showMinimap={settings.showMinimap}
        arenaAspect={map.size.width / map.size.depth}
        onPause={() => setPaused(true)}
        onActivateUltimate={() => {
          inputRef.current.ultimate = true;
        }}
      />

      {/* Touch layer — phones only; desktop uses the keyboard. */}
      <div className="md:hidden">
        <TouchControls
          submerged={hud.self.submerged}
          attackLabel={abilities.attack1?.name}
          kickLabel={abilities.attack2?.name}
          kickCooldown={cooldowns.attack2}
          mirrored={settings.leftHandedControls}
          onMove={(x, y) => {
            inputRef.current.moveX = x;
            // Screen-down is negative forward: pulling the stick toward you
            // swims away from the camera, not into it.
            inputRef.current.moveY = -y;
          }}
          onAttackDown={() => {
            inputRef.current.attack1 = true;
          }}
          onAttackUp={() => {
            inputRef.current.attack1 = false;
          }}
          onKick={() => {
            inputRef.current.attack2 = true;
          }}
          onDiveToggle={() => setSubmerged((value) => !value)}
        />
      </div>

      {/* Desktop key hints. */}
      <div className="text-mist/50 pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 translate-y-8 text-[9px] tracking-[0.14em] uppercase md:block">
        WASD move · drag to turn · Space {abilities.attack1?.name ?? 'attack'} · E{' '}
        {abilities.attack2?.name ?? 'attack 2'} · Q ultimate · Shift dive · Esc pause
      </div>

      {/* Between rounds. */}
      {snapshot.intermission && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="bg-abyss/85 pixel-border animate-pop-in px-6 py-4 text-center">
            <div className="text-surf text-lg tracking-[0.24em] uppercase">
              Round {snapshot.round.current}
            </div>
            <div className="text-mist/70 mt-1 text-[11px] tracking-[0.16em] uppercase">
              {snapshot.score.self} — {snapshot.score.opponent}
            </div>
          </div>
        </div>
      )}

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
              <div className="text-mist/60 flex items-center justify-between gap-2 text-[10px] tracking-[0.14em] uppercase">
                <span>{activeDeck.name}</span>
                <span>
                  {snapshot.score.self} — {snapshot.score.opponent}
                </span>
              </div>
              <PixelButton variant="primary" size="lg" fullWidth onClick={() => setPaused(false)}>
                Resume
              </PixelButton>
              <PixelButton variant="danger" size="md" fullWidth onClick={() => concede(false)}>
                Forfeit match
              </PixelButton>
              <PixelButton variant="ghost" size="md" fullWidth onClick={back}>
                Quit to menu
              </PixelButton>
            </div>
          </PixelPanel>
        </div>
      )}
    </div>
  );
}

