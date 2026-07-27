import { useState } from 'react';
import { CARD_BY_ID, CARD_KIND_LABEL, RARITY_LABEL } from '@/data/cards';
import type { AbilityCard, Rarity } from '@/types/game';
import { GameCard } from '@/components/cards/GameCard';
import { WaterCanvas } from '@/components/water/WaterCanvas';
import { ScreenFrame } from '@/components/ui/ScreenFrame';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { PixelBar } from '@/components/ui/PixelBar';
import { useNavigation } from '@/state/NavigationContext';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

export interface CardDetailScreenProps {
  cardId: string;
}

const TEXT: Record<Rarity, string> = {
  common: 'text-rarity-common',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
};

const TONE: Record<Rarity, 'common' | 'rare' | 'epic' | 'legendary'> = {
  common: 'common',
  rare: 'rare',
  epic: 'epic',
  legendary: 'legendary',
};

/** Gold cost to buy the next level outright. Scales with rarity and level. */
const UPGRADE_BASE: Record<Rarity, number> = {
  common: 120,
  rare: 400,
  epic: 1200,
  legendary: 3000,
};

function statAtLevel(card: AbilityCard, level: number): string {
  const raw = card.stat.base + card.stat.perLevel * (level - 1);
  const rounded = Number.isInteger(raw) ? raw : Number(raw.toFixed(1));
  return `${rounded}${card.stat.unit}`;
}

/**
 * The card's own page: the card itself presented large with its rarity effects,
 * next to what it does, how it grows and how close the next level is.
 *
 * PLACEHOLDER(Block 5): upgrading is presented but inert — the essence economy
 * and the level-up animation belong to the progression block.
 */
export function CardDetailScreen({ cardId }: CardDetailScreenProps) {
  const { back } = useNavigation();
  const card = CARD_BY_ID[cardId];
  const [upgrading, setUpgrading] = useState(false);

  if (!card) {
    return (
      <div className="bg-abyss h-full w-full">
        <ScreenFrame title="Card" onBack={back}>
          <p className="text-mist/60 py-12 text-center text-[11px]">That card does not exist.</p>
        </ScreenFrame>
      </div>
    );
  }

  const maxed = card.level >= card.maxLevel;
  const progress = card.copiesForNextLevel ? Math.min(1, card.copies / card.copiesForNextLevel) : 0;
  const ready = card.copies >= card.copiesForNextLevel && !maxed;
  const upgradeCost = UPGRADE_BASE[card.rarity] * card.level;
  const isLegendary = card.rarity === 'legendary';

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <WaterCanvas variant="background" pixelSize={9} fps={20} className="absolute inset-0" />
      <div aria-hidden className="bg-abyss/88 absolute inset-0" />

      <div className="relative h-full">
        <ScreenFrame
          title={card.owned ? card.name : 'Locked card'}
          subtitle={`${RARITY_LABEL[card.rarity]} · ${CARD_KIND_LABEL[card.kind]}`}
          onBack={back}
          aside={
            <PixelBadge tone={TONE[card.rarity]} shimmer={isLegendary}>
              {maxed ? 'MAX' : `Level ${card.level}`}
            </PixelBadge>
          }
        >
          <div className="grid gap-5 pb-6 lg:grid-cols-[minmax(0,300px)_1fr]">
            {/* The card, presented big and idling. */}
            <div className="relative mx-auto w-full max-w-[300px]">
              <div className={cn('animate-levitate', isLegendary && 'animate-tilt')}>
                <GameCard card={card} size="lg" locked={!card.owned} showProgress={false} static />
              </div>

              {card.owned && (
                <div className="mt-3 flex justify-center gap-2">
                  <PixelBadge tone="neutral">Used 47×</PixelBadge>
                  <PixelBadge tone="surf">31 wins</PixelBadge>
                </div>
              )}
            </div>

            {/* What it does and how it grows. */}
            <div className="flex flex-col gap-3">
              <PixelPanel title="Effect" variant="default" className="animate-rise-in">
                <p className="text-[12px] leading-relaxed">{card.description}</p>
                {!card.owned && (
                  <p className="text-mist/50 mt-2 text-[10px] leading-snug">
                    You do not own this card yet. Pull it from a pack to equip it.
                  </p>
                )}
              </PixelPanel>

              <PixelPanel
                title={card.stat.label}
                variant="default"
                className="animate-rise-in"
                headerAside={maxed ? 'Maxed' : `Lv ${card.level} → ${card.level + 1}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-mist/50 text-[9px] tracking-[0.16em] uppercase">Now</div>
                    <div className={cn('text-2xl tabular-nums', TEXT[card.rarity])}>
                      {statAtLevel(card, card.level)}
                    </div>
                  </div>

                  {!maxed && (
                    <>
                      <div className="text-mist/40 text-xl">→</div>
                      <div className="text-right">
                        <div className="text-mist/50 text-[9px] tracking-[0.16em] uppercase">
                          Next level
                        </div>
                        <div className="text-hp text-2xl tabular-nums">
                          {statAtLevel(card, card.level + 1)}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Level pips. */}
                <div className="mt-3 flex gap-1">
                  {Array.from({ length: card.maxLevel }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        'h-2 flex-1',
                        index < card.level
                          ? isLegendary
                            ? 'animate-[rainbow-fill_4s_linear_infinite]'
                            : 'bg-gold'
                          : 'bg-ocean/60',
                      )}
                      style={
                        index < card.level && isLegendary
                          ? { animationDelay: `${index * -0.3}s` }
                          : undefined
                      }
                    />
                  ))}
                </div>
              </PixelPanel>

              <PixelPanel
                title="Next level"
                variant={ready ? 'gold' : 'default'}
                className="animate-rise-in"
              >
                {maxed ? (
                  <p className="text-gold text-[12px]">
                    This card is fully upgraded. Nothing left to feed it.
                  </p>
                ) : (
                  <>
                    <PixelBar
                      value={progress}
                      tone={ready ? 'gold' : 'surf'}
                      segments={20}
                      height="md"
                      label="Copies collected"
                      readout={`${card.copies}/${card.copiesForNextLevel}`}
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <PixelButton
                        variant={ready ? 'gold' : 'secondary'}
                        size="md"
                        icon="▲"
                        disabled={!ready}
                        onClick={() => setUpgrading(true)}
                      >
                        {ready ? 'Level up' : `Need ${card.copiesForNextLevel - card.copies} more`}
                      </PixelButton>
                      <PixelButton
                        variant="ghost"
                        size="md"
                        icon="◆"
                        disabled
                        aside={formatNumber(upgradeCost)}
                      >
                        Buy level
                      </PixelButton>
                    </div>

                    <p className="text-mist/45 mt-2 text-[10px] leading-snug">
                      Duplicates from packs stack here. Spending gold skips the wait — both routes
                      come online with the progression block.
                    </p>
                  </>
                )}
              </PixelPanel>
            </div>
          </div>
        </ScreenFrame>
      </div>

      {/* Level-up flourish placeholder. */}
      {upgrading && (
        <div className="bg-abyss/88 absolute inset-0 z-40 flex items-center justify-center p-4">
          <PixelPanel title="Level up" variant="gold" className="animate-pop-in w-full max-w-xs">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="animate-levitate w-40">
                <GameCard card={card} size="md" showProgress={false} static />
              </div>
              <p className="text-[11px] leading-snug">
                {card.name} would reach level {card.level + 1} — {card.stat.label.toLowerCase()}{' '}
                {statAtLevel(card, card.level + 1)}.
              </p>
              <p className="text-mist/50 text-[10px]">
                The full power-up ceremony arrives with the progression block.
              </p>
              <PixelButton
                variant="primary"
                size="md"
                fullWidth
                onClick={() => setUpgrading(false)}
              >
                Close
              </PixelButton>
            </div>
          </PixelPanel>
        </div>
      )}
    </div>
  );
}
