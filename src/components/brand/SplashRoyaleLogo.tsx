import { cn } from '@/lib/cn';

export interface SplashRoyaleLogoProps {
  size?: 'sm' | 'md' | 'lg';
  /** Idle float. Disable inside dense layouts. */
  animated?: boolean;
  className?: string;
}

const SIZE = {
  sm: { splash: 'text-2xl', royale: 'text-base', gap: 'gap-0.5' },
  md: { splash: 'text-4xl sm:text-5xl', royale: 'text-xl sm:text-2xl', gap: 'gap-1' },
  lg: { splash: 'text-5xl sm:text-7xl', royale: 'text-2xl sm:text-4xl', gap: 'gap-1.5' },
} as const;

/**
 * Wordmark built from type + stacked hard shadows so it stays crisp at any size
 * (a raster logo would break the integer-scaling rule, STYLEGUIDE §3.4).
 */
export function SplashRoyaleLogo({
  size = 'md',
  animated = true,
  className,
}: SplashRoyaleLogoProps) {
  const scale = SIZE[size];

  return (
    <div
      className={cn(
        'inline-flex flex-col items-center',
        scale.gap,
        animated && 'animate-bob-slow',
        className,
      )}
    >
      <span
        className={cn(
          'text-foam font-bold tracking-[0.14em] uppercase',
          'text-[length:inherit] leading-none',
          scale.splash,
        )}
        style={{
          textShadow: [
            '0 3px 0 var(--color-surf)',
            '0 6px 0 var(--color-lagoon)',
            '4px 4px 0 var(--color-abyss)',
            '0 9px 0 var(--color-abyss)',
          ].join(', '),
        }}
      >
        Splash
      </span>

      {/* Foam divider: three hard bars, no gradient. */}
      <span aria-hidden className="flex w-full items-center gap-1 px-1">
        <span className="bg-surf h-[3px] flex-1" />
        <span className="bg-foam h-[3px] w-2" />
        <span className="bg-surf h-[3px] flex-1" />
      </span>

      <span
        className={cn('text-gold font-bold tracking-[0.42em] uppercase', scale.royale)}
        style={{
          textShadow: '0 3px 0 var(--color-gold-deep), 3px 3px 0 var(--color-abyss)',
        }}
      >
        Royale
      </span>
    </div>
  );
}
