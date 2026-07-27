import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * Counts from 0 to `target` on a stepped timeline — reward numbers should tick
 * like a scoreboard, not interpolate smoothly (STYLEGUIDE §5).
 */
export function useCountUp(target: number, durationMs = 900, delayMs = 0): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || durationMs <= 0) {
      setValue(target);
      return;
    }

    setValue(0);
    let start = 0;
    const tick = (now: number) => {
      if (start === 0) start = now;
      const elapsed = now - start - delayMs;
      if (elapsed < 0) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(1, elapsed / durationMs);
      // Ease-out so the last digits land slowly and read as "settling".
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, durationMs, delayMs, reducedMotion]);

  return value;
}
