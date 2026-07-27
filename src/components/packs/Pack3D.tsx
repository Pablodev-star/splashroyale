import type { CSSProperties } from 'react';
import type { Pack, PackTier } from '@/types/game';
import { RARITY_LABEL } from '@/data/cards';
import { cn } from '@/lib/cn';

export interface Pack3DProps {
  pack: Pack;
  /** `hero` is the full preview; `tile` is the small shop-grid version. */
  size?: 'hero' | 'tile';
  /** Continuous Y rotation. Off for static thumbnails. */
  spin?: boolean;
  /** Ambient effects behind the pack, scaled by tier. */
  effects?: boolean;
  className?: string;
}

interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

const SIZES: Record<'hero' | 'tile', Dimensions> = {
  hero: { width: 264, height: 370, depth: 30 },
  tile: { width: 104, height: 146, depth: 14 },
};

/** How much spectacle each tier gets. */
const TIER_FX: Record<
  PackTier,
  { rays: boolean; rainbow: boolean; sparks: number; orbits: number }
> = {
  standard: { rays: false, rainbow: false, sparks: 0, orbits: 0 },
  premium: { rays: false, rainbow: false, sparks: 4, orbits: 0 },
  elite: { rays: true, rainbow: false, sparks: 7, orbits: 2 },
  mythic: { rays: true, rainbow: true, sparks: 11, orbits: 4 },
};

/**
 * A card pack rendered as a real 3D object: it levitates, rotates on its Y axis
 * and shows a distinct front and back face, with tier-scaled effects orbiting
 * behind it.
 *
 * Built from flat-filled faces with hard edges so it still reads as pixel art
 * while it turns (STYLEGUIDE §3).
 */
export function Pack3D({
  pack,
  size = 'hero',
  spin = true,
  effects = true,
  className,
}: Pack3DProps) {
  const dim = SIZES[size];
  const fx = TIER_FX[pack.tier];
  const half = dim.depth / 2;
  /** Black outline width, scaled down with the pack so tiles keep a 1px stroke. */
  const edge = Math.max(1, Math.round(2 * (dim.width / SIZES.hero.width)));

  return (
    <div
      className={cn('scene-3d relative flex items-center justify-center', className)}
      style={{ width: dim.width * 2, height: dim.height * 1.5 }}
    >
      {effects && <PackEffects pack={pack} fx={fx} dim={dim} />}

      {/* Levitation is applied on a wrapper so it composes with the spin. */}
      <div className="animate-levitate relative" style={{ transformStyle: 'preserve-3d' }}>
        <div
          className={cn('preserve-3d relative', spin && 'animate-spin-y')}
          style={{ width: dim.width, height: dim.height }}
        >
          {/* Front */}
          <div
            className="backface-hidden absolute inset-0"
            style={{ transform: `translateZ(${half}px)` }}
          >
            <PackFaceFront pack={pack} dim={dim} />
          </div>

          {/* Back */}
          <div
            className="backface-hidden absolute inset-0"
            style={{ transform: `rotateY(180deg) translateZ(${half}px)` }}
          >
            <PackFaceBack pack={pack} dim={dim} />
          </div>

          {/* Side faces. Each one is anchored on the axis it sits on and pulled
              back to the box centre by half its own thickness, so `translateZ`
              pushes it out to exactly the edge it belongs to. Anchoring a face on
              the opposite side (e.g. the bottom face on `top-1/2`) lands it a full
              `depth` past its edge, leaving it detached and floating. */}
          <div
            className="absolute inset-y-0 right-1/2"
            style={{
              width: dim.depth,
              transform: `translateX(50%) rotateY(-90deg) translateZ(${dim.width / 2}px)`,
              background: pack.art.shade,
              boxShadow: `0 0 0 ${edge}px var(--color-abyss), inset 1px 0 0 rgb(255 255 255 / 0.18), inset -1px 0 0 rgb(0 0 0 / 0.4)`,
            }}
          />
          <div
            className="absolute inset-y-0 left-1/2"
            style={{
              width: dim.depth,
              transform: `translateX(-50%) rotateY(90deg) translateZ(${dim.width / 2}px)`,
              background: pack.art.shade,
              boxShadow: `0 0 0 ${edge}px var(--color-abyss), inset 1px 0 0 rgb(255 255 255 / 0.18), inset -1px 0 0 rgb(0 0 0 / 0.4)`,
            }}
          />
          <div
            className="absolute inset-x-0 top-1/2"
            style={{
              height: dim.depth,
              transform: `translateY(-50%) rotateX(90deg) translateZ(${dim.height / 2}px)`,
              background: pack.art.shade,
              boxShadow: `0 0 0 ${edge}px var(--color-abyss), inset 0 1px 0 rgb(255 255 255 / 0.18), inset 0 -1px 0 rgb(0 0 0 / 0.4)`,
            }}
          />
          <div
            className="absolute inset-x-0 bottom-1/2"
            style={{
              height: dim.depth,
              transform: `translateY(50%) rotateX(-90deg) translateZ(${dim.height / 2}px)`,
              background: pack.art.shade,
              boxShadow: `0 0 0 ${edge}px var(--color-abyss), inset 0 1px 0 rgb(0 0 0 / 0.4), inset 0 -1px 0 rgb(255 255 255 / 0.12)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Faces                                                                      */
/* -------------------------------------------------------------------------- */

function PackFaceFront({ pack, dim }: { pack: Pack; dim: Dimensions }) {
  const scale = dim.width / SIZES.hero.width;
  const px = (value: number) => Math.max(1, Math.round(value * scale));

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: pack.art.base,
        boxShadow: `0 0 0 ${px(3)}px var(--color-abyss), inset ${px(3)}px ${px(3)}px 0 rgb(255 255 255 / 0.22), inset -${px(3)}px -${px(3)}px 0 rgb(0 0 0 / 0.3)`,
      }}
    >
      <TearStrip color={pack.art.shade} scale={scale} />

      {/* Brand line */}
      <div
        className="relative z-10 text-center font-bold tracking-[0.24em] uppercase"
        style={{
          color: pack.art.accent,
          fontSize: px(9),
          paddingTop: px(15),
          paddingBottom: px(5),
          textShadow: `${px(2)}px ${px(2)}px 0 rgb(0 0 0 / 0.55)`,
        }}
      >
        Splash Royale
      </div>

      {/* Emblem well with concentric pixel ripples behind it. */}
      <div className="relative z-10 flex flex-1 items-center justify-center">
        {[0, 1, 2].map((ring) => (
          <span
            key={ring}
            aria-hidden
            className="absolute"
            style={{
              width: px(58 + ring * 34),
              height: px(58 + ring * 34),
              border: `${px(3)}px solid ${pack.art.accent}`,
              opacity: 0.16 + (2 - ring) * 0.07,
            }}
          />
        ))}
        <span
          className="relative leading-none"
          style={{
            color: pack.art.accent,
            fontSize: px(72),
            textShadow: `${px(3)}px ${px(3)}px 0 rgb(0 0 0 / 0.45)`,
          }}
        >
          {pack.art.emblem}
        </span>
      </div>

      {/* Name band */}
      <div
        className="relative z-10 text-center"
        style={{ background: pack.art.shade, paddingBlock: px(7) }}
      >
        <div
          className="font-bold tracking-[0.14em] uppercase"
          style={{
            color: '#ffffff',
            fontSize: px(12),
            textShadow: `${px(2)}px ${px(2)}px 0 rgb(0 0 0 / 0.5)`,
          }}
        >
          {pack.name}
        </div>
        <div
          className="tracking-[0.2em] uppercase"
          style={{ color: pack.art.accent, fontSize: px(7), marginTop: px(2) }}
        >
          {pack.cardCount} cards
        </div>
      </div>

      {/* Foil sheen sweeping across the wrapper. */}
      <span
        aria-hidden
        className={cn(
          'animate-holo pointer-events-none absolute inset-0 z-20',
          pack.tier === 'mythic' ? 'holo-sheen-rainbow' : 'holo-sheen',
        )}
        style={{ opacity: pack.tier === 'standard' ? 0.28 : 0.6 }}
      />
    </div>
  );
}

function PackFaceBack({ pack, dim }: { pack: Pack; dim: Dimensions }) {
  const scale = dim.width / SIZES.hero.width;
  const px = (value: number) => Math.max(1, Math.round(value * scale));

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{
        background: pack.art.shade,
        boxShadow: `0 0 0 ${px(3)}px var(--color-abyss), inset ${px(3)}px ${px(3)}px 0 rgb(255 255 255 / 0.12), inset -${px(3)}px -${px(3)}px 0 rgb(0 0 0 / 0.35)`,
      }}
    >
      {/* Repeating emblem lattice. */}
      <div
        aria-hidden
        className="absolute inset-0 grid opacity-20"
        style={{
          gridTemplateColumns: `repeat(4, 1fr)`,
          gridAutoRows: `${px(46)}px`,
          color: pack.art.base,
          fontSize: px(18),
        }}
      >
        {Array.from({ length: 28 }, (_, index) => (
          <span key={index} className="flex items-center justify-center leading-none">
            {pack.art.emblem}
          </span>
        ))}
      </div>

      <TearStrip color={pack.art.base} scale={scale} />

      <div className="relative z-10 flex flex-col items-center" style={{ gap: px(8) }}>
        {/* Pixel wordmark bars */}
        <div className="flex items-center" style={{ gap: px(3) }}>
          <span style={{ width: px(26), height: px(4), background: pack.art.base }} />
          <span style={{ width: px(8), height: px(4), background: pack.art.accent }} />
          <span style={{ width: px(26), height: px(4), background: pack.art.base }} />
        </div>
        <div
          className="font-bold tracking-[0.22em] uppercase"
          style={{ color: pack.art.accent, fontSize: px(11) }}
        >
          Card Pack
        </div>
        <div
          className="text-center tracking-[0.16em] uppercase"
          style={{ color: pack.art.base, fontSize: px(8), paddingInline: px(14) }}
        >
          {RARITY_LABEL[pack.guaranteed]} or better guaranteed
        </div>
      </div>

      <span
        aria-hidden
        className="animate-holo holo-sheen pointer-events-none absolute inset-0 z-20 opacity-30"
      />
    </div>
  );
}

/** Serrated pixel tear strip along the top of a wrapper. */
function TearStrip({ color, scale }: { color: string; scale: number }) {
  const px = (value: number) => Math.max(1, Math.round(value * scale));
  return (
    <div aria-hidden className="absolute inset-x-0 top-0 z-10 flex" style={{ height: px(10) }}>
      {Array.from({ length: 16 }, (_, index) => (
        <span
          key={index}
          className="flex-1"
          style={{ background: color, marginTop: index % 2 === 0 ? 0 : px(5) }}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Ambient effects                                                            */
/* -------------------------------------------------------------------------- */

function PackEffects({
  pack,
  fx,
  dim,
}: {
  pack: Pack;
  fx: (typeof TIER_FX)[PackTier];
  dim: Dimensions;
}) {
  const orbitRadius = dim.width * 0.72;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {/* Aura behind the pack. */}
      <span
        className="animate-aura absolute"
        style={{
          width: dim.width * 1.35,
          height: dim.width * 1.35,
          background: fx.rainbow ? undefined : pack.art.base,
          opacity: 0.22,
          filter: 'blur(38px)',
          animationName: fx.rainbow ? 'rainbow-fill, aura' : undefined,
          animationDuration: fx.rainbow ? '4s, 2.2s' : undefined,
          animationTimingFunction: fx.rainbow ? 'linear, ease-in-out' : undefined,
          animationIterationCount: fx.rainbow ? 'infinite, infinite' : undefined,
        }}
      />

      {/* Rotating light rays. */}
      {fx.rays && (
        <>
          <span
            className="animate-ray-spin absolute"
            style={{ width: dim.width * 2, height: dim.width * 2 }}
          >
            {Array.from({ length: 8 }, (_, index) => (
              <span
                key={index}
                className="absolute top-1/2 left-1/2 origin-left"
                style={{
                  width: dim.width * 1.15,
                  height: 4,
                  background: fx.rainbow ? '#ffffff' : pack.art.base,
                  opacity: 0.28,
                  transform: `rotate(${index * 45}deg)`,
                }}
              />
            ))}
          </span>
          {fx.rainbow && (
            <span
              className="animate-ray-spin-fast absolute"
              style={{ width: dim.width * 1.7, height: dim.width * 1.7 }}
            >
              {Array.from({ length: 6 }, (_, index) => (
                <span
                  key={index}
                  className="animate-rainbow-frame absolute top-1/2 left-1/2 origin-left"
                  style={{
                    width: dim.width * 0.8,
                    height: 2,
                    opacity: 0.4,
                    transform: `rotate(${index * 60 + 18}deg)`,
                    animationName: 'rainbow-fill',
                    animationDuration: '4s',
                    animationTimingFunction: 'linear',
                    animationIterationCount: 'infinite',
                    animationDelay: `${index * -0.4}s`,
                  }}
                />
              ))}
            </span>
          )}
        </>
      )}

      {/* Rising sparks. */}
      {Array.from({ length: fx.sparks }, (_, index) => {
        const style: CSSProperties = {
          left: `${8 + ((index * 37) % 84)}%`,
          top: `${28 + ((index * 53) % 52)}%`,
          width: index % 3 === 0 ? 6 : 4,
          height: index % 3 === 0 ? 6 : 4,
          background: fx.rainbow && index % 2 === 0 ? '#ffffff' : pack.art.accent,
          animationDelay: `${(index * 0.31).toFixed(2)}s`,
          animationDuration: `${2 + (index % 4) * 0.4}s`,
        };
        return <span key={index} className="animate-spark absolute" style={style} />;
      })}

      {/* Orbiting shards. */}
      {Array.from({ length: fx.orbits }, (_, index) => (
        <span
          key={index}
          className="animate-orbit absolute"
          style={
            {
              width: 8,
              height: 8,
              background: pack.art.accent,
              boxShadow: `0 0 0 2px var(--color-abyss)`,
              '--orbit-radius': `${orbitRadius}px`,
              animationDelay: `${index * -1.5}s`,
              animationDuration: `${6 + index}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
