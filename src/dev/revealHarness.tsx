import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Rarity } from '@/types/game';
import { CARD_DEF_BY_ID, resolveCard } from '@/data/cards';
import { CardReveal } from '@/components/packs/CardReveal';
import '@/index.css';

/**
 * Development harness for the pack-opening ceremony (Block 10B).
 *
 * Pack pulls are random, so driving the real shop cannot produce a legendary on
 * demand — which makes "is a legendary's ceremony actually longer than a
 * common's?" unanswerable through the app. This mounts `CardReveal` directly
 * with a chosen rarity and reports how long it took to settle, which is the
 * number the player actually feels.
 *
 * Served by `vite dev` at /reveal-harness.html; not part of the production
 * build, whose only entry is index.html.
 */

/** One real card per rarity, so the reveal renders genuine art and numbers. */
const SAMPLES: Record<Rarity, string> = {
  common: 'waterJet',
  rare: 'skipShot',
  epic: 'depthCharge',
  legendary: 'tsunamiKick',
};

function Harness() {
  const params = new URLSearchParams(location.search);
  const rarity = (params.get('rarity') as Rarity) ?? 'legendary';
  const reduced = params.get('reduced') === '1';

  const [runKey, setRunKey] = useState(0);
  const [startedAt, setStartedAt] = useState(() => performance.now());
  const [settledMs, setSettledMs] = useState<number | null>(null);

  const card = resolveCard(CARD_DEF_BY_ID[SAMPLES[rarity]], { level: 3, copies: 0 });

  const onSettled = useCallback(() => {
    setSettledMs((current) => current ?? performance.now() - startedAt);
  }, [startedAt]);

  const restart = () => {
    setSettledMs(null);
    setStartedAt(performance.now());
    setRunKey((value) => value + 1);
  };

  // Read by the screenshot script instead of scraping the DOM.
  (window as unknown as { __REVEAL__: unknown }).__REVEAL__ = {
    rarity,
    settledMs,
    restart,
  };

  return (
    <div className="bg-abyss flex h-screen w-screen flex-col items-center justify-center gap-6">
      <CardReveal
        card={card}
        rarity={rarity}
        revealKey={runKey}
        reducedMotion={reduced}
        onSettled={onSettled}
        className="min-h-[380px] w-full"
      />
      <div className="text-mist/60 font-mono text-xs">
        {rarity}
        {reduced ? ' (reduced motion)' : ''} —{' '}
        {settledMs === null ? 'running…' : `${Math.round(settledMs)}ms`}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
