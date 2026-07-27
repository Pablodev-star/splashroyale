/**
 * Block 2A public surface.
 *
 * Block 3 drives fighters through exactly this: pick an `AnimationId` and an
 * `Orientation`, call `useSpriteAnimation` for the frame, hand both to
 * `SpriteView`. Nothing else in the sprite system is meant to be imported.
 */
export { SpriteView, type SpriteViewProps } from './SpriteView';
export { useSpriteAnimation, type SpriteAnimationOptions } from './useSpriteAnimation';
export { getSpriteSheet, type SpriteSheet } from './atlas';
export { ANIMATIONS, ANIMATION_IDS, animationDurationMs, restFrame } from './animations';
export { validateRig, type SpritePalette } from './rig';
export {
  CELL_HEIGHT,
  CELL_WIDTH,
  type AnimationId,
  type Orientation,
  type PaletteKey,
} from './types';
