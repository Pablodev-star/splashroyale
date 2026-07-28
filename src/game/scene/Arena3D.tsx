import { useCallback, useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from 'react';
import { useAnimationFrame } from '@/hooks/useAnimationFrame';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { GameMap } from '@/types/game';
import type { SplashTier } from '@/game/vfx';
import { ArenaScene, type SceneFighter } from './ArenaScene';
import { cn } from '@/lib/cn';

export interface Arena3DHandle {
  /** Surface ripple at normalised arena coordinates (0..1). */
  spawnRipple: (nx: number, ny: number, strength?: number) => void;
  /** Splash burst at normalised arena coordinates, sized by Block 2C tier. */
  splash: (nx: number, ny: number, tier: SplashTier) => void;
  /** Current camera azimuth in radians — also the player's facing. */
  getYaw: () => number;
}

export interface Arena3DProps {
  map: GameMap;
  fighters: SceneFighter[];
  /** Fired when the player drags the camera, since that also turns the fighter. */
  onYawChange?: (yaw: number) => void;
  children?: ReactNode;
  className?: string;
  ref?: Ref<Arena3DHandle>;
}

/** Radians of camera rotation per screen width dragged. */
const DRAG_SENSITIVITY = Math.PI * 2;

/**
 * The 3D arena (Block 3A), replacing the 2D pseudo-perspective stage.
 *
 * Owns the lifetime of an `ArenaScene` and feeds it. Fighter data is handed to
 * the scene through a ref rather than props-on-render: the scene runs its own
 * loop, and routing 60 updates a second through React would re-render the whole
 * HUD along with it.
 */
export function Arena3D({
  map,
  fighters,
  onYawChange,
  children,
  className,
  ref,
}: Arena3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ArenaScene | null>(null);
  const reducedMotion = useReducedMotion();

  // Latest fighters, read by the render loop without re-subscribing it.
  const fightersRef = useRef(fighters);
  fightersRef.current = fighters;
  const yawChangeRef = useRef(onYawChange);
  yawChangeRef.current = onYawChange;

  // Build the scene once per map. Rebuilding on every fighter change would drop
  // the WebGL context and reload every texture.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const scene = new ArenaScene(canvas, { map });
    sceneRef.current = scene;

    const applySize = () => {
      const rect = wrapper.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) scene.resize(rect.width, rect.height);
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

  useImperativeHandle(
    ref,
    () => ({
      spawnRipple: (nx, ny, strength) => sceneRef.current?.spawnRipple(nx, ny, strength),
      splash: (nx, ny, tier) => sceneRef.current?.splash(nx, ny, tier),
      getYaw: () => sceneRef.current?.getYaw() ?? 0,
    }),
    [],
  );

  // --- Camera drag ---------------------------------------------------------
  // Pointer events cover touch, pen and mouse in one path, so the finger drag
  // the design calls for and a desktop mouse drag are the same code.
  const dragRef = useRef<{ id: number; x: number; yaw: number } | null>(null);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const scene = sceneRef.current;
    if (!scene) return;
    dragRef.current = { id: event.pointerId, x: event.clientX, yaw: scene.getYaw() };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const scene = sceneRef.current;
    if (!drag || !scene || drag.id !== event.pointerId) return;

    const width = event.currentTarget.clientWidth || 1;
    const yaw = drag.yaw + ((event.clientX - drag.x) / width) * DRAG_SENSITIVITY;
    scene.setYaw(yaw);
    yawChangeRef.current?.(yaw);
  }, []);

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  // --- Render loop ---------------------------------------------------------
  useAnimationFrame(
    (_elapsed, delta) => {
      const scene = sceneRef.current;
      if (!scene) return;
      scene.setFighters(fightersRef.current);
      scene.render(delta, fightersRef.current);
    },
    { fps: 60, paused: false },
  );

  // Reduced motion still needs one painted frame, or the arena is a blank
  // canvas rather than a still scene.
  useEffect(() => {
    if (!reducedMotion) return;
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setFighters(fightersRef.current);
    scene.render(0, fightersRef.current);
  }, [reducedMotion]);

  return (
    <div
      ref={wrapperRef}
      // No positioning class of our own: callers pass one (`absolute inset-0`
      // from the match screen), and emitting `relative` here too left the
      // element with two competing `position` rules. Whichever won the cascade,
      // the wrapper could collapse to the canvas's intrinsic height instead of
      // filling the screen — which is exactly what happened on mobile, where
      // the arena rendered as a band across the top.
      className={cn('touch-none select-none', className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 block h-full w-full"
        style={{ imageRendering: 'pixelated' }}
      />
      {children}
    </div>
  );
}
