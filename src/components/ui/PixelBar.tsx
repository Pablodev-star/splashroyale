import { cn } from '@/lib/cn';

export type BarTone = 'hp' | 'oxygen' | 'charge' | 'gold' | 'surf' | 'danger';

export interface PixelBarProps {
  /** 0..1 */
  value: number;
  tone?: BarTone;
  /** Number of pixel segments. Part of the look — quantity without numbers. */
  segments?: number;
  /** Short uppercase label rendered above the bar. */
  label?: string;
  /** Text rendered at the right of the label row, e.g. "72 / 100". */
  readout?: string;
  height?: 'sm' | 'md' | 'lg';
  /** Blink the bar when it drops below this fraction. */
  warnBelow?: number;
  /** Ghost fill showing the previous value (damage taken this frame). */
  ghostValue?: number;
  className?: string;
}

const FILL: Record<BarTone, string> = {
  hp: 'bg-hp',
  oxygen: 'bg-oxygen',
  charge: 'bg-charge',
  gold: 'bg-gold',
  surf: 'bg-surf',
  danger: 'bg-danger',
};

const HEIGHT = { sm: 'h-2', md: 'h-3', lg: 'h-5' } as const;

/**
 * Segmented pixel bar used for health, oxygen, charge and any progress readout.
 * Mirrors its value with role="meter" so screen readers get the same signal.
 */
export function PixelBar({
  value,
  tone = 'hp',
  segments = 20,
  label,
  readout,
  height = 'md',
  warnBelow,
  ghostValue,
  className,
}: PixelBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const filled = Math.round(clamped * segments);
  const warning = warnBelow !== undefined && clamped <= warnBelow;

  return (
    <div className={cn('w-full', className)}>
      {(label || readout) && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[9px] tracking-[0.18em] uppercase">
          {label && <span className="text-mist/70">{label}</span>}
          {readout && <span className="text-mist tabular-nums">{readout}</span>}
        </div>
      )}
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        className={cn(
          'bg-abyss pixel-border-thin relative flex w-full gap-[2px] p-[2px]',
          HEIGHT[height],
          warning && 'animate-blink',
        )}
      >
        {ghostValue !== undefined && ghostValue > clamped && (
          <span
            aria-hidden
            className="absolute inset-y-[2px] left-[2px] bg-white/25"
            style={{ width: `calc(${Math.min(1, ghostValue) * 100}% - 4px)` }}
          />
        )}
        {Array.from({ length: segments }, (_, index) => (
          <span
            key={index}
            className={cn(
              'relative h-full flex-1',
              index < filled ? FILL[tone] : 'bg-ocean/60',
              index < filled && 'shadow-[inset_0_2px_0_0_rgb(255_255_255_/_0.35)]',
            )}
          />
        ))}
      </div>
    </div>
  );
}
