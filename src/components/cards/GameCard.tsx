import type { CSSProperties, ReactNode } from 'react';
import type { AbilityCard, Rarity } from '@/types/game';
import { RARITY_LABEL, SLOT_GLYPH, SLOT_LABEL, abilityAtLevel } from '@/data/cards';
import { HoloSheen } from '@/components/ui/HoloSheen';
import { cn } from '@/lib/cn';

export type CardSize = 'sm' | 'md' | 'lg';

export interface GameCardProps {
  card: AbilityCard;
  size?: CardSize;
  onClick?: () => void;
  /** Renders the card as an unowned silhouette. */
  locked?: boolean;
  /** Shows the copies-to-next-level bar in the footer. */
  showProgress?: boolean;
  /** Disables hover lift — used when the card is the focus of a screen. */
  static?: boolean;
  /** Marker pinned to the art well's top-left, e.g. an "Equipped" chip. */
  badge?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/* Rarity frames. Legendary cycles the whole spectrum; the rest are fixed. */
const FRAME: Record<Rarity, string> = {
  common: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-rarity-common)]',
  rare: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-rarity-rare)]',
  epic: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-rarity-epic)]',
  legendary: 'animate-rainbow-frame',
};

const BANNER: Record<Rarity, string> = {
  common: 'bg-rarity-common text-abyss',
  rare: 'bg-rarity-rare text-abyss',
  epic: 'bg-rarity-epic text-abyss',
  legendary: 'animate-[rainbow-fill_4s_linear_infinite] text-abyss',
};

const TEXT: Record<Rarity, string> = {
  common: 'text-rarity-common',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
};

/** Art-well backdrop tint per rarity. */
const WELL: Record<Rarity, string> = {
  common: 'bg-[#12283a]',
  rare: 'bg-[#0d2f52]',
  epic: 'bg-[#2a1348]',
  legendary: 'bg-[#3a2606]',
};

const METRICS: Record<CardSize, { name: string; glyph: string; body: string; pad: string }> = {
  sm: { name: 'text-[9px]', glyph: 'text-4xl', body: 'text-[8px]', pad: 'p-1.5' },
  md: { name: 'text-[11px]', glyph: 'text-6xl', body: 'text-[9px]', pad: 'p-2' },
  lg: { name: 'text-base', glyph: 'text-8xl', body: 'text-[12px]', pad: 'p-3' },
};

/**
 * An ability card, shaped and framed like a real trading card (5:7).
 *
 * Rarity is the loudest signal on screen: commons stay clean, rares get a
 * quiet sheen, epics gain a pulsing aura and sparks, and legendaries cycle the
 * full spectrum on the frame, banner and name while a rainbow holo sweeps the
 * art (STYLEGUIDE §3 — all effects are hard-edged or overlay-only).
 */
export function GameCard({
  card,
  size = 'md',
  onClick,
  locked = false,
  showProgress = true,
  static: isStatic = false,
  badge,
  className,
  style,
}: GameCardProps) {
  const metrics = METRICS[size];
  const rarity = card.rarity;
  const isEpic = !locked && rarity === 'epic';
  const isLegendary = !locked && rarity === 'legendary';
  const progress = card.copiesForNextLevel ? Math.min(1, card.copies / card.copiesForNextLevel) : 0;
  // Levelled numbers, so the face and the detail page cannot disagree.
  const ability = abilityAtLevel(card);

  const Element = onClick ? 'button' : 'div';

  return (
    <div className={cn('relative', className)} style={style}>
      {/* Rarity glow. Lives outside the card body so it spills outward as a halo
          instead of washing over the card's own text. */}
      {(isEpic || isLegendary) && (
        <span
          aria-hidden
          className={cn(
            'animate-aura pointer-events-none absolute -inset-2 z-0',
            isLegendary ? 'animate-[rainbow-fill_4s_linear_infinite]' : 'bg-rarity-epic',
          )}
          style={{ filter: 'blur(16px)', opacity: 0.55 }}
        />
      )}

      <Element
        {...(onClick ? { type: 'button' as const, onClick } : {})}
        aria-label={
          onClick
            ? locked
              ? `Locked ${RARITY_LABEL[rarity]} card`
              : `${card.name}, level ${card.level}, ${RARITY_LABEL[rarity]}`
            : undefined
        }
        className={cn(
          'group bg-deep relative z-10 flex aspect-[5/7] w-full flex-col overflow-hidden text-left',
          !isStatic &&
            onClick &&
            'transition-transform duration-[110ms] ease-[steps(3,jump-none)] hover:-translate-y-[5px] active:translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-[7px] focus-visible:outline-foam',
          locked ? FRAME.common : FRAME[rarity],
          locked && 'opacity-55 saturate-0',
        )}
      >
        {/* Name banner */}
        <div
          className={cn(
            'relative z-10 flex items-center justify-between gap-1 px-1.5 py-1',
            locked ? 'bg-rarity-common text-abyss' : BANNER[rarity],
          )}
        >
          <span className={cn('truncate font-bold tracking-[0.06em] uppercase', metrics.name)}>
            {locked ? '???' : card.name}
          </span>
          {!locked && (
            <span
              className={cn(
                'bg-abyss/35 shrink-0 px-1 font-bold tabular-nums',
                size === 'sm' ? 'text-[8px]' : 'text-[9px]',
              )}
            >
              L{card.level}
            </span>
          )}
        </div>

        {/* Art well */}
        <div
          className={cn(
            'pixel-bevel-inset relative z-10 flex flex-1 items-center justify-center overflow-hidden',
            locked ? 'bg-[#12283a]' : WELL[rarity],
          )}
        >
          {/* Concentric pixel ripples as the card's backdrop. */}
          {!locked &&
            [0, 1, 2].map((ring) => (
              <span
                key={ring}
                aria-hidden
                className={cn('absolute border-2', TEXT[rarity].replace('text-', 'border-'))}
                style={{
                  width: `${34 + ring * 26}%`,
                  height: `${34 + ring * 26}%`,
                  opacity: 0.14 + (2 - ring) * 0.05,
                }}
              />
            ))}

          <span
            className={cn(
              'relative z-10 leading-none',
              metrics.glyph,
              locked ? 'text-ocean' : TEXT[rarity],
              isLegendary && 'animate-rainbow-text animate-bob',
            )}
          >
            {locked ? '?' : SLOT_GLYPH[card.slot]}
          </span>

          {/* Top-left of the art well is the only corner nothing else claims —
              the banner owns the top strip and the level chip its right end. */}
          {badge && <span className="absolute top-1 left-1 z-20">{badge}</span>}

          {/* Ability numbers, bottom-left of the art well. A card is a move now,
              so what it costs to use belongs on its face, not on a detail page. */}
          {!locked && size !== 'sm' && (
            <span className="text-mist/70 bg-abyss/60 absolute bottom-1 left-1 z-20 flex gap-1.5 px-1 py-0.5 text-[8px] tabular-nums">
              <span title="Damage">◆{ability.damage}</span>
              <span title="Cooldown">↻{ability.cooldownS}s</span>
              <span title="Range">↔{ability.range}</span>
            </span>
          )}

          {/* Epic: rising sparks. Legendary: more of them, brighter. */}
          {(isEpic || isLegendary) &&
            Array.from({ length: isLegendary ? 7 : 4 }, (_, index) => (
              <span
                key={index}
                aria-hidden
                className="animate-spark absolute"
                style={{
                  left: `${12 + ((index * 29) % 76)}%`,
                  bottom: '12%',
                  width: index % 2 === 0 ? 4 : 3,
                  height: index % 2 === 0 ? 4 : 3,
                  background: isLegendary ? '#ffffff' : 'var(--color-rarity-epic)',
                  animationDelay: `${(index * 0.38).toFixed(2)}s`,
                  animationDuration: `${2.2 + (index % 3) * 0.5}s`,
                }}
              />
            ))}

          {/* Holo sweep: rainbow for legendary, plain for rare/epic, none common. */}
          {!locked && rarity !== 'common' && (
            <HoloSheen
              rainbow={isLegendary}
              opacity={isLegendary ? 0.75 : rarity === 'epic' ? 0.45 : 0.3}
              className="z-20"
            />
          )}
        </div>

        {/* Footer: type, effect, progress */}
        <div className={cn('bg-deep relative z-10 flex shrink-0 flex-col gap-1', metrics.pad)}>
          <span
            className={cn(
              'font-bold tracking-[0.12em] uppercase',
              size === 'sm' ? 'text-[7px]' : 'text-[8px]',
              locked ? 'text-mist/40' : TEXT[rarity],
              isLegendary && 'animate-rainbow-text',
            )}
          >
            {RARITY_LABEL[rarity]} · {SLOT_LABEL[card.slot]}
          </span>

          {size !== 'sm' && (
            <span
              className={cn(
                'text-mist/65 leading-snug tracking-normal normal-case',
                metrics.body,
                size === 'md' && 'line-clamp-2',
              )}
            >
              {locked ? 'Pull this card from a pack to unlock it.' : card.description}
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
                      index < Math.round(progress * 10)
                        ? isLegendary
                          ? 'animate-[rainbow-fill_4s_linear_infinite]'
                          : 'bg-surf'
                        : 'bg-ocean/60',
                    )}
                  />
                ))}
              </span>
              <span className="text-mist/50 mt-0.5 block text-right text-[8px] tabular-nums">
                {card.copies}/{card.copiesForNextLevel}
              </span>
            </span>
          )}
        </div>
      </Element>
    </div>
  );
}
