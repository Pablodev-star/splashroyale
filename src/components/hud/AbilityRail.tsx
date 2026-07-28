import type { AbilityCard, AbilitySlot, Rarity } from '@/types/game';
import { SLOT_GLYPH, SLOT_LABEL, SLOT_ORDER } from '@/data/cards';
import { cn } from '@/lib/cn';

export interface AbilityRailProps {
  /** The equipped card per slot. A slot may be missing while a deck is loading. */
  cards: Partial<Record<AbilitySlot, AbilityCard>>;
  className?: string;
}

const ACCENT: Record<Rarity, string> = {
  common: 'border-l-rarity-common',
  rare: 'border-l-rarity-rare',
  epic: 'border-l-rarity-epic',
  legendary: 'border-l-rarity-legendary',
};

/**
 * The three equipped abilities, read-only, shown beside the minimap.
 *
 * Deliberately desktop-only: on phones the touch pads and the ultimate tank
 * already carry all three names, so a fourth surface would just take space the
 * joystick needs. Cooldown state belongs to Block 3C — this shows *what* is
 * equipped, which is what the deck screen promised.
 */
export function AbilityRail({ cards, className }: AbilityRailProps) {
  return (
    <ul className={cn('flex flex-col gap-1', className)}>
      {SLOT_ORDER.map((slot) => {
        const card = cards[slot];
        if (!card) return null;
        return (
          <li
            key={slot}
            className={cn(
              'bg-abyss/75 flex items-center gap-2 border-l-4 px-2 py-1',
              ACCENT[card.rarity],
            )}
          >
            <span className="text-surf w-3 text-center text-[11px] leading-none">
              {SLOT_GLYPH[slot]}
            </span>
            <span className="min-w-0">
              <span className="text-mist/40 block text-[7px] tracking-[0.16em] uppercase">
                {SLOT_LABEL[slot]}
              </span>
              <span className="text-mist block truncate text-[9px] font-bold tracking-[0.1em] uppercase">
                {card.name}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
