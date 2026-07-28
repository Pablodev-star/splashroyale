import { useState } from 'react';
import { RARITY_LABEL, SLOT_LABEL, abilityAtLevel, statAtLevel } from '@/data/cards';
import { upgradeCostGold } from '@/game/progression/economy';
import { canEquip } from '@/data/decks';
import type { AbilityCard, Rarity } from '@/types/game';
import { GameCard } from '@/components/cards/GameCard';
import { WaterCanvas } from '@/components/water/WaterCanvas';
import { ScreenFrame } from '@/components/ui/ScreenFrame';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { PixelBar } from '@/components/ui/PixelBar';
import { useNavigation } from '@/state/NavigationContext';
import { useDecks } from '@/state/DeckContext';
import { usePlayer } from '@/state/PlayerContext';
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

function AbilityStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-abyss/60 pixel-border-thin px-2 py-1.5">
      <div className="text-mist/45 text-[8px] tracking-[0.16em] uppercase">{label}</div>
      <div className={cn('text-sm tabular-nums', tone ?? 'text-mist')}>{value}</div>
    </div>
  );
}

/** The stat as printed: the shared level curve plus this card's unit. */
function statText(card: AbilityCard, level: number): string {
  return `${statAtLevel(card, level)}${card.stat.unit}`;
}

/**
 * The card's own page: the card itself presented large with its rarity effects,
 * next to what it does, how it grows and how close the next level is.
 *
 * Upgrading is live (Block 4): duplicates pulled from packs bank as copies, and
 * spending them — or buying the level with gold — raises the card's level, which
 * `abilityAtLevel` feeds straight into combat. The number on this page is the
 * number the ability deals.
 */
export function CardDetailScreen({ cardId }: CardDetailScreenProps) {
  const { back, navigate } = useNavigation();
  const { activeDeck, equip } = useDecks();
  const { profile, cardById, levelUpCard, buyCardLevel } = usePlayer();
  const card = cardById[cardId];
  /** Holds the level the card *was* at, so the ceremony can show the jump. */
  const [levelledFrom, setLevelledFrom] = useState<number | null>(null);

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
  const upgradeCost = upgradeCostGold(card.rarity, card.level);
  const canBuyLevel = !maxed && upgradeCost <= profile.gold;
  const isLegendary = card.rarity === 'legendary';
  const ability = abilityAtLevel(card);
  const equipped = activeDeck.cards[card.slot] === card.id;
  const equippable = canEquip(card, card.slot);

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <WaterCanvas variant="background" pixelSize={9} fps={20} className="absolute inset-0" />
      <div aria-hidden className="bg-abyss/88 absolute inset-0" />

      <div className="relative h-full">
        <ScreenFrame
          title={card.owned ? card.name : 'Locked card'}
          subtitle={`${RARITY_LABEL[card.rarity]} · ${SLOT_LABEL[card.slot]}`}
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

              {/* Equipping from here is the point of the screen: a card is a
                  move, so "put it on my bar" has to be one press away. */}
              {equippable && (
                <div className="mt-3 flex flex-col gap-2">
                  <PixelButton
                    variant={equipped ? 'secondary' : 'primary'}
                    size="md"
                    icon={equipped ? '✓' : '≈'}
                    fullWidth
                    disabled={equipped}
                    onClick={() => equip(activeDeck.id, card.slot, card.id)}
                  >
                    {equipped
                      ? `Equipped · ${SLOT_LABEL[card.slot]}`
                      : `Equip as ${SLOT_LABEL[card.slot]}`}
                  </PixelButton>
                  <PixelButton
                    variant="ghost"
                    size="sm"
                    icon="▤"
                    fullWidth
                    onClick={() => navigate('deckSelect', { next: null })}
                  >
                    Open {activeDeck.name}
                  </PixelButton>
                </div>
              )}
            </div>

            {/* What it does and how it grows. */}
            <div className="flex flex-col gap-3">
              <PixelPanel
                title="Ability"
                variant="default"
                className="animate-rise-in"
                headerAside={SLOT_LABEL[card.slot]}
              >
                <p className="text-[12px] leading-relaxed">{card.description}</p>
                <p className="text-mist/45 mt-1.5 text-[10px] leading-snug italic">
                  {card.flavour}
                </p>

                {/* The four numbers that decide whether it belongs in a deck. */}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <AbilityStat label="Damage" value={`${ability.damage}`} tone={TEXT[card.rarity]} />
                  <AbilityStat label="Cooldown" value={`${ability.cooldownS}s`} />
                  <AbilityStat label="Range" value={`${ability.range}m`} />
                  <AbilityStat
                    label="Charge"
                    value={ability.chargeS === 0 ? 'Instant' : `${ability.chargeS}s`}
                  />
                </div>

                {ability.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ability.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-ocean text-mist/75 px-1.5 py-0.5 text-[9px] tracking-[0.12em] uppercase"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {!card.owned && (
                  <p className="text-mist/50 mt-2 text-[10px] leading-snug">
                    You do not own this card yet. Pull it from a pack to equip it in your{' '}
                    {SLOT_LABEL[card.slot].toLowerCase()} slot.
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
                      {statText(card, card.level)}
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
                          {statText(card, card.level + 1)}
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
                        onClick={() => {
                          const from = card.level;
                          if (levelUpCard(card.id)) setLevelledFrom(from);
                        }}
                      >
                        {ready ? 'Level up' : `Need ${card.copiesForNextLevel - card.copies} more`}
                      </PixelButton>
                      <PixelButton
                        variant={canBuyLevel ? 'gold' : 'ghost'}
                        size="md"
                        icon="◆"
                        disabled={!canBuyLevel}
                        aside={formatNumber(upgradeCost)}
                        onClick={() => {
                          const from = card.level;
                          if (buyCardLevel(card.id)) setLevelledFrom(from);
                        }}
                      >
                        Buy level
                      </PixelButton>
                    </div>

                    <p className="text-mist/45 mt-2 text-[10px] leading-snug">
                      Duplicates from packs stack here. Spending gold skips the wait — you have{' '}
                      ◆ {formatNumber(profile.gold)}.
                    </p>
                  </>
                )}
              </PixelPanel>
            </div>
          </div>
        </ScreenFrame>
      </div>

      {/* Level-up ceremony. Shown after the level has already been applied —
          the card behind it is already at its new level. */}
      {levelledFrom !== null && (
        <div className="bg-abyss/88 absolute inset-0 z-40 flex items-center justify-center p-4">
          <PixelPanel title="Level up" variant="gold" className="animate-pop-in w-full max-w-xs">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="animate-levitate w-40">
                <GameCard card={card} size="md" showProgress={false} static />
              </div>
              <p className="text-[11px] leading-snug">
                {card.name} is now level {card.level}.
              </p>
              <p className="text-gold text-[12px] tabular-nums">
                {card.stat.label}: {statText(card, levelledFrom)} → {statText(card, card.level)}
              </p>
              <p className="text-mist/50 text-[10px] leading-snug">
                It fights at the new number from your next match.
              </p>
              <PixelButton
                variant="primary"
                size="md"
                fullWidth
                onClick={() => setLevelledFrom(null)}
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
