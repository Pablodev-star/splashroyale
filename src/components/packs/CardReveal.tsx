import { useEffect, useMemo, useState } from 'react';
import type { AbilityCard, Rarity } from '@/types/game';
import { RARITY_ORDER } from '@/data/cards';
import { GameCard } from '@/components/cards/GameCard';
import { cn } from '@/lib/cn';

/**
 * The reveal of a single pulled card (Block 10B).
 *
 * A pack used to show each card immediately and simply hold the screen longer
 * for a better rarity. The pause was the whole flourish, which meant the best
 * moment in the game — pulling a legendary — was *waiting*.
 *
 * This makes the interesting part the build-up instead. A sealed card climbs a
 * **rarity ladder**: it flashes as a common, snaps to rare, snaps to epic, and
 * so on, stopping at what it actually is. Every rung is a beat with its own
 * flash and shake, and each is faster and louder than the last. A common stops
 * at the first rung and is over in a quarter of a second; a legendary climbs
 * all four and takes nearly three seconds, so by the third snap you already
 * know something good is coming and the last one still lands.
 *
 * Two constraints the design has to respect and does:
 *
 * - **Skippable at any moment.** The tease is only fun the first hundred times.
 *   Tapping mid-ladder jumps straight to the reveal.
 * - **Reduced motion is not a shorter ceremony, it is no ceremony.** Anyone who
 *   has asked the OS to stop moving things gets the card, immediately, with no
 *   shake and no flash.
 *
 * The card is never in doubt — it was decided and banked before this screen
 * mounted. The ladder is showing you a result, not rolling one.
 */

export interface CardRevealProps {
  card: AbilityCard;
  rarity: Rarity;
  /** Restarts the ceremony. Pass the pull's index. */
  revealKey: number;
  reducedMotion: boolean;
  /** Fired once the card is fully revealed and the player may advance. */
  onSettled: () => void;
  className?: string;
}

/** Milliseconds each rung of the ladder holds, from the bottom up. */
const RUNG_MS = [190, 240, 330, 520];

/** How long the card holds after the burst before "tap to continue" appears. */
const SETTLE_MS: Record<Rarity, number> = {
  common: 130,
  rare: 260,
  epic: 420,
  legendary: 700,
};

const RARITY_COLOUR: Record<Rarity, string> = {
  common: 'var(--color-rarity-common)',
  rare: 'var(--color-rarity-rare)',
  epic: 'var(--color-rarity-epic)',
  legendary: 'var(--color-gold)',
};

/** Sparks in the burst. More for a better pull; this is the confetti budget. */
const SPARKS: Record<Rarity, number> = { common: 0, rare: 10, epic: 18, legendary: 30 };

type Phase = 'climbing' | 'burst' | 'revealed';

export function CardReveal({
  card,
  rarity,
  revealKey,
  reducedMotion,
  onSettled,
  className,
}: CardRevealProps) {
  const targetRung = RARITY_ORDER.indexOf(rarity);

  // Reduced motion skips the entire ceremony rather than shortening it.
  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'revealed' : 'climbing');
  const [rung, setRung] = useState(0);

  // Restart whenever a new card arrives.
  useEffect(() => {
    if (reducedMotion) {
      setPhase('revealed');
      setRung(targetRung);
      onSettled();
      return;
    }
    setPhase('climbing');
    setRung(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onSettled` is stable per card.
  }, [revealKey, reducedMotion]);

  // Climb one rung at a time, then burst, then settle.
  useEffect(() => {
    if (reducedMotion || phase !== 'climbing') return;
    const timer = window.setTimeout(
      () => {
        if (rung >= targetRung) setPhase('burst');
        else setRung((value) => value + 1);
      },
      RUNG_MS[Math.min(rung, RUNG_MS.length - 1)],
    );
    return () => window.clearTimeout(timer);
  }, [phase, rung, targetRung, reducedMotion]);

  useEffect(() => {
    if (phase !== 'burst') return;
    // The burst is the transition itself: the flash covers the swap from
    // sealed card to real card, which is what makes it feel like the card
    // *arrived* rather than crossfaded.
    const timer = window.setTimeout(() => setPhase('revealed'), 200);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'revealed' || reducedMotion) return;
    const timer = window.setTimeout(onSettled, SETTLE_MS[rarity]);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per phase entry.
  }, [phase, rarity, reducedMotion]);

  /** Colour of the rung currently showing — the tease, not the truth. */
  const rungRarity = RARITY_ORDER[Math.min(rung, targetRung)];
  const colour = RARITY_COLOUR[rungRarity];

  // Sparks are laid out once per card: recomputing them on every render would
  // re-scatter the burst mid-flight.
  const sparks = useMemo(() => {
    const count = SPARKS[rarity];
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.3;
      const reach = 90 + ((i * 37) % 130);
      return {
        dx: `${Math.cos(angle) * reach}px`,
        dy: `${Math.sin(angle) * reach}px`,
        size: i % 4 === 0 ? 8 : 5,
        delay: `${(i % 5) * 22}ms`,
      };
    });
  }, [rarity, revealKey]);

  const climbing = phase === 'climbing';
  const showCard = phase !== 'climbing';

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {/* Rays behind everything, spinning faster the higher the ladder goes. */}
      {!reducedMotion && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute h-[420px] w-[420px]',
            rung >= 2 ? 'animate-ray-spin-fast' : 'animate-ray-spin',
          )}
          style={{
            opacity: 0.1 + rung * 0.09,
            background: `conic-gradient(from 0deg, ${colour} 0deg 12deg, transparent 12deg 45deg, ${colour} 45deg 57deg, transparent 57deg 90deg, ${colour} 90deg 102deg, transparent 102deg 135deg, ${colour} 135deg 147deg, transparent 147deg 180deg, ${colour} 180deg 192deg, transparent 192deg 225deg, ${colour} 225deg 237deg, transparent 237deg 270deg, ${colour} 270deg 282deg, transparent 282deg 315deg, ${colour} 315deg 327deg, transparent 327deg 360deg)`,
            maskImage: 'radial-gradient(circle, transparent 28%, #000 42%, #000 70%, transparent 82%)',
            WebkitMaskImage:
              'radial-gradient(circle, transparent 28%, #000 42%, #000 70%, transparent 82%)',
          }}
        />
      )}

      {/* The sealed card, climbing. */}
      {climbing && (
        <div
          className={cn(
            'relative w-[min(240px,60vw)]',
            // Only the top rungs shake, and only the very top shakes hard —
            // starting the shake immediately would leave nowhere to escalate to.
            rung >= 3 ? 'animate-shake-hard' : rung >= 2 ? 'animate-shake' : undefined,
          )}
        >
          <div
            className="animate-orb-pulse bg-deep pixel-bevel-inset relative flex aspect-[5/7] w-full items-center justify-center overflow-hidden"
            style={{
              // The pulse quickens with the ladder: the same keyframe, a
              // shorter cycle.
              animationDuration: `${620 - rung * 130}ms`,
              boxShadow: `0 0 0 4px var(--color-abyss), 0 0 0 8px ${colour}, 0 0 42px ${colour}`,
            }}
          >
            <span
              aria-hidden
              className="absolute inset-0"
              style={{ background: colour, opacity: 0.1 + rung * 0.08 }}
            />
            <span
              className="relative font-bold"
              style={{ color: colour, fontSize: 84, lineHeight: 1, textShadow: `0 0 26px ${colour}` }}
            >
              ?
            </span>
          </div>
        </div>
      )}

      {/* The card itself. */}
      {showCard && (
        <div
          key={revealKey}
          className={cn(
            'relative w-[min(240px,60vw)]',
            !reducedMotion && 'animate-slam-in',
            !reducedMotion && rarity === 'legendary' && 'animate-tilt',
          )}
        >
          <GameCard card={card} size="md" showProgress={false} static />
        </div>
      )}

      {/* Burst: rings, sparks and a full-bleed flash, all one-shot. */}
      {phase === 'burst' && !reducedMotion && (
        <>
          {[0, 1, 2].slice(0, rarity === 'common' ? 1 : rarity === 'rare' ? 2 : 3).map((ring) => (
            <span
              key={ring}
              aria-hidden
              className="animate-ring-out pointer-events-none absolute h-40 w-40 rounded-none"
              style={{
                border: `6px solid ${RARITY_COLOUR[rarity]}`,
                animationDelay: `${ring * 90}ms`,
              }}
            />
          ))}
          {sparks.map((spark, index) => (
            <span
              key={index}
              aria-hidden
              className="animate-spark-out pointer-events-none absolute"
              style={
                {
                  width: spark.size,
                  height: spark.size,
                  background: index % 3 === 0 ? '#ffffff' : RARITY_COLOUR[rarity],
                  animationDelay: spark.delay,
                  '--dx': spark.dx,
                  '--dy': spark.dy,
                } as React.CSSProperties
              }
            />
          ))}
          <span
            aria-hidden
            className="animate-flash-out pointer-events-none fixed inset-0 z-30"
            style={{ background: rarity === 'legendary' ? '#ffffff' : RARITY_COLOUR[rarity] }}
          />
        </>
      )}
    </div>
  );
}
