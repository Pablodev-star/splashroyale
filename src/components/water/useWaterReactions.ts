import { useEffect, useRef, type RefObject } from 'react';
import type { WaterCanvasHandle } from './WaterCanvas';

/** Anything moving through the water that should disturb the surface. */
export interface WaterActor {
  id: string;
  /** Normalised **canvas** coordinates, 0..1 — not arena coordinates. */
  x: number;
  y: number;
  submerged?: boolean;
}

export interface WaterReactionOptions {
  /**
   * Normalised distance an actor must travel before it sheds another wake
   * ripple. Smaller means a denser trail and more ripples to simulate.
   */
  wakeSpacing?: number;
  /** Multiplier on every ripple this hook spawns. */
  intensity?: number;
}

interface Tracked {
  x: number;
  y: number;
  submerged: boolean;
  /** Distance travelled since the last wake ripple was shed. */
  travelled: number;
}

/**
 * Ceiling on ripples one actor can shed in a single update. Without it, a
 * respawn or a tab regaining focus registers as one enormous step and would
 * carpet the whole path in foam.
 */
const MAX_WAKE_PER_FRAME = 4;

/**
 * Makes the water answer back (Block 2B).
 *
 * `WaterCanvas` has always exposed `spawnRipple`, but nothing ever called it —
 * the surface only had its own ambient ripples, so the pool looked identical
 * whether fighters were swimming through it or standing still. This hook is the
 * missing half: it watches actors between renders and converts what they *did*
 * into surface events.
 *
 * - **Wake.** Ripples shed along the path once an actor has covered
 *   `wakeSpacing`, so the trail is tied to distance rather than to frame rate —
 *   a fast swimmer leaves a longer wake, a still one leaves none.
 * - **Diving and surfacing.** Breaking the surface is a single strong ripple;
 *   coming back up is a softer one.
 *
 * Positions are read from a ref, so this never triggers a re-render of its own.
 */
export function useWaterReactions(
  water: RefObject<WaterCanvasHandle | null>,
  actors: WaterActor[],
  { wakeSpacing = 0.045, intensity = 1 }: WaterReactionOptions = {},
): void {
  const trackedRef = useRef(new Map<string, Tracked>());

  useEffect(() => {
    const handle = water.current;
    if (!handle) return;
    const tracked = trackedRef.current;
    const seen = new Set<string>();

    for (const actor of actors) {
      seen.add(actor.id);
      const submerged = actor.submerged ?? false;
      const previous = tracked.get(actor.id);

      if (!previous) {
        // First sighting: remember where they are, but don't splash — otherwise
        // every fighter would arrive with a ripple on mount.
        tracked.set(actor.id, { x: actor.x, y: actor.y, submerged, travelled: 0 });
        continue;
      }

      if (submerged !== previous.submerged) {
        // Going under displaces far more water than coming back up.
        handle.spawnRipple(actor.x, actor.y, (submerged ? 0.7 : 0.42) * intensity);
        previous.travelled = 0;
      }

      const dx = actor.x - previous.x;
      const dy = actor.y - previous.y;
      const step = Math.hypot(dx, dy);

      if (step > 0) {
        // A submerged swimmer only pushes a faint swell to the surface.
        const strength = (submerged ? 0.14 : 0.28) * intensity;
        // Shed one ripple per whole `wakeSpacing` crossed, positioned along the
        // segment actually travelled, and carry the remainder into the next
        // frame. Emitting once per frame and resetting the accumulator instead
        // would thin the trail out whenever a frame ran long — which is exactly
        // the frame-rate dependence measuring by distance is meant to avoid.
        let due = wakeSpacing - previous.travelled;
        let emitted = 0;

        while (due <= step && emitted < MAX_WAKE_PER_FRAME) {
          const fraction = due / step;
          handle.spawnRipple(previous.x + dx * fraction, previous.y + dy * fraction, strength);
          due += wakeSpacing;
          emitted += 1;
        }

        previous.travelled =
          emitted === MAX_WAKE_PER_FRAME
            ? // A jump this large is a respawn or a teleport, not swimming.
              // Filling it in would carpet the pool, so resync instead.
              0
            : step - (due - wakeSpacing);
      }

      previous.x = actor.x;
      previous.y = actor.y;
      previous.submerged = submerged;
    }

    // Drop actors that left, so the map cannot grow across a long session.
    for (const id of tracked.keys()) {
      if (!seen.has(id)) tracked.delete(id);
    }
  }, [actors, water, wakeSpacing, intensity]);
}
