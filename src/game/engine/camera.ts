/**
 * Turning camera yaw into world movement (Block 3C).
 *
 * Pure maths, kept out of the React hook so it can be checked without a DOM —
 * a sign error in here is invisible by inspection and obvious under test.
 *
 * The camera sits behind the player looking along `(sin yaw, cos yaw)` in the
 * XZ plane (see `ArenaScene.updateCamera`), so:
 *
 * - **forward** is that vector, and
 * - **screen-right** is `cross(forward, up)` = `(-cos yaw, sin yaw)`.
 *
 * Deriving right rather than hard-coding a sign is what keeps pushing right on
 * the stick moving right on screen after the camera has been dragged a full
 * turn — the case where a guessed sign silently inverts.
 */

/** Screen-space input (`moveX` = strafe, `moveY` = forward) in world XZ. */
export function worldMove(moveX: number, moveY: number, yaw: number): { x: number; z: number } {
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  const rightX = -Math.cos(yaw);
  const rightZ = Math.sin(yaw);
  return {
    x: moveY * forwardX + moveX * rightX,
    z: moveY * forwardZ + moveX * rightZ,
  };
}

/**
 * The player's world facing, which *is* the camera's forward direction —
 * dragging the view turns the fighter, and the angle is never stored twice
 * (ARCHITECTURE.md §4.4).
 */
export function facingFromYaw(yaw: number): number {
  return Math.atan2(Math.cos(yaw), Math.sin(yaw));
}
