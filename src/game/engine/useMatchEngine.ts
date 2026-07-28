import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AbilitySlot, Deck, HudState } from '@/types/game';
import { CARD_BY_ID, SLOT_ORDER } from '@/data/cards';
import { BOT_DECK, sanitiseDeck } from '@/data/decks';
import { CHARACTERS } from '@/data/characters';
import { useAnimationFrame } from '@/hooks/useAnimationFrame';
import { MatchEngine } from './MatchEngine';
import { Bot } from './bot';
import { facingFromYaw, worldMove } from './camera';
import { IDLE_INTENT, type EngineSnapshot, type Intent, type Loadout } from './types';

/**
 * Drives the match engine from React (Block 3C).
 *
 * The engine is the authority and it is not React state: it lives in a ref and
 * is stepped by the animation loop. What React re-renders on is one snapshot per
 * tick, which is what the HUD, the 3D scene and the splash layer already
 * consume. Routing the simulation itself through state would re-render the
 * entire HUD tree on every physics step.
 */

/** Live input, written by the match screen and read by the loop. */
export interface PlayerInput {
  /** Strafe, -1 (left) .. 1 (right), in screen space. */
  moveX: number;
  /** Forward, -1 (back) .. 1 (forward), in screen space. */
  moveY: number;
  /** Camera yaw — also the player's facing. */
  yaw: number;
  /** Held. Attack 1 charges while this is true and fires when it goes false. */
  attack1: boolean;
  /**
   * One-shot triggers. Set them true; the loop consumes and clears them on the
   * next tick. The engine fires these on a rising edge, so a flag left true
   * across frames would fire exactly once and then never again — clearing here
   * is what makes "press the kick pad twice" work.
   */
  attack2: boolean;
  ultimate: boolean;
  /** Desired submerged state, held. */
  dive: boolean;
}

export const EMPTY_INPUT: PlayerInput = {
  moveX: 0,
  moveY: 0,
  yaw: 0,
  attack1: false,
  attack2: false,
  ultimate: false,
  dive: false,
};

export interface MatchEngineOptions {
  playerName: string;
  opponentName: string;
  deck: Deck;
  durationMs: number;
  paused: boolean;
  /** Bots only in local play; online opponents arrive with Block 6. */
  withBot?: boolean;
}

function loadoutFor(deck: Deck): Loadout {
  const safe = sanitiseDeck(deck) ?? deck;
  return {
    attack1: CARD_BY_ID[safe.cards.attack1],
    attack2: CARD_BY_ID[safe.cards.attack2],
    ultimate: CARD_BY_ID[safe.cards.ultimate],
  };
}

export interface MatchEngineResult {
  snapshot: EngineSnapshot;
  hud: HudState;
  /** Seconds left on each equipped ability, for the HUD. */
  cooldowns: Record<AbilitySlot, number>;
  /** Write live input here; the loop reads it without re-rendering. */
  inputRef: React.RefObject<PlayerInput>;
  /** Ends the match immediately with a chosen result (pause-menu shortcuts). */
  concede: (victory: boolean) => void;
}

export function useMatchEngine({
  playerName,
  opponentName,
  deck,
  durationMs,
  paused,
  withBot = true,
}: MatchEngineOptions): MatchEngineResult {
  const inputRef = useRef<PlayerInput>({ ...EMPTY_INPUT });
  const botRef = useRef<Bot>(new Bot());

  // The deck is captured once per match. Re-reading it every frame would let a
  // deck edited in another tab change the moveset mid-fight.
  const engine = useMemo(() => {
    const [player, rival] = CHARACTERS;
    return new MatchEngine({
      self: {
        id: 'self',
        name: playerName,
        tag: 'You',
        colors: player.colors,
        loadout: loadoutFor(deck),
      },
      opponent: {
        id: 'opponent',
        name: opponentName,
        tag: withBot ? 'Bot' : 'Rival',
        colors: rival.colors,
        loadout: loadoutFor(BOT_DECK),
      },
      durationMs,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one engine per match.
  }, []);

  const [snapshot, setSnapshot] = useState<EngineSnapshot>(() => engine.snapshot());
  const [forcedResult, setForcedResult] = useState<boolean | null>(null);

  useAnimationFrame(
    (_elapsed, delta) => {
      const input = inputRef.current;
      const self = engine.getFighter('self');
      const opponent = engine.getFighter('opponent');
      const move = worldMove(input.moveX, input.moveY, input.yaw);

      const selfIntent: Intent = {
        moveX: move.x,
        moveZ: move.z,
        facing: facingFromYaw(input.yaw),
        attack1: input.attack1,
        attack2: input.attack2,
        ultimate: input.ultimate,
        dive: input.dive,
      };
      // Consumed: see `PlayerInput`. Held inputs (attack1, dive, movement) stay.
      input.attack2 = false;
      input.ultimate = false;

      const opponentIntent = withBot
        ? botRef.current.update(delta, opponent, self)
        : { ...IDLE_INTENT, facing: Math.atan2(self.z - opponent.z, self.x - opponent.x) };

      engine.step(delta, { self: selfIntent, opponent: opponentIntent });
      setSnapshot(engine.snapshot());
    },
    { fps: 60, paused },
  );

  const concede = useCallback((victory: boolean) => setForcedResult(victory), []);

  // Cooldowns are read off the engine rather than the snapshot: they are HUD
  // decoration, and putting three more numbers in the snapshot would mean
  // re-deriving them for the scene and the minimap that never use them.
  const cooldowns = useMemo(() => {
    const out = {} as Record<AbilitySlot, number>;
    for (const slot of SLOT_ORDER) out[slot] = engine.cooldownFor('self', slot);
    return out;
    // Recomputed with every snapshot — that is the tick.
  }, [engine, snapshot]);

  const hud = useMemo<HudState>(() => {
    const self = snapshot.fighters.find((f) => f.id === 'self')!;
    const opponent = snapshot.fighters.find((f) => f.id === 'opponent')!;
    return {
      self: {
        name: self.name,
        health: self.health,
        oxygen: self.oxygen,
        submerged: self.submerged,
        charge: self.charge,
        ultimate: self.ultimate,
        tag: self.tag,
      },
      opponent: {
        name: opponent.name,
        health: opponent.health,
        oxygen: opponent.oxygen,
        submerged: opponent.submerged,
        charge: opponent.charge,
        ultimate: opponent.ultimate,
        tag: opponent.tag,
      },
      timeRemainingMs: snapshot.timeRemainingMs,
      round: snapshot.round,
      entities: [
        { id: 'self', x: self.x, y: self.y, kind: 'self', submerged: self.submerged },
        {
          id: 'opponent',
          x: opponent.x,
          y: opponent.y,
          kind: 'opponent',
          submerged: opponent.submerged,
        },
        ...snapshot.projectiles.map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          kind: 'projectile' as const,
        })),
      ],
    };
  }, [snapshot]);

  // Releasing every held input when the match pauses. Without this, pausing
  // mid-charge leaves the button logically down and the charge fires the
  // instant play resumes.
  useEffect(() => {
    if (!paused) return;
    inputRef.current.attack1 = false;
    inputRef.current.attack2 = false;
    inputRef.current.ultimate = false;
    inputRef.current.moveX = 0;
    inputRef.current.moveY = 0;
  }, [paused]);

  return {
    snapshot:
      forcedResult === null
        ? snapshot
        : { ...snapshot, finished: true, victory: forcedResult },
    hud,
    cooldowns,
    inputRef,
    concede,
  };
}
