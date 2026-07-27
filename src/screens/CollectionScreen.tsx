import { useMemo, useState } from 'react';
import type { AbilityCard, Rarity } from '@/types/game';
import { CARDS, RARITY_LABEL, RARITY_ORDER } from '@/data/cards';
import { ScreenFrame } from '@/components/ui/ScreenFrame';
import { CardTile } from '@/components/cards/CardTile';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { PixelBar } from '@/components/ui/PixelBar';
import { useNavigation } from '@/state/NavigationContext';
import { cn } from '@/lib/cn';

type Filter = 'all' | Rarity;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  ...RARITY_ORDER.map((rarity) => ({ id: rarity as Filter, label: RARITY_LABEL[rarity] })),
];

/** Sort owned first, then by rarity, then by name — stable and predictable. */
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
  const [filter, setFilter] = useState<Filter>('all');

  const cards = useMemo(
    () => sortCards(CARDS.filter((card) => filter === 'all' || card.rarity === filter)),
    [filter],
  );

  const owned = CARDS.filter((card) => card.owned).length;
  const completion = owned / CARDS.length;

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <ScreenFrame
        title="Card Collection"
        subtitle="Cards you own become abilities you can equip"
        onBack={back}
        aside={
          <PixelBadge tone="surf">
            {owned}/{CARDS.length}
          </PixelBadge>
        }
      >
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {/* Rarity filter tabs */}
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((option) => {
              const active = filter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  aria-pressed={active}
                  className={cn(
                    'px-3 py-2 text-[10px] font-bold tracking-[0.14em] uppercase',
                    'transition-transform duration-[90ms] ease-[steps(2,jump-none)]',
                    'hover:-translate-y-[2px] focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-foam',
                    active
                      ? 'bg-surf text-abyss pixel-border-active'
                      : 'bg-ocean text-mist/70 pixel-border',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <PixelBar
            value={completion}
            tone="gold"
            segments={20}
            height="sm"
            label="Collection"
            readout={`${Math.round(completion * 100)}%`}
            className="sm:max-w-[260px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              locked={!card.owned}
              onClick={() => navigate('cardDetail', { cardId: card.id })}
            />
          ))}
        </div>

        {cards.length === 0 && (
          <p className="text-mist/50 py-12 text-center text-[11px] tracking-[0.12em] uppercase">
            No cards of this rarity yet.
          </p>
        )}
      </ScreenFrame>
    </div>
  );
}
