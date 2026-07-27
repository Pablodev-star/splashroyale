import { PACKS, PACK_TIER_LABEL } from '@/data/packs';
import { RARITY_LABEL } from '@/data/cards';
import type { Pack, PackTier } from '@/types/game';
import { ScreenFrame } from '@/components/ui/ScreenFrame';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { PixelBar } from '@/components/ui/PixelBar';
import { Pack3D } from '@/components/packs/Pack3D';
import { useNavigation } from '@/state/NavigationContext';
import { usePlayer } from '@/state/PlayerContext';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Frame + accent per tier. Static maps — Tailwind needs literal class names. */
const TIER_FRAME: Record<PackTier, string> = {
  standard: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-lagoon)]',
  premium: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-gold)]',
  elite: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-rarity-epic)]',
  mythic: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-rarity-legendary)]',
};

const TIER_TONE: Record<PackTier, 'neutral' | 'surf' | 'gold' | 'epic' | 'legendary'> = {
  standard: 'neutral',
  premium: 'gold',
  elite: 'epic',
  mythic: 'legendary',
};

/**
 * The pack shop. Selecting a pack opens its 3D preview — buying is never one
 * click away from the grid, it always goes through the preview first.
 *
 * PLACEHOLDER(Block 4): inventory and prices are static data.
 */
export function ShopScreen() {
  const { navigate, back } = useNavigation();
  const { profile } = usePlayer();

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <ScreenFrame
        title="Card Packs"
        subtitle="Open packs to collect new abilities"
        onBack={back}
        aside={
          <PixelBadge tone="gold" icon="◆" shimmer>
            {formatNumber(profile.gold)}
          </PixelBadge>
        }
      >
        {/* Daily gold cap — the anti-snowball rule from the design doc. */}
        <PixelPanel title="Daily gold" variant="default" className="mb-4">
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

        <div className="grid gap-4 pb-6 sm:grid-cols-2 xl:grid-cols-4">
          {PACKS.map((pack, index) => (
            <PackTile
              key={pack.id}
              pack={pack}
              affordable={profile.gold >= pack.costGold}
              delayMs={index * 80}
              onSelect={() => navigate('packPreview', { packId: pack.id })}
            />
          ))}
        </div>
      </ScreenFrame>
    </div>
  );
}

function PackTile({
  pack,
  affordable,
  delayMs,
  onSelect,
}: {
  pack: Pack;
  affordable: boolean;
  delayMs: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${pack.name}, ${formatNumber(pack.costGold)} gold — view pack`}
      className={cn(
        'group bg-deep animate-rise-in relative flex flex-col overflow-hidden text-left',
        'transition-transform duration-[110ms] ease-[steps(3,jump-none)]',
        'hover:-translate-y-[4px] active:translate-y-[1px]',
        'focus-visible:outline-2 focus-visible:outline-offset-[7px] focus-visible:outline-foam',
        TIER_FRAME[pack.tier],
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {/* 3D pack sitting in its own well. The spin picks up on hover. */}
      <div className="bg-abyss pixel-bevel-inset relative flex h-52 items-center justify-center overflow-hidden">
        <div className="scale-[0.92] transition-transform duration-300 group-hover:scale-100">
          <Pack3D pack={pack} size="tile" spin effects={pack.tier !== 'standard'} />
        </div>
        <span className="absolute top-1.5 left-1.5">
          <PixelBadge tone={TIER_TONE[pack.tier]} shimmer={pack.tier === 'mythic'}>
            {PACK_TIER_LABEL[pack.tier]}
          </PixelBadge>
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="text-[13px] font-bold tracking-[0.1em] uppercase">{pack.name}</span>
        <span className="text-surf text-[10px] leading-snug">{pack.tagline}</span>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <PixelBadge tone="neutral">{pack.cardCount} cards</PixelBadge>
          <PixelBadge tone={pack.guaranteed === 'legendary' ? 'legendary' : 'surf'}>
            {RARITY_LABEL[pack.guaranteed]}+
          </PixelBadge>
        </div>

        {/* Price strip doubles as the affordance to open the preview. */}
        <div
          className={cn(
            'mt-auto flex items-center justify-between gap-2 px-2 py-2',
            'transition-colors duration-150',
            affordable ? 'bg-gold text-abyss group-hover:bg-[#ffd579]' : 'bg-ocean text-mist/60',
          )}
        >
          <span className="text-[12px] font-bold tabular-nums">
            ◆ {formatNumber(pack.costGold)}
          </span>
          <span className="text-[9px] font-bold tracking-[0.14em] uppercase">
            {affordable ? 'View →' : 'Locked'}
          </span>
        </div>
      </div>
    </button>
  );
}
