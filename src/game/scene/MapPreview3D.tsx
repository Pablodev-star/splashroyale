import { useEffect, useRef } from 'react';
import type { GameMap } from '@/types/game';
import { useAnimationFrame } from '@/hooks/useAnimationFrame';
import { useInView } from '@/hooks/useInView';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ArenaScene } from './ArenaScene';
import { cn } from '@/lib/cn';

export interface MapPreview3DProps {
  map: GameMap;
  /** Slows the orbit and drops the frame cap for grids of several previews. */
  fps?: number;
  className?: string;
}

/** Radians per second the preview camera drifts around the arena. */
const ORBIT_SPEED = 0.12;

/**
 * Water texture edge for a preview, against 192 in a match.
 *
 * The water is painted on the CPU and costs this squared per repaint, and that
 * cost is completely independent of `pixelSize`, which only shrinks the WebGL
 * buffer. Three previews at the match resolution were repainting 3 x 37k pixels
 * about twenty times a second — more main-thread work than the match itself,
 * for three thumbnails a few hundred pixels wide. At 64 that is a ninth.
 */
const PREVIEW_WATER_SIZE = 64;
/** Water repaints per second in a preview. Nobody is reading the wave crests. */
const PREVIEW_WATER_FPS = 12;
/** Where the orbit starts, so three previews side by side are not identical. */
const START_YAW: Record<string, number> = {
  municipalPool: 0,
  beach: 0.9,
  resortBeach: -0.8,
};

/**
 * A map thumbnail that is the actual map (Block 5).
 *
 * The map picker used to show a flat 2D water swatch: three near-identical
 * rectangles of moving water whose only difference was the palette, which told
 * you nothing about the place you were choosing. This renders the real
 * `ArenaScene` — the same deck, lane ropes, parasols, palms and sky the match
 * uses — on a slow orbit, so what the thumbnail shows is what you get.
 *
 * Fighters are never added, so no sprite atlas is baked and the loop is only
 * the water and the camera. `pixelSize` is deliberately coarse: at thumbnail
 * scale it keeps the chunky look and cuts the buffer to a few thousand pixels.
 */
export function MapPreview3D({ map, fps = 20, className }: MapPreview3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ArenaScene | null>(null);
  const yawRef = useRef(START_YAW[map.id] ?? 0);
  const reducedMotion = useReducedMotion();
  // On a phone the three map cards stack, so at most one is on screen. Painting
  // water for the two below the fold is pure waste.
  const inView = useInView(wrapperRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const scene = new ArenaScene(canvas, {
      map,
      pixelSize: 4,
      waterSize: PREVIEW_WATER_SIZE,
      waterFps: PREVIEW_WATER_FPS,
    });
    sceneRef.current = scene;
    yawRef.current = START_YAW[map.id] ?? 0;
    scene.setYaw(yawRef.current);

    const applySize = () => {
      const rect = wrapper.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      scene.resize(rect.width, rect.height);
      // With the loop stopped there is nothing to redraw the resized buffer.
      scene.render(0, []);
    };
    applySize();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(applySize);
      observer.observe(wrapper);
    }

    return () => {
      observer?.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [map]);

  useAnimationFrame(
    (_elapsed, delta) => {
      const scene = sceneRef.current;
      if (!scene) return;
      yawRef.current += delta * ORBIT_SPEED;
      scene.setYaw(yawRef.current);
      scene.render(delta, []);
    },
    { fps, paused: reducedMotion || !inView },
  );

  return (
    <div ref={wrapperRef} className={cn('overflow-hidden', className)}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="block h-full w-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
