import { useEffect, useMemo, useState } from 'react';
import type { AbilitySlot, Rarity } from '@/types/game';
import {
  RARITY_LABEL,
  RARITY_ORDER,
  SLOT_GLYPH,
  SLOT_HINT,
  SLOT_LABEL,
  cardsForSlot,
} from '@/data/cards';
import { canEquip } from '@/data/decks';
import { GameCard } from './GameCard';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { PixelIconButton } from '@/components/ui/PixelIconButton';
import { cn } from '@/lib/cn';

export interface CardPickerProps {
  slot: AbilitySlot;
  /** Currently equipped card id, highlighted in the grid. */
  equippedId: string;
  onPick: (cardId: string) => void;
  onClose: () => void;
}

type RarityFilter = 'all' | Rarity;

const RARITY_CHIP: Record<Rarity, string> = {
  common: 'bg-rarity-common text-abyss',
  rare: 'bg-rarity-rare text-abyss',
  epic: 'bg-rarity-epic text-abyss',
  legendary: 'animate-[rainbow-fill_4s_linear_infinite] text-abyss',
};

/**
 * Picks one card for one slot.
 *
 * An overlay rather than a route: the deck stays on screen behind it, so the
 * choice is made against the loadout it changes instead of on a page of its
 * own. Only cards authored for this slot are listed at all — the slot rule is
 * expressed by what you are offered, never by an error after the fact.
 */
export function CardPicker({ slot, equippedId, onPick, onClose }: CardPickerProps) {
  const [rarity, setRarity] = useState<RarityFilter>('all');

  // Escape closes it, like every other overlay in the app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cards = useMemo(() => {
    const all = cardsForSlot(slot).filter(
      (card) => rarity === 'all' || card.rarity === rarity,
    );
    // Owned first, then rarest first: the cards you can act on are never below
    // the fold, and within them the interesting ones lead.
    return all.sort((a, b) => {
      const ownable = Number(canEquip(b, slot)) - Number(canEquip(a, slot));
      if (ownable !== 0) return ownable;
      const byRarity = RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
      return byRarity !== 0 ? byRarity : a.name.localeCompare(b.name);
    });
  }, [slot, rarity]);

  const ownedCount = cardsForSlot(slot).filter((card) => canEquip(card, slot)).length;

  return (
    // Opaque, not a scrim: at 92% the deck screen's own header and panels showed
    // through and collided with the picker's, which read as a rendering fault.
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Choose a card for ${SLOT_LABEL[slot]}`}
      className="bg-abyss animate-pop-in absolute inset-0 z-40 flex flex-col"
    >
      <header className="stage flex shrink-0 items-center gap-3 pb-2">
        <PixelIconButton ariaLabel="Close card picker" onClick={onClose}>
          ×
        </PixelIconButton>
        <div className="min-w-0 flex-1">
          <h2 className="text-pixel-shadow flex items-center gap-2 truncate text-base tracking-[0.16em] uppercase sm:text-xl">
            <span className="text-surf">{SLOT_GLYPH[slot]}</span>
            {SLOT_LABEL[slot]}
          </h2>
          <p className="text-mist/60 truncate text-[10px] tracking-[0.12em]">{SLOT_HINT[slot]}</p>
        </div>
        <PixelBadge tone="surf">{ownedCount} owned</PixelBadge>
      </header>

      {/* Rarity filter. Purely a filter — every rarity is legal in every slot. */}
      <div className="stage flex shrink-0 flex-wrap gap-1.5 pb-2">
        <button
          type="button"
          onClick={() => setRarity('all')}
          aria-pressed={rarity === 'all'}
          className={cn(
            'px-3 py-2 text-[10px] font-bold tracking-[0.12em] uppercase',
            'transition-transform duration-[110ms] ease-[steps(3,jump-none)] hover:-translate-y-[2px]',
            'focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-foam',
            rarity === 'all'
              ? 'bg-surf text-abyss pixel-border-active'
              : 'bg-ocean text-mist/70 pixel-border',
          )}
        >
          All
        </button>
        {RARITY_ORDER.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRarity(rarity === value ? 'all' : value)}
            aria-pressed={rarity === value}
            className={cn(
              'px-3 py-2 text-[10px] font-bold tracking-[0.12em] uppercase',
              'transition-transform duration-[110ms] ease-[steps(3,jump-none)] hover:-translate-y-[2px]',
              'focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-foam',
              rarity === value ? 'pixel-border-active' : 'pixel-border opacity-70',
              RARITY_CHIP[value],
            )}
          >
            {RARITY_LABEL[value]}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="stage grid grid-cols-2 gap-3 pb-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {cards.map((card, index) => {
            const usable = canEquip(card, slot);
            const equipped = card.id === equippedId;
            return (
              <GameCard
                key={card.id}
                card={card}
                size="md"
                locked={!usable}
                showProgress={false}
                badge={equipped ? <PixelBadge tone="surf">Equipped</PixelBadge> : undefined}
                className="animate-rise-in"
                style={{ animationDelay: `${Math.min(index * 45, 400)}ms` }}
                onClick={usable ? () => onPick(card.id) : undefined}
              />
            );
          })}
        </div>

        {cards.length === 0 && (
          <p className="text-mist/50 py-16 text-center text-[11px] tracking-[0.12em] uppercase">
            No {rarity === 'all' ? '' : `${RARITY_LABEL[rarity as Rarity]} `}cards for this slot.
          </p>
        )}
      </div>

      <div className="bg-abyss/90 border-t-[3px] border-lagoon shrink-0">
        <div className="stage flex items-center justify-end gap-2">
          <span className="text-mist/45 mr-auto text-[10px] tracking-[0.12em] uppercase">
            Any rarity fits any slot
          </span>
          <PixelButton variant="ghost" size="md" onClick={onClose}>
            Cancel
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
