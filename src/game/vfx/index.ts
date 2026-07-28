/**
 * Block 2C public surface.
 *
 * Block 3 emits `SplashEvent`s (position + tier from the released charge); the
 * arena plays them through `useSplashEvents`, which drives both the droplet
 * burst and the 2B surface ripple from one tier spec.
 */
export { useSplashEvents, type SplashEvent, type SplashTarget } from './useSplashEvents';
export {
  SPLASH_TIERS,
  TIER_BOUNDARIES,
  TIER_LABEL,
  MIN_SPLASH_CHARGE,
  splashTierFor,
  type SplashSpec,
  type SplashTier,
} from './splashTiers';
export { spawnSplash, stepDroplets, MAX_DROPLETS, type Droplet } from './droplets';
