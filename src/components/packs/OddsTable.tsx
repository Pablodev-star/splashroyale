import type { Rarity, RarityOdds } from '@/types/game';
import { RARITY_LABEL } from '@/data/cards';
import { ODDS_ORDER, formatOdds } from '@/data/packs';
import { cn } from '@/lib/cn';

export interface OddsTableProps {
  odds: RarityOdds;
  /** Rarity guaranteed at least once — highlighted in the table. */
  guaranteed: Rarity;
  className?: string;
}

const BAR_FILL: Record<Rarity, string> = {
  common: 'bg-rarity-common',
  rare: 'bg-rarity-rare',
  epic: 'bg-rarity-epic',
  legendary: 'bg-rarity-legendary',
};

const TEXT: Record<Rarity, string> = {
  common: 'text-rarity-common',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
};

const SEGMENTS = 20;

/**
 * Per-card pull rates for a pack. Bars are segmented like every other meter in
 * the game, and each row animates in on a stagger.
 */
export function OddsTable({ odds, guaranteed, className }: OddsTableProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {ODDS_ORDER.map((rarity, index) => {
        const value = odds[rarity];
        // Bars are scaled against the largest rate so small odds stay visible.
        const filled = Math.max(1, Math.round((value / 100) * SEGMENTS));
        const isGuaranteed = rarity === guaranteed;

        return (
          <div
            key={rarity}
            className="animate-rise-in"
            style={{ animationDelay: `${120 + index * 70}ms` }}
          >
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  'text-[10px] font-bold tracking-[0.14em] uppercase',
                  TEXT[rarity],
                  rarity === 'legendary' && 'animate-rainbow-text',
                )}
              >
                {RARITY_LABEL[rarity]} card
              </span>
              <span className="flex items-center gap-1.5">
                {isGuaranteed && (
                  <span className="bg-gold text-abyss px-1 py-px text-[8px] font-bold tracking-[0.1em] uppercase">
                    1+ guaranteed
                  </span>
                )}
                <span className="text-mist text-[11px] tabular-nums">{formatOdds(value)}</span>
              </span>
            </div>

            <div className="bg-abyss pixel-border-thin flex h-3 w-full gap-[2px] p-[2px]">
              {Array.from({ length: SEGMENTS }, (_, segment) => (
                <span
                  key={segment}
                  className={cn(
                    'h-full flex-1 transition-colors duration-300',
                    segment < filled ? BAR_FILL[rarity] : 'bg-ocean/50',
                    segment < filled &&
                      rarity === 'legendary' &&
                      'animate-[rainbow-fill_4s_linear_infinite]',
                    segment < filled && 'shadow-[inset_0_2px_0_0_rgb(255_255_255_/_0.3)]',
                  )}
                  style={
                    segment < filled && rarity === 'legendary'
                      ? { animationDelay: `${segment * -0.12}s` }
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        );
      })}

      <p className="text-mist/45 mt-1 text-[9px] leading-snug">
        Rates are per card drawn. The guarantee is applied on top, so a pack never pays out below
        its promised rarity.
      </p>
    </div>
  );
}
