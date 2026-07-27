import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone =
  | 'neutral'
  | 'surf'
  | 'gold'
  | 'danger'
  | 'common'
  | 'rare'
  | 'epic'
  | 'legendary';

export interface PixelBadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
  /** Adds the slow gold shimmer used for legendary / reward emphasis. */
  shimmer?: boolean;
  className?: string;
}

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-ocean text-mist',
  surf: 'bg-surf text-abyss',
  gold: 'bg-gold text-abyss',
  danger: 'bg-danger text-abyss',
  common: 'bg-rarity-common text-abyss',
  rare: 'bg-rarity-rare text-abyss',
  epic: 'bg-rarity-epic text-abyss',
  legendary: 'bg-rarity-legendary text-abyss',
};

/** Small chip for rarity, currency, mode labels and counters. */
export function PixelBadge({
  children,
  tone = 'neutral',
  icon,
  shimmer = false,
  className,
}: PixelBadgeProps) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1 overflow-hidden px-2 py-1',
        'text-[10px] font-bold tracking-[0.14em] uppercase',
        'shadow-[inset_0_2px_0_0_rgb(255_255_255_/_0.25),inset_0_-2px_0_0_rgb(0_0_0_/_0.3)]',
        TONE[tone],
        className,
      )}
    >
      {shimmer && (
        <span
          aria-hidden
          className="animate-shimmer pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,transparent_35%,rgb(255_255_255_/_0.55)_50%,transparent_65%)] bg-[length:200%_100%]"
        />
      )}
      {icon !== undefined && <span className="leading-none">{icon}</span>}
      <span className="relative leading-none tabular-nums">{children}</span>
    </span>
  );
}
