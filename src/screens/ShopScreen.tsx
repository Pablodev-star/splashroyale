import { useState } from 'react';
import { LOOT_BOXES } from '@/data/lootBoxes';
import { RARITY_LABEL } from '@/data/cards';
import type { LootBox } from '@/types/game';
import { ScreenFrame } from '@/components/ui/ScreenFrame';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { PixelBar } from '@/components/ui/PixelBar';
import { useNavigation } from '@/state/NavigationContext';
import { usePlayer } from '@/state/PlayerContext';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Frame colour per box accent. Static maps — Tailwind needs literal classes. */
const ACCENT_FRAME: Record<LootBox['accent'], string> = {
  surf: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-surf)]',
  gold: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-gold)]',
  'rarity-epic': 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-rarity-epic)]',
  'rarity-legendary':
    'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-rarity-legendary)]',
};

const ACCENT_FILL: Record<LootBox['accent'], string> = {
  surf: 'bg-surf',
  gold: 'bg-gold',
  'rarity-epic': 'bg-rarity-epic',
  'rarity-legendary': 'bg-rarity-legendary',
};

const GUARANTEE_TONE = {
  common: 'common',
  rare: 'rare',
  epic: 'epic',
  legendary: 'legendary',
} as const;

/**
 * Loot box shop.
 *
 * PLACEHOLDER(Block 4): the boxes, their prices and the drop tables are static
 * data here, and buying is stubbed — Block 4 wires the economy, the probability
 * tables and the opening animation into these same slots.
 */
export function ShopScreen() {
  const { back } = useNavigation();
  const { profile } = usePlayer();
  const [pending, setPending] = useState<LootBox | null>(null);

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <ScreenFrame
        title="Loot Box Shop"
        subtitle="Spend the gold you earned in the pool"
        onBack={back}
        aside={
          <PixelBadge tone="gold" icon="◆" shimmer>
            {formatNumber(profile.gold)}
          </PixelBadge>
        }
      >
        {/* Daily gold cap — the anti-snowball rule from the design doc. */}
        <PixelPanel title="Daily gold" variant="default" className="mb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <PixelBar
              value={profile.dailyGoldEarned / profile.dailyGoldCap}
              tone="gold"
              segments={24}
              height="sm"
              className="flex-1"
              label="Earned today"
              readout={`${formatNumber(profile.dailyGoldEarned)}/${formatNumber(profile.dailyGoldCap)}`}
            />
            <p className="text-mist/50 max-w-xs text-[10px] leading-snug">
              Match rewards taper once you hit the cap, so a long session never runs away from the
              rest of the ladder.
            </p>
          </div>
        </PixelPanel>

        <div className="grid gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-4">
          {LOOT_BOXES.map((box) => {
            const affordable = profile.gold >= box.costGold;
            return (
              <div key={box.id} className={cn('bg-deep flex flex-col', ACCENT_FRAME[box.accent])}>
                <span aria-hidden className={cn('h-[3px] w-full', ACCENT_FILL[box.accent])} />

                {/* Box art placeholder: a stacked pixel crate. */}
                <div className="bg-abyss pixel-bevel-inset relative flex h-32 items-center justify-center overflow-hidden">
                  <div className="animate-bob relative h-16 w-20">
                    <span
                      className={cn('absolute inset-x-0 bottom-0 h-10', ACCENT_FILL[box.accent])}
                    />
                    <span className="bg-abyss/40 absolute inset-x-0 bottom-4 h-[3px]" />
                    <span className={cn('absolute inset-x-2 top-2 h-5', ACCENT_FILL[box.accent])} />
                    <span className="bg-abyss absolute top-2 left-1/2 h-5 w-[4px] -translate-x-1/2" />
                  </div>
                  <span className="absolute top-1 right-1">
                    <PixelBadge tone={GUARANTEE_TONE[box.guaranteed]}>
                      {RARITY_LABEL[box.guaranteed]}+
                    </PixelBadge>
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-3">
                  <span className="text-[12px] font-bold tracking-[0.12em] uppercase">
                    {box.name}
                  </span>
                  <span className="text-mist/60 text-[10px] leading-snug">{box.description}</span>
                  <span className="text-mist/45 text-[10px] tracking-[0.1em] uppercase">
                    {box.cardCount} cards
                  </span>
                  <PixelButton
                    variant={affordable ? 'gold' : 'secondary'}
                    size="md"
                    fullWidth
                    disabled={!affordable}
                    icon="◆"
                    className="mt-auto"
                    onClick={() => setPending(box)}
                  >
                    {formatNumber(box.costGold)}
                  </PixelButton>
                </div>
              </div>
            );
          })}
        </div>
      </ScreenFrame>

      {/* Purchase confirmation — the opening animation replaces this in Block 4. */}
      {pending && (
        <div className="bg-abyss/85 absolute inset-0 z-20 flex items-center justify-center p-4">
          <PixelPanel title={pending.name} variant="gold" className="w-full max-w-sm">
            <div className="flex flex-col gap-3">
              <p className="text-[11px] leading-snug">
                {pending.cardCount} cards · guaranteed {RARITY_LABEL[pending.guaranteed]} or better.
              </p>
              <p className="text-mist/50 text-[10px] leading-snug">
                Drop tables and the opening animation arrive with the progression block. Nothing is
                charged yet.
              </p>
              <div className="flex gap-2">
                <PixelButton variant="ghost" size="md" fullWidth onClick={() => setPending(null)}>
                  Close
                </PixelButton>
                <PixelButton variant="gold" size="md" fullWidth disabled icon="◆">
                  {formatNumber(pending.costGold)}
                </PixelButton>
              </div>
            </div>
          </PixelPanel>
        </div>
      )}
    </div>
  );
}
