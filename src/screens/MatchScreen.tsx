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
import { KeyboardHints } from '@/components/hud/KeyboardHints';
import { isBound, moveAxisFor } from '@/game/input/keybinds';
import { useInputMode } from '@/hooks/useInputMode';
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
  const touch = useInputMode() === 'touch';

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

  /**
   * Keyboard input. Every binding comes from `KEYBINDS` rather than being
   * spelled out here, so the caps drawn in the HUD and the codes tested below
   * are one source — they used to be two, and only one of them was edited when
   * a binding changed.
   */
  const heldRef = useRef({ up: false, down: false, left: false, right: false });
  useEffect(() => {
    const applyMove = () => {
      const held = heldRef.current;
      inputRef.current.moveX = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      inputRef.current.moveY = (held.up ? 1 : 0) - (held.down ? 1 : 0);
    };

    const down = (event: KeyboardEvent) => {
      const axis = moveAxisFor(event.code);
      if (axis) {
        event.preventDefault();
        heldRef.current[axis] = true;
        applyMove();
        return;
      }
      if (event.repeat) return;
      if (isBound('attack1', event.code)) {
        event.preventDefault();
        inputRef.current.attack1 = true;
      }
      if (isBound('attack2', event.code)) inputRef.current.attack2 = true;
      if (isBound('ultimate', event.code)) inputRef.current.ultimate = true;
      if (isBound('dive', event.code)) setSubmerged((value) => !value);
      if (isBound('pause', event.code)) setPaused((value) => !value);
    };

    const up = (event: KeyboardEvent) => {
      const axis = moveAxisFor(event.code);
      if (axis) {
        heldRef.current[axis] = false;
        applyMove();
        return;
      }
      if (isBound('attack1', event.code)) inputRef.current.attack1 = false;
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
        touch={touch}
        onPause={() => setPaused(true)}
        onActivateUltimate={() => {
          inputRef.current.ultimate = true;
        }}
      />

      {/* Touch layer. Gated on what the device can actually do, never on how
          wide it is: a landscape tablet is wider than any phone breakpoint but
          has no keyboard, and hiding the pads there left it with no way to
          move at all. See `useInputMode`. */}
      {touch && (
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
      )}

      {/* Keyboard hints. Same gate, inverted — exactly one surface is shown. */}
      {!touch && <KeyboardHints abilities={abilities} />}

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

