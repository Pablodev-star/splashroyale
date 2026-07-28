import { useMemo, useState } from 'react';
import type { AbilityCard, AbilitySlot, Rarity } from '@/types/game';
import {
  RARITY_LABEL,
  RARITY_ORDER,
  SLOT_GLYPH,
  SLOT_LABEL,
  SLOT_ORDER,
} from '@/data/cards';
import { ScreenFrame } from '@/components/ui/ScreenFrame';
import { GameCard } from '@/components/cards/GameCard';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { PixelButton } from '@/components/ui/PixelButton';
import { useNavigation } from '@/state/NavigationContext';
import { useCollection } from '@/state/PlayerContext';
import { cn } from '@/lib/cn';

type RarityFilter = 'all' | Rarity;
type SlotFilter = 'all' | AbilitySlot;

const SLOT_FILTERS: { id: SlotFilter; label: string; glyph: string }[] = [
  { id: 'all', label: 'All slots', glyph: '◇' },
  ...SLOT_ORDER.map((slot) => ({
    id: slot as SlotFilter,
    label: SLOT_LABEL[slot],
    glyph: SLOT_GLYPH[slot],
  })),
];

const RARITY_CHIP: Record<Rarity, string> = {
  common: 'bg-rarity-common text-abyss',
  rare: 'bg-rarity-rare text-abyss',
  epic: 'bg-rarity-epic text-abyss',
  legendary: 'animate-[rainbow-fill_4s_linear_infinite] text-abyss',
};

/** Owned first, then rarest, then alphabetical — stable and predictable. */
function sortCards(cards: AbilityCard[]): AbilityCard[] {
  return [...cards].sort((a, b) => {
    if (a.owned !== b.owned) return a.owned ? -1 : 1;
    const rarityDelta = RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
    if (rarityDelta !== 0) return rarityDelta;
    return a.name.localeCompare(b.name);
  });
}

export function CollectionScreen() {
  const { navigate, back } = useNavigation();
  const { cards: CARDS } = useCollection();
  const [rarity, setRarity] = useState<RarityFilter>('all');
  const [slot, setSlot] = useState<SlotFilter>('all');

  const cards = useMemo(
    () =>
      sortCards(
        CARDS.filter(
          (card) =>
            (rarity === 'all' || card.rarity === rarity) && (slot === 'all' || card.slot === slot),
        ),
      ),
    [CARDS, rarity, slot],
  );

  const owned = CARDS.filter((card) => card.owned).length;
  const completion = owned / CARDS.length;

  /** Owned / total per rarity, for the summary strip. */
  const byRarity = useMemo(
    () =>
      RARITY_ORDER.map((value) => {
        const all = CARDS.filter((card) => card.rarity === value);
        return { rarity: value, owned: all.filter((card) => card.owned).length, total: all.length };
      }),
    [CARDS],
  );

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <ScreenFrame
        title="Collection"
        subtitle="Every card is a move — equip three of them as your deck"
        onBack={back}
        aside={
          <>
            <PixelButton
              variant="secondary"
              size="sm"
              icon="≈"
              onClick={() => navigate('deckSelect', { next: null })}
            >
              Deck
            </PixelButton>
            <PixelBadge tone="surf">
              {owned}/{CARDS.length} · {Math.round(completion * 100)}%
            </PixelBadge>
          </>
        }
      >
        {/* Per-rarity completion strip. */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {byRarity.map((entry, index) => (
            <button
              key={entry.rarity}
              type="button"
              onClick={() => setRarity(rarity === entry.rarity ? 'all' : entry.rarity)}
              aria-pressed={rarity === entry.rarity}
              className={cn(
                'bg-deep animate-rise-in flex items-center justify-between gap-2 px-2.5 py-2',
                'transition-transform duration-[110ms] ease-[steps(3,jump-none)] hover:-translate-y-[2px]',
                'focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-foam',
                rarity === entry.rarity ? 'pixel-border-active' : 'pixel-border-thin',
              )}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span
                className={cn(
                  'px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] uppercase',
                  RARITY_CHIP[entry.rarity],
                )}
              >
                {RARITY_LABEL[entry.rarity]}
              </span>
              <span className="text-mist/80 text-[11px] tabular-nums">
                {entry.owned}/{entry.total}
              </span>
            </button>
          ))}
        </div>

        {/* Slot filter — the same three slots a deck has, so browsing the
            collection and filling a deck ask the same question. */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {SLOT_FILTERS.map((option) => {
            const active = slot === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSlot(option.id)}
                aria-pressed={active}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold tracking-[0.12em] uppercase',
                  'transition-transform duration-[110ms] ease-[steps(3,jump-none)] hover:-translate-y-[2px]',
                  'focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-foam',
                  active
                    ? 'bg-surf text-abyss pixel-border-active'
                    : 'bg-ocean text-mist/70 pixel-border',
                )}
              >
                <span className="text-[12px] leading-none">{option.glyph}</span>
                {option.label}
              </button>
            );
          })}
          {rarity !== 'all' && (
            <button
              type="button"
              onClick={() => setRarity('all')}
              className="bg-deep text-mist/60 pixel-border-thin px-3 py-2 text-[10px] tracking-[0.12em] uppercase hover:-translate-y-[2px]"
            >
              Clear {RARITY_LABEL[rarity]} ×
            </button>
          )}
        </div>

        {/* The grid. */}
        <div className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {cards.map((card, index) => (
            <GameCard
              key={card.id}
              card={card}
              locked={!card.owned}
              className="animate-rise-in"
              style={{ animationDelay: `${Math.min(index * 45, 500)}ms` }}
              onClick={() => navigate('cardDetail', { cardId: card.id })}
            />
          ))}
        </div>

        {cards.length === 0 && (
          <p className="text-mist/50 py-16 text-center text-[11px] tracking-[0.12em] uppercase">
            No {slot === 'all' ? '' : `${SLOT_LABEL[slot as AbilitySlot]} `}cards match this filter.
          </p>
        )}
      </ScreenFrame>
    </div>
  );
}
