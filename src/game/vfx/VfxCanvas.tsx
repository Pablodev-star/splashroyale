import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { useAnimationFrame } from '@/hooks/useAnimationFrame';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { WaterPalette } from '@/types/game';
import { spawnSplash, stepDroplets, type Droplet } from './droplets';
import { SPLASH_TIERS, type SplashTier } from './splashTiers';

export interface VfxCanvasHandle {
  /** Throw a splash at normalised canvas coordinates (0..1). */
  splash: (nx: number, ny: number, tier: SplashTier) => void;
  /** Live droplet count — for tests and debugging. */
  count: () => number;
}

export interface VfxCanvasProps {
  /** Splash colours are taken from the map so water matches its arena. */
  palette: WaterPalette;
  /** CSS pixels per rendered pixel. Larger = chunkier and cheaper. */
  pixelSize?: number;
  fps?: number;
  className?: string;
  ref?: Ref<VfxCanvasHandle>;
}

/**
 * The splash layer (Block 2C).
 *
 * A low-resolution canvas over the arena that draws droplets as hard-edged
 * pixels, upscaled by CSS — the same trick the water renderer uses, so splashes
 * land on the same pixel grid as everything else instead of looking like smooth
 * sprites pasted on top.
 *
 * The layer sleeps when there is nothing in flight: with no droplets alive the
 * loop clears once and stops scheduling, so an idle match costs nothing.
 */
export function VfxCanvas({
  palette,
  pixelSize = 5,
  fps = 30,
  className,
  ref,
}: VfxCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dropletsRef = useRef<Droplet[]>([]);
  const reducedMotion = useReducedMotion();
  // Set while droplets are in flight; lets the loop idle when the pool is empty.
  const dirtyRef = useRef(false);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const width = Math.max(8, Math.ceil(rect.width / pixelSize));
    const height = Math.max(8, Math.ceil(rect.height / pixelSize));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }, [pixelSize]);

  useEffect(() => {
    resize();
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [resize]);

  const splash = useCallback(
    (nx: number, ny: number, tier: SplashTier) => {
      const canvas = canvasRef.current;
      if (!canvas || reducedMotion) return;
      spawnSplash(
        dropletsRef.current,
        nx * canvas.width,
        ny * canvas.height,
        SPLASH_TIERS[tier],
      );
      dirtyRef.current = true;
    },
    [reducedMotion],
  );

  useImperativeHandle(ref, () => ({ splash, count: () => dropletsRef.current.length }), [splash]);

  useAnimationFrame(
    (_elapsed, delta) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const droplets = dropletsRef.current;

      if (droplets.length === 0) {
        // Clear exactly once after the last droplet dies, then go quiet.
        if (dirtyRef.current) {
          canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
          dirtyRef.current = false;
        }
        return;
      }

      stepDroplets(droplets, delta);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Brightest for the leading spray, deeper tones for the heavy water.
      const shades = [palette.crest, palette.sparkle, palette.caustic];

      for (let i = 0; i < droplets.length; i += 1) {
        const d = droplets[i];
        // Fade by shrinking rather than by alpha: a semi-transparent pixel is
        // off-palette, which reads as blur in a pixel-art scene.
        const remaining = 1 - d.age / d.life;
        const size = remaining < 0.35 ? 1 : d.size;
        ctx.fillStyle = shades[d.shade];
        ctx.fillRect(Math.round(d.x), Math.round(d.y), size, size);
      }
    },
    { fps, paused: reducedMotion },
  );

  return (
    <div ref={wrapperRef} className={className}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="block h-full w-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
