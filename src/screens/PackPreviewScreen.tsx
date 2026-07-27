import { useState } from 'react';
import { PACK_BY_ID, PACK_TIER_LABEL } from '@/data/packs';
import { CARDS, RARITY_LABEL, RARITY_ORDER } from '@/data/cards';
import { GameCard } from '@/components/cards/GameCard';
import { Pack3D } from '@/components/packs/Pack3D';
import { OddsTable } from '@/components/packs/OddsTable';
import { WaterCanvas } from '@/components/water/WaterCanvas';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelIconButton } from '@/components/ui/PixelIconButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { useNavigation } from '@/state/NavigationContext';
import { usePlayer } from '@/state/PlayerContext';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { PackTier } from '@/types/game';

export interface PackPreviewScreenProps {
  packId: string;
}

/** Three cards from the pool this pack draws from, best rarity first. */
function sampleCards(guaranteed: (typeof RARITY_ORDER)[number]) {
  const floor = RARITY_ORDER.indexOf(guaranteed);
  const eligible = CARDS.filter((card) => RARITY_ORDER.indexOf(card.rarity) >= floor);
  const pool = eligible.length >= 3 ? eligible : CARDS;
  return [...pool]
    .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity))
    .slice(0, 3);
}

const TIER_TONE: Record<PackTier, 'neutral' | 'surf' | 'epic' | 'legendary'> = {
  standard: 'neutral',
  premium: 'surf',
  elite: 'epic',
  mythic: 'legendary',
};

/**
 * Full-screen showcase for a single pack: the wrapper turns in 3D on the left,
 * its contents and pull rates sit on the right, and buying is one deliberate
 * step further (the confirmation only opens from the Buy button).
 */
export function PackPreviewScreen({ packId }: PackPreviewScreenProps) {
  const { back } = useNavigation();
  const { profile, spendGold } = usePlayer();
  const [confirming, setConfirming] = useState(false);
  const [purchased, setPurchased] = useState(false);

  const pack = PACK_BY_ID[packId];

  if (!pack) {
    return (
      <div className="bg-abyss flex h-full w-full items-center justify-center">
        <PixelPanel title="Pack">
          <p className="text-mist/60 text-[11px]">That pack is no longer on the shelf.</p>
          <PixelButton className="mt-3" variant="primary" size="md" onClick={back}>
            Back
          </PixelButton>
        </PixelPanel>
      </div>
    );
  }

  const affordable = profile.gold >= pack.costGold;

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <WaterCanvas variant="background" pixelSize={9} fps={20} className="absolute inset-0" />
      <div aria-hidden className="bg-abyss/85 absolute inset-0" />

      {/* Back button, top-left. */}
      <div className="absolute top-3 left-3 z-30">
        <PixelIconButton ariaLabel="Back to shop" onClick={back}>
          {'<'}
        </PixelIconButton>
      </div>

      <div className="relative flex h-full flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Stage: the pack itself. */}
        <div className="relative flex min-h-[46vh] flex-1 items-center justify-center lg:min-h-0">
          <Pack3D pack={pack} size="hero" spin effects className="scale-[0.78] sm:scale-100" />

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 lg:bottom-6">
            <PixelBadge tone={TIER_TONE[pack.tier]} shimmer={pack.tier === 'mythic'}>
              {PACK_TIER_LABEL[pack.tier]} pack
            </PixelBadge>
          </div>
        </div>

        {/* Details: contents + odds + buy. */}
        <div className="relative flex w-full shrink-0 flex-col lg:w-[420px] lg:border-l-[3px] lg:border-lagoon">
          <div className="flex flex-1 flex-col gap-3 p-4 lg:overflow-y-auto">
            <div className="animate-rise-in">
              <h1
                className={cn(
                  'text-pixel-shadow text-2xl tracking-[0.16em] uppercase sm:text-3xl',
                  pack.tier === 'mythic' ? 'animate-rainbow-text' : 'text-mist',
                )}
              >
                {pack.name}
              </h1>
              <p className="text-surf mt-1 text-[11px] tracking-[0.08em]">{pack.tagline}</p>
            </div>

            <p
              className="text-mist/70 animate-rise-in text-[11px] leading-relaxed"
              style={{ animationDelay: '60ms' }}
            >
              {pack.description}
            </p>

            <div
              className="animate-rise-in flex flex-wrap gap-2"
              style={{ animationDelay: '90ms' }}
            >
              <PixelBadge tone="surf" icon="▤">
                {pack.cardCount} cards
              </PixelBadge>
              <PixelBadge tone={pack.guaranteed === 'legendary' ? 'legendary' : 'gold'}>
                {RARITY_LABEL[pack.guaranteed]}+ guaranteed
              </PixelBadge>
            </div>

            <PixelPanel title="Pull rates" variant="default" className="animate-rise-in">
              <OddsTable odds={pack.odds} guaranteed={pack.guaranteed} />
            </PixelPanel>

            {/* A taste of what is actually inside. */}
            <PixelPanel title="Cards you could pull" variant="default" className="animate-rise-in">
              <div className="grid grid-cols-3 gap-2">
                {sampleCards(pack.guaranteed).map((card) => (
                  <GameCard key={card.id} card={card} size="sm" showProgress={false} static />
                ))}
              </div>
            </PixelPanel>
          </div>

          {/* Buy bar, bottom-right of the panel. */}
          <div className="border-lagoon bg-deep/90 flex items-center justify-between gap-3 border-t-[3px] p-3">
            <div className="min-w-0">
              <div className="text-mist/50 text-[9px] tracking-[0.16em] uppercase">Your gold</div>
              <div className={cn('text-sm tabular-nums', affordable ? 'text-gold' : 'text-danger')}>
                ◆ {formatNumber(profile.gold)}
              </div>
            </div>
            <PixelButton
              variant="gold"
              size="lg"
              icon="◆"
              emphasis={affordable}
              disabled={!affordable}
              onClick={() => setConfirming(true)}
            >
              Buy {formatNumber(pack.costGold)}
            </PixelButton>
          </div>
        </div>
      </div>

      {/* Confirmation — only reachable from the Buy button. */}
      {confirming && (
        <div className="bg-abyss/88 absolute inset-0 z-40 flex items-center justify-center p-4">
          <PixelPanel
            title={purchased ? 'Pack secured' : 'Confirm purchase'}
            variant="gold"
            className="animate-pop-in w-full max-w-sm"
          >
            {purchased ? (
              <div className="flex flex-col gap-3 text-center">
                <div className="animate-levitate mx-auto">
                  <Pack3D pack={pack} size="tile" spin effects={false} />
                </div>
                <p className="text-[11px] leading-snug">
                  {pack.name} is in your inventory. The opening ceremony — cards revealed one by one
                  — lands with the progression block.
                </p>
                <PixelButton
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    setConfirming(false);
                    setPurchased(false);
                  }}
                >
                  Done
                </PixelButton>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] leading-snug">
                  Buy <span className="text-gold">{pack.name}</span> for{' '}
                  <span className="text-gold tabular-nums">◆ {formatNumber(pack.costGold)}</span>?
                </p>
                <p className="text-mist/50 text-[10px] leading-snug">
                  {pack.cardCount} cards · {RARITY_LABEL[pack.guaranteed]} or better guaranteed.
                  Your balance after: ◆ {formatNumber(profile.gold - pack.costGold)}.
                </p>
                <div className="flex gap-2">
                  <PixelButton
                    variant="ghost"
                    size="md"
                    fullWidth
                    onClick={() => setConfirming(false)}
                  >
                    Cancel
                  </PixelButton>
                  <PixelButton
                    variant="gold"
                    size="md"
                    fullWidth
                    icon="◆"
                    onClick={() => {
                      if (spendGold(pack.costGold)) setPurchased(true);
                    }}
                  >
                    Buy
                  </PixelButton>
                </div>
              </div>
            )}
          </PixelPanel>
        </div>
      )}
    </div>
  );
}
