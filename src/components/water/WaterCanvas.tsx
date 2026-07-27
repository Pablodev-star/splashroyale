import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { useAnimationFrame } from '@/hooks/useAnimationFrame';
import { useInView } from '@/hooks/useInView';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { MENU_PALETTE, MAP_BY_ID } from '@/data/maps';
import { renderWater, RIPPLE_LIFE, type Ripple, type WaterVariant } from './renderWater';
import type { GameMap, WaterPalette } from '@/types/game';

export interface WaterCanvasHandle {
  /**
   * Spawn a ripple at normalised canvas coordinates (0..1).
   * Block 2B/2C call this on splash impacts, dives and surfacing.
   */
  spawnRipple: (nx: number, ny: number, strength?: number) => void;
}

export interface WaterCanvasProps {
  /** Palette + surface come from a map; omit for the generic menu water. */
  map?: GameMap;
  palette?: WaterPalette;
  surface?: GameMap['surface'];
  variant?: WaterVariant;
  /** CSS pixels per rendered pixel. Larger = chunkier and cheaper. */
  pixelSize?: number;
  fps?: number;
  /** Emit slow random ripples so idle menus feel alive. */
  ambientRipples?: boolean;
  className?: string;
  ref?: Ref<WaterCanvasHandle>;
}

/** Keeps the per-frame pixel loop inside the performance budget. */
const MAX_BUFFER_PIXELS = 44_000;

export function WaterCanvas({
  map,
  palette,
  surface,
  variant = 'background',
  pixelSize = 6,
  fps = 24,
  ambientRipples = true,
  className,
  ref,
}: WaterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<ImageData | null>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const timeRef = useRef(0);
  const nextAmbientRef = useRef(0.6);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const inView = useInView(wrapperRef);
  const reducedMotion = useReducedMotion();

  const activePalette = palette ?? map?.palette ?? MENU_PALETTE;
  const activeSurface = surface ?? map?.surface ?? MAP_BY_ID.resortBeach.surface;

  const spawnRipple = useCallback((nx: number, ny: number, strength = 0.6) => {
    const image = imageRef.current;
    if (!image) return;
    ripplesRef.current.push({
      x: nx * image.width,
      y: ny * image.height,
      bornAt: timeRef.current,
      strength: Math.max(0.1, Math.min(1, strength)),
    });
  }, []);

  useImperativeHandle(ref, () => ({ spawnRipple }), [spawnRipple]);

  /** (Re)allocate the low-res buffer whenever the element is resized. */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    let scale = pixelSize;
    let width = Math.max(8, Math.ceil(rect.width / scale));
    let height = Math.max(8, Math.ceil(rect.height / scale));
    // Grow the pixels rather than the workload on very large viewports.
    while (width * height > MAX_BUFFER_PIXELS) {
      scale += 1;
      width = Math.max(8, Math.ceil(rect.width / scale));
      height = Math.max(8, Math.ceil(rect.height / scale));
    }

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      imageRef.current = context?.createImageData(width, height) ?? null;
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

  const draw = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      const image = imageRef.current;
      if (!canvas || !image) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      timeRef.current = time;

      if (ambientRipples && time > nextAmbientRef.current) {
        nextAmbientRef.current = time + 0.9 + Math.random() * 2.2;
        spawnRipple(Math.random(), 0.25 + Math.random() * 0.7, 0.2 + Math.random() * 0.4);
      }

      // Retire dead ripples so the array cannot grow without bound.
      if (ripplesRef.current.length > 0) {
        ripplesRef.current = ripplesRef.current.filter(
          (ripple) => time - ripple.bornAt <= RIPPLE_LIFE * 1.2,
        );
      }

      renderWater(image, {
        width: image.width,
        height: image.height,
        time,
        variant,
        palette: activePalette,
        surface: activeSurface,
        ripples: ripplesRef.current,
      });
      context.putImageData(image, 0, 0);
    },
    [activePalette, activeSurface, ambientRipples, spawnRipple, variant],
  );

  // Reduced motion / offscreen: draw a single static frame instead of looping.
  const paused = reducedMotion || !inView;
  useEffect(() => {
    if (!paused) return;
    const raf = requestAnimationFrame(() => draw(0));
    return () => cancelAnimationFrame(raf);
  }, [paused, draw]);

  useAnimationFrame(draw, { fps, paused });

  return (
    <div ref={wrapperRef} className={className}>
      <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
    </div>
  );
}
