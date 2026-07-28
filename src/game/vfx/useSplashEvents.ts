import { useEffect, useRef, type RefObject } from 'react';
import type { WaterCanvasHandle } from '@/components/water/WaterCanvas';
import { SPLASH_TIERS, type SplashTier } from './splashTiers';
import type { VfxCanvasHandle } from './VfxCanvas';

/**
 * A splash that happened. `id` must be unique and stable — it is how the hook
 * knows an event is new rather than the same one arriving on another render.
 */
export interface SplashEvent {
  id: number;
  /** Normalised **canvas** coordinates, 0..1. */
  x: number;
  y: number;
  tier: SplashTier;
}

/**
 * Plays splash events exactly once (Block 2C).
 *
 * This is where 2C meets 2B: one impact drives both the droplet burst and the
 * surface ripple, with the ripple's strength taken from the same tier spec, so a
 * tier 5 hit throws more water *and* disturbs the surface harder without the two
 * being tuned separately.
 *
 * Events arrive in a list that is re-rendered every frame, so the played ids are
 * tracked in a ref; replaying on every render would spawn a burst per frame.
 */
export function useSplashEvents(
  vfx: RefObject<VfxCanvasHandle | null>,
  water: RefObject<WaterCanvasHandle | null>,
  events: SplashEvent[],
): void {
  const playedRef = useRef(new Set<number>());

  useEffect(() => {
    const played = playedRef.current;

    for (const event of events) {
      if (played.has(event.id)) continue;
      played.add(event.id);

      vfx.current?.splash(event.x, event.y, event.tier);
      water.current?.spawnRipple(event.x, event.y, SPLASH_TIERS[event.tier].ripple);
    }

    // The caller keeps only a short window of recent events, so anything no
    // longer in the list can be forgotten — otherwise this grows all match.
    if (played.size > 64) {
      const live = new Set(events.map((event) => event.id));
      for (const id of played) {
        if (!live.has(id)) played.delete(id);
      }
    }
  }, [events, vfx, water]);
}
