/**
 * The five splash tiers (Block 2C).
 *
 * This is the canonical definition. The charge meter used to carry its own copy
 * of the boundaries with a comment promising Block 2C would define them — it now
 * imports from here, so the notch a player sees and the splash they get can't
 * drift apart.
 */

export type SplashTier = 1 | 2 | 3 | 4 | 5;

/**
 * Charge values where the tier steps up. Four boundaries → five tiers, evenly
 * spaced so the meter's notches line up with them exactly.
 */
export const TIER_BOUNDARIES = [0.2, 0.4, 0.6, 0.8] as const;

/** Below this, releasing is a dribble and produces no splash at all. */
export const MIN_SPLASH_CHARGE = 0.08;

export function splashTierFor(charge: number): SplashTier {
  const clamped = Math.max(0, Math.min(1, charge));
  return (TIER_BOUNDARIES.filter((boundary) => clamped >= boundary).length + 1) as SplashTier;
}

export interface SplashSpec {
  /** Droplets thrown by the impact. */
  droplets: number;
  /** Base upward speed, in buffer pixels per second. */
  speed: number;
  /** Horizontal spread of the throw, as a fraction of `speed`. */
  spread: number;
  /** Seconds a droplet lives before it is culled. */
  life: number;
  /** Strength handed to the 2B ripple, 0..1. */
  ripple: number;
  /** Largest droplet edge, in buffer pixels. Bigger tiers throw chunkier water. */
  maxSize: number;
}

/**
 * Each tier is a clear step up in every dimension, so the tier is readable from
 * the splash alone without reading the meter.
 */
export const SPLASH_TIERS: Record<SplashTier, SplashSpec> = {
  1: { droplets: 6, speed: 34, spread: 0.55, life: 0.55, ripple: 0.22, maxSize: 1 },
  2: { droplets: 12, speed: 46, spread: 0.6, life: 0.7, ripple: 0.34, maxSize: 2 },
  3: { droplets: 20, speed: 60, spread: 0.66, life: 0.85, ripple: 0.5, maxSize: 2 },
  4: { droplets: 30, speed: 78, spread: 0.72, life: 1, ripple: 0.7, maxSize: 3 },
  5: { droplets: 46, speed: 98, spread: 0.8, life: 1.2, ripple: 0.95, maxSize: 3 },
};

export const TIER_LABEL: Record<SplashTier, string> = {
  1: 'Trickle',
  2: 'Splash',
  3: 'Surge',
  4: 'Breaker',
  5: 'Tidal',
};
