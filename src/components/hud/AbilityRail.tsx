import type { AbilityCard, AbilitySlot, Rarity } from '@/types/game';
import { SLOT_LABEL, SLOT_ORDER } from '@/data/cards';
import { SLOT_CAP } from '@/game/input/keybinds';
import { KeyCap } from '@/components/ui/KeyCap';
import { CardArt } from '@/components/cards/CardArt';
import { cn } from '@/lib/cn';

export interface AbilityRailProps {
  /** The equipped card per slot. A slot may be missing while a deck is loading. */
  cards: Partial<Record<AbilitySlot, AbilityCard>>;
  /** Seconds left per slot, from the engine. Omitted outside a live match. */
  cooldowns?: Partial<Record<AbilitySlot, number>>;
  /** Stamps the bound key on each row. Off on touch, where there is no key. */
  showKeys?: boolean;
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
 * joystick needs.
 *
 * Cooldown is shown by draining the row's fill rather than by printing a
 * number: what a player needs mid-fight is "can I press this yet", read at a
 * glance, not a countdown to two decimal places.
 */
export function AbilityRail({
  cards,
  cooldowns,
  showKeys = false,
  className,
}: AbilityRailProps) {
  return (
    <ul className={cn('flex flex-col gap-1', className)}>
      {SLOT_ORDER.map((slot) => {
        const card = cards[slot];
        if (!card) return null;
        const remaining = cooldowns?.[slot] ?? 0;
        const total = card.ability.cooldownS || 1;
        const cooling = remaining > 0.05;
        return (
          <li
            key={slot}
            className={cn(
              'bg-abyss/75 relative flex items-center gap-2 overflow-hidden border-l-4 px-2 py-1',
              ACCENT[card.rarity],
            )}
          >
            {cooling && (
              <span
                aria-hidden
                className="bg-abyss/70 absolute inset-y-0 left-0"
                style={{ width: `${Math.min(100, (remaining / total) * 100)}%` }}
              />
            )}
            {showKeys ? (
              <KeyCap muted={cooling} className="relative">
                {SLOT_CAP[slot]}
              </KeyCap>
            ) : (
              // The card's own picture, not the slot's glyph: on touch this row
              // is the only place the equipped ability is named, and three
              // identical `≈` told you nothing about which one you had.
              <span
                className={cn(
                  'relative block h-3.5 w-3.5 shrink-0',
                  cooling ? 'text-mist/30' : 'text-surf',
                )}
              >
                <CardArt card={card} />
              </span>
            )}
            <span className="relative min-w-0">
              <span className="text-mist/40 block text-[7px] tracking-[0.16em] uppercase">
                {SLOT_LABEL[slot]}
              </span>
              <span
                className={cn(
                  'block truncate text-[9px] font-bold tracking-[0.1em] uppercase',
                  cooling ? 'text-mist/45' : 'text-mist',
                )}
              >
                {card.name}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
