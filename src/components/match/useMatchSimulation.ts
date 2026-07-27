import { useRef, useState } from 'react';
import type { HudState, MinimapEntity } from '@/types/game';
import { useAnimationFrame } from '@/hooks/useAnimationFrame';
import type { ArenaFighter } from './ArenaView';
import { CHARACTERS } from '@/data/characters';

/**
 * PLACEHOLDER(Block 3): a scripted stand-in for the match engine.
 *
 * It exists so the HUD, the arena framing and the result flow can be built and
 * reviewed before any physics exists. It produces exactly the `HudState` that
 * Block 3 must produce (ARCHITECTURE.md §4.1), so swapping it out is a one-line
 * change in `MatchScreen`. No collision, no damage model, no AI here — on
 * purpose.
 */

export interface MatchSimulationOptions {
  playerName: string;
  opponentName: string;
  durationMs: number;
  paused: boolean;
  /** Demo input: true while the attack key/pad is held. */
  charging: boolean;
  /** Demo input: player-controlled dive toggle. */
  submerged: boolean;
}

export interface MatchSimulationResult {
  hud: HudState;
  fighters: ArenaFighter[];
  projectiles: MinimapEntity[];
  finished: boolean;
}

const OXYGEN_DRAIN_PER_SEC = 0.14;
const OXYGEN_REGEN_PER_SEC = 0.3;
const ULTIMATE_GAIN_PER_SEC = 0.045;
const CHARGE_RATE_PER_SEC = 0.55;

export function useMatchSimulation({
  playerName,
  opponentName,
  durationMs,
  paused,
  charging,
  submerged,
}: MatchSimulationOptions): MatchSimulationResult {
  const [self] = CHARACTERS;
  const opponentCharacter = CHARACTERS[1];

  const stateRef = useRef({
    elapsed: 0,
    selfHealth: 1,
    opponentHealth: 1,
    selfOxygen: 1,
    opponentOxygen: 1,
    selfCharge: 0,
    selfUltimate: 0.35,
    opponentUltimate: 0.2,
    opponentSubmerged: false,
  });

  const [, forceRender] = useState(0);

  useAnimationFrame(
    (_elapsed, delta) => {
      const state = stateRef.current;
      // Accumulate rather than read the loop clock: pausing tears the loop down
      // and would otherwise rewind the match timer.
      state.elapsed = Math.min(state.elapsed + delta, durationMs / 1000);
      const elapsed = state.elapsed;

      // Charge builds while the attack input is held and the player is above water.
      state.selfCharge =
        charging && !submerged
          ? Math.min(1, state.selfCharge + delta * CHARGE_RATE_PER_SEC)
          : Math.max(0, state.selfCharge - delta * 2.5);

      // Oxygen: drains under water, regenerates at the surface.
      state.selfOxygen = submerged
        ? Math.max(0, state.selfOxygen - delta * OXYGEN_DRAIN_PER_SEC)
        : Math.min(1, state.selfOxygen + delta * OXYGEN_REGEN_PER_SEC);

      // The scripted opponent dives on a loop.
      state.opponentSubmerged = Math.sin(elapsed * 0.45) > 0.55;
      state.opponentOxygen = state.opponentSubmerged
        ? Math.max(0, state.opponentOxygen - delta * OXYGEN_DRAIN_PER_SEC)
        : Math.min(1, state.opponentOxygen + delta * OXYGEN_REGEN_PER_SEC);

      // Health drifts down on both sides so the bars are never static.
      state.selfHealth = Math.max(0.08, state.selfHealth - delta * 0.012);
      state.opponentHealth = Math.max(0.05, state.opponentHealth - delta * 0.02);

      state.selfUltimate = Math.min(1, state.selfUltimate + delta * ULTIMATE_GAIN_PER_SEC);
      state.opponentUltimate = Math.min(
        1,
        state.opponentUltimate + delta * ULTIMATE_GAIN_PER_SEC * 0.7,
      );

      forceRender((tick) => tick + 1);
    },
    { fps: 30, paused },
  );

  const state = stateRef.current;
  const t = state.elapsed;

  // Scripted movement: two fighters circling each other in the pool.
  const selfX = 0.34 + Math.sin(t * 0.6) * 0.1;
  const selfY = 0.62 + Math.sin(t * 0.9) * 0.12;
  const opponentX = 0.66 + Math.cos(t * 0.5) * 0.1;
  const opponentY = 0.5 + Math.cos(t * 0.8) * 0.14;

  const projectiles: MinimapEntity[] = [
    {
      id: 'p1',
      x: Math.min(0.95, selfX + ((t * 0.35) % 1) * 0.45),
      y: selfY - 0.06,
      kind: 'projectile',
    },
  ];

  const hud: HudState = {
    self: {
      name: playerName,
      health: state.selfHealth,
      oxygen: state.selfOxygen,
      submerged,
      charge: state.selfCharge,
      ultimate: state.selfUltimate,
      tag: 'You',
    },
    opponent: {
      name: opponentName,
      health: state.opponentHealth,
      oxygen: state.opponentOxygen,
      submerged: state.opponentSubmerged,
      charge: 0,
      ultimate: state.opponentUltimate,
      tag: 'Bot',
    },
    timeRemainingMs: Math.max(0, durationMs - t * 1000),
    round: { current: 1, total: 3 },
    entities: [
      { id: 'self', x: selfX, y: selfY, kind: 'self', submerged },
      {
        id: 'opponent',
        x: opponentX,
        y: opponentY,
        kind: 'opponent',
        submerged: state.opponentSubmerged,
      },
      ...projectiles,
    ],
  };

  const fighters: ArenaFighter[] = [
    {
      id: 'self',
      x: selfX,
      y: selfY,
      facing: opponentX > selfX ? 'right' : 'left',
      submerged,
      label: playerName,
      colors: self.colors,
    },
    {
      id: 'opponent',
      x: opponentX,
      y: opponentY,
      facing: selfX > opponentX ? 'right' : 'left',
      submerged: state.opponentSubmerged,
      label: opponentName,
      colors: opponentCharacter.colors,
    },
  ];

  return {
    hud,
    fighters,
    projectiles,
    finished: hud.timeRemainingMs <= 0,
  };
}
