import type { AbilityCard, Rarity } from '@/types/game';
import { CARD_KIND_LABEL, RARITY_LABEL } from '@/data/cards';
import { cn } from '@/lib/cn';

export interface CardTileProps {
  card: AbilityCard;
  onClick?: () => void;
  size?: 'sm' | 'md';
  /** Hides name/effect and shows a silhouette for cards not yet owned. */
  locked?: boolean;
  /** Shows the copies-to-next-level bar under the art. */
  showProgress?: boolean;
  className?: string;
}

/** Rarity frames. Static maps — Tailwind cannot see interpolated class names. */
const RARITY_FRAME: Record<Rarity, string> = {
  common: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-rarity-common)]',
  rare: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-rarity-rare)]',
  epic: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-rarity-epic)]',
  legendary: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-rarity-legendary)]',
};

const RARITY_STRIP: Record<Rarity, string> = {
  common: 'bg-rarity-common',
  rare: 'bg-rarity-rare',
  epic: 'bg-rarity-epic',
  legendary: 'bg-rarity-legendary',
};

const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-rarity-common',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
};

/** Placeholder art: one glyph per ability kind (Block 4 swaps in real art). */
const KIND_GLYPH: Record<AbilityCard['kind'], string> = {
  attack: '≈',
  defense: '◈',
  utility: '✦',
  ultimate: '★',
};

export function CardTile({
  card,
  onClick,
  size = 'md',
  locked = false,
  showProgress = true,
  className,
}: CardTileProps) {
  const progress = card.copiesForNextLevel ? Math.min(1, card.copies / card.copiesForNextLevel) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        locked ? `Locked card, ${RARITY_LABEL[card.rarity]}` : `${card.name}, level ${card.level}`
      }
      className={cn(
        'group bg-deep relative flex flex-col overflow-hidden text-left',
        'transition-transform duration-[90ms] ease-[steps(2,jump-none)]',
        'hover:-translate-y-[3px] active:translate-y-[1px]',
        'focus-visible:outline-2 focus-visible:outline-offset-[7px] focus-visible:outline-foam',
        RARITY_FRAME[card.rarity],
        size === 'sm' ? 'w-[104px]' : 'w-full',
        locked && 'opacity-60',
        className,
      )}
    >
      {/* Rarity strip */}
      <span aria-hidden className={cn('h-[3px] w-full', RARITY_STRIP[card.rarity])} />

      {/* Art well */}
      <span
        aria-hidden
        className={cn(
          'bg-abyss pixel-bevel-inset relative flex items-center justify-center overflow-hidden',
          size === 'sm' ? 'h-16' : 'h-24',
        )}
      >
        <span
          className={cn(
            'leading-none',
            size === 'sm' ? 'text-3xl' : 'text-5xl',
            locked ? 'text-ocean' : RARITY_TEXT[card.rarity],
            !locked && card.rarity === 'legendary' && 'animate-bob',
          )}
        >
          {locked ? '?' : KIND_GLYPH[card.kind]}
        </span>
        {/* Legendary idle shimmer, epic slow glow (STYLEGUIDE §5). */}
        {!locked && card.rarity === 'legendary' && (
          <span className="animate-shimmer absolute inset-0 bg-[linear-gradient(100deg,transparent_35%,rgb(255_255_255_/_0.35)_50%,transparent_65%)] bg-[length:200%_100%]" />
        )}
        {!locked && card.rarity === 'epic' && (
          <span className="animate-pulse-glow absolute inset-0 shadow-[inset_0_0_0_2px_var(--color-rarity-epic)]" />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1 p-2">
        <span className="flex items-baseline justify-between gap-1">
          <span
            className={cn(
              'truncate font-bold tracking-[0.08em] uppercase',
              size === 'sm' ? 'text-[9px]' : 'text-[11px]',
            )}
          >
            {locked ? 'Not owned' : card.name}
          </span>
          {!locked && (
            <span className="text-gold shrink-0 text-[9px] tracking-[0.1em] tabular-nums">
              L{card.level}
            </span>
          )}
        </span>

        <span className={cn('text-[8px] tracking-[0.14em] uppercase', RARITY_TEXT[card.rarity])}>
          {RARITY_LABEL[card.rarity]} · {CARD_KIND_LABEL[card.kind]}
        </span>

        {size === 'md' && !locked && (
          <span className="text-mist/60 line-clamp-2 text-[9px] leading-snug tracking-normal normal-case">
            {card.description}
          </span>
        )}

        {showProgress && !locked && (
          <span aria-hidden className="mt-auto block">
            <span className="bg-abyss flex h-[6px] w-full gap-[1px] p-[1px]">
              {Array.from({ length: 10 }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    'h-full flex-1',
                    index < Math.round(progress * 10) ? 'bg-surf' : 'bg-ocean/60',
                  )}
                />
              ))}
            </span>
            <span className="text-mist/50 mt-0.5 block text-right text-[8px] tabular-nums">
              {card.copies}/{card.copiesForNextLevel}
            </span>
          </span>
        )}
      </span>
    </button>
  );
}
