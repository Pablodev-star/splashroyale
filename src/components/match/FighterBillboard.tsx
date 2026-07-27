import { cn } from '@/lib/cn';

export type Facing = 'front' | 'left' | 'right' | 'back';

export interface FighterBillboardProps {
  colors: { primary: string; secondary: string };
  facing?: Facing;
  submerged?: boolean;
  /** Normalised arena position, 0..1. */
  x: number;
  y: number;
  /** Extra scale on top of the depth-based perspective scale. */
  scale?: number;
  label?: string;
  className?: string;
}

/**
 * PLACEHOLDER(Block 2A): a CSS stand-in for the real billboard sprite so the HUD
 * and arena framing can be reviewed now. Block 2A replaces the body with the
 * character spritesheet (4 orientations × 7 animations) but keeps this component's
 * props — position, facing, submerged — as the interface.
 *
 * The figure is laid out on a 24×40 "pixel" grid and scaled as a whole, so every
 * part stays on the same integer pixel grid (STYLEGUIDE §3.4).
 */
export function FighterBillboard({
  colors,
  facing = 'front',
  submerged = false,
  x,
  y,
  scale = 1,
  label,
  className,
}: FighterBillboardProps) {
  // Near the camera (y → 1) sprites are bigger: the pseudo-3D depth cue.
  const depthScale = (0.72 + y * 0.5) * scale;
  const flip = facing === 'left';

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
      {/* Label sits outside the scaled body so it stays legible at any depth. */}
      {label && (
        <span className="text-mist/85 text-pixel-shadow-sm mb-1 text-[9px] tracking-[0.14em] whitespace-nowrap uppercase">
          {label}
        </span>
      )}

      {/* The wrapper carries the *scaled* size so the label above it is never
          overlapped by the sprite (scale alone does not affect layout). */}
      <div
        className={cn('relative', !submerged && 'animate-bob')}
        style={{
          width: (submerged ? 28 : 24) * depthScale,
          height: (submerged ? 12 : 40) * depthScale,
          animationDuration: '2.8s',
        }}
      >
        <div
          className="absolute top-0 left-0"
          style={{
            transform: `scale(${depthScale})`,
            transformOrigin: 'top left',
          }}
        >
          {submerged ? (
            // Submerged: only a ripple ring plus rising bubbles break the surface.
            <div className="relative h-[12px] w-[28px]">
              <span className="border-foam/80 absolute inset-x-0 top-[4px] h-[8px] border-2" />
              <span className="bg-foam/70 animate-bob absolute top-0 left-[6px] h-[2px] w-[2px]" />
              <span className="bg-foam/50 animate-bob-slow absolute top-[2px] left-[18px] h-[2px] w-[2px]" />
            </div>
          ) : (
            <div className={cn('relative h-[40px] w-[24px]', flip && 'scale-x-[-1]')}>
              {/* hair / cap */}
              <span
                className="absolute top-0 left-[7px] h-[3px] w-[10px]"
                style={{ background: colors.secondary }}
              />
              {/* head */}
              <span className="absolute top-[3px] left-[7px] h-[8px] w-[10px] bg-[#f2c9a0]" />
              {/* eyes — hidden when facing away, which is how the sprite reads direction */}
              {facing !== 'back' && (
                <>
                  <span
                    className="bg-abyss absolute top-[6px] h-[2px] w-[2px]"
                    style={{ left: facing === 'front' ? '9px' : '13px' }}
                  />
                  {facing === 'front' && (
                    <span className="bg-abyss absolute top-[6px] left-[13px] h-[2px] w-[2px]" />
                  )}
                </>
              )}
              {/* torso */}
              <span
                className="absolute top-[11px] left-[5px] h-[11px] w-[14px]"
                style={{ background: colors.primary }}
              />
              {/* arms */}
              {facing !== 'right' && (
                <span className="absolute top-[12px] left-[2px] h-[8px] w-[3px] bg-[#f2c9a0]" />
              )}
              {facing !== 'left' && (
                <span className="absolute top-[12px] left-[19px] h-[8px] w-[3px] bg-[#f2c9a0]" />
              )}
              {/* waterline foam */}
              <span className="bg-foam absolute top-[21px] left-[-3px] h-[2px] w-[30px]" />
              {/* refracted lower body under the surface */}
              <span
                className="absolute top-[23px] left-[6px] h-[10px] w-[12px] opacity-60"
                style={{ background: colors.primary }}
              />
              <span className="bg-oxygen/30 absolute top-[23px] left-[-1px] h-[12px] w-[26px]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
