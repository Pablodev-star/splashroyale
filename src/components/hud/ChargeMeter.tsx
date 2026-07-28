import { TIER_BOUNDARIES, TIER_LABEL, splashTierFor } from '@/game/vfx';
import { cn } from '@/lib/cn';

export interface ChargeMeterProps {
  /** 0..1 attack charge. */
  value: number;
  /** True while the attack button is held. */
  charging: boolean;
  className?: string;
}

/**
 * Attack charge meter.
 *
 * The five notches map 1:1 to the five splash tiers, so the player can read
 * which splash their release will produce. Boundaries and the tier lookup come
 * from the Block 2C table, so the notch shown and the splash thrown cannot drift.
 */
const SEGMENTS = 25;

export function ChargeMeter({ value, charging, className }: ChargeMeterProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const filled = Math.round(clamped * SEGMENTS);
  const tier = splashTierFor(clamped);
  const full = clamped >= 1;

  return (
    <div
      className={cn(
        'transition-opacity duration-200 ease-[var(--ease-pixel)]',
        charging || clamped > 0 ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      <div className="mb-1 flex items-baseline justify-between text-[9px] tracking-[0.2em] uppercase">
        <span className="text-mist/70">Charge</span>
        <span className={cn('tabular-nums', full ? 'text-danger animate-blink' : 'text-charge')}>
          {full ? `MAX · ${TIER_LABEL[tier]}` : TIER_LABEL[tier]}
        </span>
      </div>

      <div
        role="meter"
        aria-label="Attack charge"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        className="bg-abyss pixel-border-thin relative flex h-5 w-full gap-[2px] p-[3px]"
      >
        {Array.from({ length: SEGMENTS }, (_, index) => {
          const segmentValue = (index + 1) / SEGMENTS;
          const isFilled = index < filled;
          return (
            <span
              key={index}
              className={cn(
                'relative h-full flex-1',
                isFilled
                  ? segmentValue > 0.8
                    ? 'bg-danger'
                    : segmentValue > 0.4
                      ? 'bg-charge'
                      : 'bg-surf'
                  : 'bg-ocean/60',
                isFilled && 'shadow-[inset_0_2px_0_0_rgb(255_255_255_/_0.35)]',
              )}
            />
          );
        })}

        {/* Tier notches drawn over the fill. */}
        {TIER_BOUNDARIES.map((boundary) => (
          <span
            key={boundary}
            aria-hidden
            className="bg-abyss absolute inset-y-0 w-[2px]"
            style={{ left: `${boundary * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
