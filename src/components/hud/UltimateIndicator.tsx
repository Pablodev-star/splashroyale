import { cn } from '@/lib/cn';

export interface UltimateIndicatorProps {
  /** 0..1 — 1 means ready to fire. */
  value: number;
  /** Ability name shown under the meter. */
  name: string;
  /** Disabled while submerged (no water attacks underwater, design doc §5). */
  locked?: boolean;
  onActivate?: () => void;
  /** The caller sets the square size here (e.g. `h-16 w-16 md:h-20 md:w-20`). */
  className?: string;
}

/**
 * Ultimate energy tank: a square that fills from the bottom like a glass of
 * water, going gold and pulsing once it is ready.
 */
export function UltimateIndicator({
  value,
  name,
  locked = false,
  onActivate,
  className,
}: UltimateIndicatorProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const ready = clamped >= 1 && !locked;

  return (
    <button
      type="button"
      onClick={ready ? onActivate : undefined}
      disabled={!ready}
      aria-label={`Ultimate: ${name}${ready ? ' (ready)' : ` (${Math.round(clamped * 100)}%)`}`}
      className={cn(
        'group relative flex flex-col items-center justify-end overflow-hidden',
        // Same reason as the touch pads: this is held, and a held button that
        // selects its own label pops the copy bubble over the fight.
        'touch-none select-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent]',
        'bg-abyss transition-transform duration-[90ms] ease-[steps(2,jump-none)]',
        ready
          ? 'pixel-border-gold hover:-translate-y-[2px] active:translate-y-[2px]'
          : 'pixel-border',
        'focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-foam',
        'disabled:cursor-default',
        className,
      )}
      style={{ imageRendering: 'pixelated' }}
    >
      {/* Fill rises in 8 discrete steps so it reads as pixel art, not a gauge. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-0 bottom-0 transition-[height] duration-200 ease-[steps(8,jump-none)]',
          ready ? 'bg-gold' : 'bg-lagoon',
        )}
        style={{ height: `${Math.round(clamped * 8) * 12.5}%` }}
      />
      {/* Crest line on top of the fill. */}
      {clamped > 0 && clamped < 1 && (
        <span
          aria-hidden
          className="bg-foam absolute inset-x-0 h-[2px]"
          style={{ bottom: `${Math.round(clamped * 8) * 12.5}%` }}
        />
      )}
      {ready && (
        <span
          aria-hidden
          className="animate-pulse-glow absolute -inset-[7px] shadow-[0_0_0_2px_var(--color-gold)]"
        />
      )}

      <span className="relative z-10 w-full pb-1 text-center">
        <span
          className={cn(
            'block text-[9px] font-bold tracking-[0.14em] uppercase',
            ready ? 'text-abyss' : 'text-mist',
          )}
        >
          {ready ? 'Ready' : `${Math.round(clamped * 100)}%`}
        </span>
        <span
          className={cn(
            'block truncate px-1 text-[8px] tracking-[0.1em] uppercase',
            ready ? 'text-abyss/70' : 'text-mist/50',
          )}
        >
          {locked ? 'Submerged' : name}
        </span>
      </span>
    </button>
  );
}
