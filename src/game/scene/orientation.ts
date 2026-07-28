import type { Orientation } from '@/game/sprites';

/**
 * Picks which of the four authored sprite orientations to show (Block 3A).
 *
 * Billboards always face the camera, so "which way is this fighter facing" stops
 * being a world-space property and becomes a *relative* one: it depends on where
 * the camera is standing. Orbit the camera around a fighter who never turns and
 * you should still see them from the front, then the side, then the back.
 *
 * All angles are radians in the XZ plane, `atan2(z, x)`.
 */
export function orientationFor(facingAngle: number, cameraToFighterAngle: number): Orientation {
  const delta = wrapAngle(facingAngle - cameraToFighterAngle);
  const abs = Math.abs(delta);

  // Facing the same way the camera is looking → we are behind them.
  if (abs < Math.PI / 4) return 'back';
  // Facing back down the camera's line of sight → we see their face.
  if (abs > (Math.PI * 3) / 4) return 'front';

  // Side-on. `sin(delta)` is the fighter's facing projected onto the camera's
  // right vector, so positive means they face screen-right.
  return delta > 0 ? 'right' : 'left';
}

/** Wraps an angle into (-π, π]. */
export function wrapAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  let wrapped = angle % twoPi;
  if (wrapped > Math.PI) wrapped -= twoPi;
  if (wrapped <= -Math.PI) wrapped += twoPi;
  return wrapped;
}
