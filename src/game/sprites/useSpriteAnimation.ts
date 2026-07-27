import { useEffect, useRef, useState } from 'react';
import { useAnimationFrame } from '@/hooks/useAnimationFrame';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ANIMATIONS, restFrame } from './animations';
import type { AnimationId } from './types';

export interface SpriteAnimationOptions {
  animation: AnimationId;
  paused?: boolean;
  /** 1 is authored speed. The match engine can scale this with, say, haste. */
  speed?: number;
  /** Fired once when a non-looping animation reaches its final frame. */
  onComplete?: () => void;
}

/**
 * The sprite-playback API (Block 2A).
 *
 * Returns the frame index to display. This is the only thing Block 3 needs to
 * drive a fighter: pick an `AnimationId`, get a frame. Playback is time-based
 * (each frame carries its own duration) rather than tied to the render rate, so
 * a slow device drops frames instead of playing the animation in slow motion.
 *
 * State lives in a ref and only reaches React when the *frame index* changes, so
 * a 30fps loop does not mean 30 re-renders a second per fighter.
 */
export function useSpriteAnimation({
  animation,
  paused = false,
  speed = 1,
  onComplete,
}: SpriteAnimationOptions): number {
  const [frame, setFrame] = useState(0);
  const reducedMotion = useReducedMotion();

  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const stateRef = useRef({ elapsedMs: 0, frame: 0, finished: false });

  // Switching animation restarts it from frame 0.
  useEffect(() => {
    stateRef.current = { elapsedMs: 0, frame: 0, finished: false };
    setFrame(0);
  }, [animation]);

  useAnimationFrame(
    (_elapsed, delta) => {
      const state = stateRef.current;
      const spec = ANIMATIONS[animation];
      if (state.finished) return;

      state.elapsedMs += delta * 1000 * speed;

      const total = spec.frames.reduce((sum, f) => sum + f.durationMs, 0);
      let position = state.elapsedMs;

      if (spec.loop) {
        position %= total;
      } else if (position >= total) {
        // Hold the last frame and report completion exactly once.
        const last = spec.frames.length - 1;
        state.finished = true;
        if (state.frame !== last) {
          state.frame = last;
          setFrame(last);
        }
        completeRef.current?.();
        return;
      }

      let index = 0;
      let cursor = 0;
      for (let i = 0; i < spec.frames.length; i += 1) {
        cursor += spec.frames[i].durationMs;
        if (position < cursor) {
          index = i;
          break;
        }
        index = i;
      }

      if (index !== state.frame) {
        state.frame = index;
        setFrame(index);
      }
    },
    { fps: 30, paused: paused || reducedMotion },
  );

  // Reduced motion: hold the animation's resting frame, never animate.
  return reducedMotion ? restFrame(animation) : frame;
}
