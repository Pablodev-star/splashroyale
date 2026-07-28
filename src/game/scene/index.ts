/**
 * Block 3A public surface — the 3D arena.
 *
 * Block 3C drives this: hand it fighters in normalised arena coordinates with
 * an `AnimationId` each, and read the camera yaw back as the local player's
 * facing direction.
 */
export { Arena3D, type Arena3DHandle, type Arena3DProps } from './Arena3D';
export { ArenaScene, ARENA_SIZE, type SceneFighter, type ArenaSceneOptions } from './ArenaScene';
export { orientationFor, wrapAngle } from './orientation';
