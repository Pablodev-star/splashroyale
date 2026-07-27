import { SpriteView, useSpriteAnimation, type AnimationId } from '@/game/sprites';
import { cn } from '@/lib/cn';

export type Facing = 'front' | 'left' | 'right' | 'back';

export interface FighterBillboardProps {
  colors: { primary: string; secondary: string };
  facing?: Facing;
  submerged?: boolean;
  /**
   * Which animation to play. Optional so callers that only track `submerged`
   * keep working; when omitted it is derived from `submerged`.
   */
  animation?: AnimationId;
  /** Normalised arena position, 0..1. */
  x: number;
  y: number;
  /** Extra scale on top of the depth-based perspective scale. */
  scale?: number;
  label?: string;
  className?: string;
}

/**
 * A billboard fighter: a sprite that always faces the camera, positioned in the
 * arena's normalised space with a depth cue.
 *
 * Block 2A replaced the CSS stand-in body with the real sprite system
 * (`@/game/sprites`) while keeping this component's props as the interface, so
 * Block 3 only has to feed it positions and an `AnimationId`.
 */
export function FighterBillboard({
  colors,
  facing = 'front',
  submerged = false,
  animation,
  x,
  y,
  scale = 1,
  label,
  className,
}: FighterBillboardProps) {
  // `dive` holds on its final frame, which is the underwater idle — so a
  // submerged fighter is just this animation parked at the end.
  const active: AnimationId = animation ?? (submerged ? 'dive' : 'idle');

  const frame = useSpriteAnimation({ animation: active });

  // Near the camera (y → 1) sprites are bigger: the pseudo-3D depth cue. Rounded
  // to whole pixels so the sprite never lands between them.
  const depthScale = Math.max(1, Math.round((0.72 + y * 0.5) * scale));

  return (
    <div
      className={cn('pointer-events-none absolute flex flex-col items-center', className)}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform: 'translate(-50%, -100%)',
        zIndex: Math.round(y * 100),
      }}
    >
      {/* Label sits outside the sprite so it stays legible at any depth. */}
      {label && (
        <span className="text-mist/85 text-pixel-shadow-sm mb-1 text-[9px] tracking-[0.14em] whitespace-nowrap uppercase">
          {label}
        </span>
      )}

      <SpriteView
        palette={{ primary: colors.primary, accent: colors.secondary }}
        orientation={facing}
        animation={active}
        frame={frame}
        scale={depthScale}
      />
    </div>
  );
}
