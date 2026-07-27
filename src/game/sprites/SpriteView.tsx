import { useMemo } from 'react';
import { getSpriteSheet } from './atlas';
import type { SpritePalette } from './rig';
import { CELL_HEIGHT, CELL_WIDTH, type AnimationId, type Orientation } from './types';
import { cn } from '@/lib/cn';

export interface SpriteViewProps {
  palette: SpritePalette;
  orientation: Orientation;
  animation: AnimationId;
  /** Frame index, normally from `useSpriteAnimation`. */
  frame: number;
  /** Whole-number scale. Fractional scales would blur the pixel grid. */
  scale?: number;
  className?: string;
}

/**
 * Draws one sprite frame (Block 2A).
 *
 * The baked atlas is used as a CSS sprite sheet: changing frame is a
 * `background-position` change, so no canvas work happens per frame and the
 * browser composites it on the GPU. `image-rendering: pixelated` keeps the
 * upscale hard-edged.
 */
export function SpriteView({
  palette,
  orientation,
  animation,
  frame,
  scale = 1,
  className,
}: SpriteViewProps) {
  // Baking touches the DOM, so it cannot run during SSR — this app is
  // client-rendered, but the guard keeps the component safe to import anywhere.
  const sheet = useMemo(
    () => (typeof document === 'undefined' ? null : getSpriteSheet(palette)),
    [palette],
  );

  if (!sheet) return null;

  const origin = sheet.frameOrigin(orientation, animation, frame);

  return (
    <div
      aria-hidden
      className={cn('bg-no-repeat', className)}
      style={{
        width: CELL_WIDTH * scale,
        height: CELL_HEIGHT * scale,
        backgroundImage: `url(${sheet.url})`,
        backgroundSize: `${sheet.width * scale}px ${sheet.height * scale}px`,
        backgroundPosition: `-${origin.x * scale}px -${origin.y * scale}px`,
        imageRendering: 'pixelated',
      }}
    />
  );
}
