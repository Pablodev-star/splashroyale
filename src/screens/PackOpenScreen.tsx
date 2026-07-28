import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Rarity } from '@/types/game';
import { PACK_BY_ID } from '@/data/packs';
import { RARITY_LABEL, RARITY_ORDER } from '@/data/cards';
import type { PackPull } from '@/game/progression/packRoll';
import { GameCard } from '@/components/cards/GameCard';
import { Pack3D } from '@/components/packs/Pack3D';
import { WaterCanvas } from '@/components/water/WaterCanvas';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { useNavigation } from '@/state/NavigationContext';
import { useCollection } from '@/state/PlayerContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

export interface PackOpenScreenProps {
  packId: string;
  pulls: PackPull[];
  goldFromDuplicates: number;
}

/** How long each card sits alone on screen before the next one can be taken. */
const REVEAL_MS: Record<Rarity, number> = {
  common: 260,
  rare: 420,
  epic: 650,
  legendary: 1000,
};

const GLOW: Record<Rarity, string> = {
  common: 'shadow-[0_0_0_3px_var(--color-rarity-common)]',
  rare: 'shadow-[0_0_0_3px_var(--color-rarity-rare)]',
  epic: 'shadow-[0_0_0_3px_var(--color-rarity-epic)]',
  legendary: 'animate-rainbow-frame',
};

/**
 * Opening a pack, one card at a time (Block 4).
 *
 * The pulls arrive already applied — the gold is spent and the cards are in the
 * collection before this screen mounts. That is deliberate: the ceremony is a
 * *presentation* of something that already happened, so backing out, reloading
 * or losing the tab cannot cost the player a pack.
 *
 * Rarity controls the pacing rather than only the colour. A common flashes past;
 * a legendary holds the screen for a full second before you can move on, because
 * the pause is most of what makes it feel rare.
 */
export function PackOpenScreen({ packId, pulls, goldFromDuplicates }: PackOpenScreenProps) {
  const { navigate, back } = useNavigation();
  const { cardById } = useCollection();
  const reducedMotion = useReducedMotion();
  const pack = PACK_BY_ID[packId];

  /** -1 is the unopened wrapper; `pulls.length` is the summary. */
  const [index, setIndex] = useState(-1);
  /** Guards the tap-through so a legendary cannot be skipped instantly. */
  const [settled, setSettled] = useState(false);

  const current = index >= 0 && index < pulls.length ? pulls[index] : undefined;
  const card = current ? cardById[current.cardId] : undefined;

  useEffect(() => {
    if (!current) {
      setSettled(true);
      return;
    }
    setSettled(false);
    // Reduced motion still gets the ordering and the summary, just without the
    // enforced dwell — the whole point of the pause is the flourish.
    const hold = reducedMotion ? 0 : REVEAL_MS[current.rarity];
    const timer = window.setTimeout(() => setSettled(true), hold);
    return () => window.clearTimeout(timer);
  }, [current, reducedMotion]);

  const advance = useCallback(() => {
    if (!settled) return;
    setIndex((value) => Math.min(value + 1, pulls.length));
  }, [settled, pulls.length]);

  const revealAll = useCallback(() => setIndex(pulls.length), [pulls.length]);

  const summary = useMemo(() => {
    const counts = RARITY_ORDER.map((rarity) => ({
      rarity,
      count: pulls.filter((pull) => pull.rarity === rarity).length,
    })).filter((entry) => entry.count > 0);
    return { counts, newCards: pulls.filter((pull) => pull.isNew).length };
  }, [pulls]);

  if (!pack) {
    return (
      <div className="bg-abyss flex h-full w-full items-center justify-center p-4">
        <PixelPanel title="Pack">
          <p className="text-mist/60 text-[11px]">That pack is no longer on the shelf.</p>
          <PixelButton className="mt-3" variant="primary" size="md" onClick={back}>
            Back
          </PixelButton>
        </PixelPanel>
      </div>
    );
  }

  const done = index >= pulls.length;

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <WaterCanvas variant="background" pixelSize={9} fps={20} className="absolute inset-0" />
      <div aria-hidden className="bg-abyss/90 absolute inset-0" />

      <div className="relative flex h-full flex-col">
        <div className="stage flex shrink-0 items-center justify-between gap-2">
          <span className="text-mist/60 text-[10px] tracking-[0.16em] uppercase">{pack.name}</span>
          {!done && index >= 0 && (
            <span className="text-mist/50 text-[10px] tabular-nums">
              {index + 1} / {pulls.length}
            </span>
          )}
        </div>

        {/* --- The wrapper, before anything is revealed --------------------- */}
        {index < 0 && (
          <button
            type="button"
            onClick={() => setIndex(0)}
            className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-6 focus-visible:outline-2 focus-visible:outline-offset-[-8px] focus-visible:outline-foam"
          >
            <div className="animate-levitate">
              <Pack3D pack={pack} size="hero" spin />
            </div>
            <span className="text-surf animate-pulse-glow text-sm tracking-[0.2em] uppercase">
              Tap to open
            </span>
          </button>
        )}

        {/* --- One card at a time ------------------------------------------ */}
        {current && card && (
          <button
            type="button"
            onClick={advance}
            aria-label={`${card.name}, ${RARITY_LABEL[current.rarity]}${
              current.isNew ? ', new' : ''
            }. Tap for the next card.`}
            className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-4 px-4 focus-visible:outline-2 focus-visible:outline-offset-[-8px] focus-visible:outline-foam"
          >
            <div
              key={index}
              className={cn(
                'animate-pop-in w-[min(240px,60vw)]',
                !reducedMotion && current.rarity === 'legendary' && 'animate-tilt',
              )}
            >
              <div className={cn(GLOW[current.rarity])}>
                <GameCard card={card} size="md" showProgress={false} static />
              </div>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              {current.isNew ? (
                <PixelBadge tone="surf" shimmer>
                  New card
                </PixelBadge>
              ) : (
                <PixelBadge tone="neutral">
                  {card.level >= card.maxLevel ? 'Maxed — traded for gold' : '+1 copy'}
                </PixelBadge>
              )}
              <span className="text-mist/50 text-[10px] tracking-[0.14em] uppercase">
                {settled ? 'Tap to continue' : ' '}
              </span>
            </div>
          </button>
        )}

        {/* --- Everything at once ------------------------------------------- */}
        {done && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="stage flex flex-col gap-3">
              <PixelPanel
                title="Pack opened"
                variant="gold"
                headerAside={`${pulls.length} cards`}
                className="animate-rise-in"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {summary.counts.map((entry) => (
                    <PixelBadge
                      key={entry.rarity}
                      tone={entry.rarity as 'common' | 'rare' | 'epic' | 'legendary'}
                    >
                      {entry.count}× {RARITY_LABEL[entry.rarity]}
                    </PixelBadge>
                  ))}
                  {summary.newCards > 0 && (
                    <PixelBadge tone="surf" shimmer>
                      {summary.newCards} new
                    </PixelBadge>
                  )}
                  {goldFromDuplicates > 0 && (
                    <PixelBadge tone="gold" icon="◆">
                      +{formatNumber(goldFromDuplicates)}
                    </PixelBadge>
                  )}
                </div>
                {goldFromDuplicates > 0 && (
                  <p className="text-mist/50 mt-2 text-[10px] leading-snug">
                    Duplicates of cards already at max level paid gold instead of copies.
                  </p>
                )}
              </PixelPanel>

              <div className="grid grid-cols-3 gap-2 pb-4 sm:grid-cols-4 md:grid-cols-5">
                {pulls.map((pull, position) => {
                  const pulled = cardById[pull.cardId];
                  if (!pulled) return null;
                  return (
                    <div key={`${pull.cardId}-${position}`} className="relative">
                      <GameCard
                        card={pulled}
                        size="sm"
                        showProgress={false}
                        badge={
                          pull.isNew ? <PixelBadge tone="surf">New</PixelBadge> : undefined
                        }
                        className="animate-rise-in"
                        style={{ animationDelay: `${Math.min(position * 60, 500)}ms` }}
                        onClick={() => navigate('cardDetail', { cardId: pull.cardId })}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="bg-abyss/90 border-t-[3px] border-lagoon shrink-0">
          <div className="stage flex flex-wrap items-center justify-end gap-2">
            {!done && index >= 0 && (
              <PixelButton variant="ghost" size="md" onClick={revealAll}>
                Skip
              </PixelButton>
            )}
            {done && (
              <>
                <span className="text-mist/45 mr-auto text-[10px] tracking-[0.12em] uppercase">
                  Everything is already in your collection
                </span>
                <PixelButton
                  variant="secondary"
                  size="md"
                  icon="✦"
                  onClick={() => navigate('collection')}
                >
                  Collection
                </PixelButton>
                <PixelButton variant="primary" size="lg" icon="▣" emphasis onClick={back}>
                  Back to packs
                </PixelButton>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
