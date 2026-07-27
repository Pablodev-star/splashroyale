import { useEffect, useRef } from 'react';

export interface AnimationFrameOptions {
  /** Frame cap. Pixel art reads better on a low, steady framerate. */
  fps?: number;
  /** When true the loop is torn down (no rAF scheduled at all). */
  paused?: boolean;
}

/**
 * requestAnimationFrame loop with an fps cap that also stops while the tab is
 * hidden. The callback receives elapsed seconds since the loop started and the
 * delta since the previous tick, both in seconds.
 */
export function useAnimationFrame(
  callback: (elapsed: number, delta: number) => void,
  { fps = 60, paused = false }: AnimationFrameOptions = {},
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (paused) return;

    const interval = 1000 / fps;
    let frame = 0;
    let startedAt = 0;
    let lastTick = 0;
    let stopped = false;

    const tick = (now: number) => {
      if (stopped) return;
      frame = requestAnimationFrame(tick);

      if (startedAt === 0) {
        startedAt = now;
        lastTick = now;
      }
      const sinceLast = now - lastTick;
      if (sinceLast < interval) return;
      lastTick = now;

      callbackRef.current((now - startedAt) / 1000, sinceLast / 1000);
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
      } else {
        // Reset the clock so we don't emit one huge delta after a long pause.
        lastTick = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fps, paused]);
}
