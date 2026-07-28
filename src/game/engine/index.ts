/**
 * Block 3C public surface.
 *
 * The match screen drives exactly this: hand `useMatchEngine` the equipped deck,
 * write input into `inputRef`, render the snapshot. The engine, the bot and the
 * tuning table are internal — a screen that reaches past this is doing
 * simulation work in the UI layer, which ARCHITECTURE.md §3 forbids.
 */
export {
  useMatchEngine,
  EMPTY_INPUT,
  type PlayerInput,
  type MatchEngineResult,
} from './useMatchEngine';
export { worldMove, facingFromYaw } from './camera';
export type { EngineSnapshot, SnapshotFighter, SnapshotProjectile } from './types';
export { ARENA } from './tuning';
