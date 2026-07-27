import type { AnimationId, SpriteAnimation, SpriteFrame } from './types';

/**
 * The seven animation states (Block 2A).
 *
 * Poses are offset tables over the rig in `rig.ts`. The deltas are shared across
 * orientations on purpose — the *art* differs per orientation, the motion does
 * not, so a swim cycle stays in sync whichever way the fighter faces. Every
 * offset is a whole number of pixels: sub-pixel motion would break the pixel
 * grid the whole art style depends on (STYLEGUIDE §3.4).
 *
 * Directional effects (the thrown water orb, the kick splash) are authored
 * pointing right; `right` mirrors `left` at bake time, so they follow the facing
 * automatically.
 */

/** Frame helper — keeps the tables readable. */
function frame(durationMs: number, rest: Omit<SpriteFrame, 'durationMs'> = {}): SpriteFrame {
  return { durationMs, ...rest };
}

/** Treading water: the whole body drifts, arms scull to hold position. */
const IDLE: SpriteAnimation = {
  loop: true,
  frames: [
    frame(240, { parts: { armFar: { dy: 0 }, armNear: { dy: 0 } } }),
    frame(240, {
      parts: {
        cap: { dy: -1 },
        head: { dy: -1 },
        torso: { dy: -1 },
        armFar: { dy: 1, dx: -1 },
        armNear: { dy: 1, dx: 1 },
      },
    }),
    frame(240, { parts: { armFar: { dy: 0 }, armNear: { dy: 0 } } }),
    frame(240, {
      parts: {
        cap: { dy: 1 },
        head: { dy: 1 },
        torso: { dy: 1 },
        armFar: { dy: -1, dx: 1 },
        armNear: { dy: -1, dx: -1 },
      },
    }),
  ],
};

/** Front-crawl cycle: arms alternate over the surface, body rolls with them. */
const SWIM: SpriteAnimation = {
  loop: true,
  frames: [
    frame(130, {
      parts: {
        cap: { dy: -1 },
        head: { dy: -1 },
        armFar: { dy: -3, dx: -2 },
        armNear: { dy: 2, dx: 1 },
      },
    }),
    frame(130, {
      parts: { armFar: { dy: -1, dx: -1 }, armNear: { dy: 1 } },
    }),
    frame(130, {
      parts: {
        cap: { dy: -1 },
        head: { dy: -1 },
        armFar: { dy: 2, dx: -1 },
        armNear: { dy: -3, dx: 2 },
      },
    }),
    frame(130, {
      parts: { armFar: { dy: 1 }, armNear: { dy: -1, dx: 1 } },
    }),
  ],
};

/** Winding up a water attack: lean back, arms cocked, water gathering. */
const CHARGE: SpriteAnimation = {
  loop: true,
  frames: [
    frame(170, {
      parts: {
        cap: { dx: -1 },
        head: { dx: -1 },
        torso: { dx: -1 },
        armFar: { dx: -2, dy: -1 },
        armNear: { dx: -1, dy: -2 },
      },
      fx: [
        { x: 22, y: 18, w: 3, h: 3, color: 'water' },
        { x: 23, y: 17, w: 1, h: 1, color: 'foam' },
      ],
    }),
    frame(170, {
      parts: {
        cap: { dx: -1, dy: -1 },
        head: { dx: -1, dy: -1 },
        torso: { dx: -1 },
        armFar: { dx: -2, dy: -1 },
        armNear: { dx: -1, dy: -2 },
      },
      fx: [
        { x: 22, y: 16, w: 3, h: 5, color: 'water' },
        { x: 21, y: 17, w: 5, h: 3, color: 'water' },
        { x: 23, y: 15, w: 2, h: 2, color: 'foam' },
      ],
    }),
    frame(170, {
      parts: {
        cap: { dx: -1 },
        head: { dx: -1 },
        torso: { dx: -1 },
        armFar: { dx: -2 },
        armNear: { dx: -1, dy: -1 },
      },
      fx: [
        { x: 21, y: 15, w: 4, h: 7, color: 'water' },
        { x: 20, y: 17, w: 6, h: 4, color: 'water' },
        { x: 22, y: 14, w: 2, h: 2, color: 'foam' },
        { x: 25, y: 19, w: 1, h: 1, color: 'foam' },
      ],
    }),
  ],
};

/** Release: arms snap forward and the orb leaves the frame. */
const ATTACK: SpriteAnimation = {
  loop: false,
  frames: [
    frame(70, {
      parts: {
        torso: { dx: -1 },
        armFar: { dx: -1, dy: -1 },
        armNear: { dx: -1, dy: -2 },
      },
      fx: [
        { x: 21, y: 15, w: 4, h: 7, color: 'water' },
        { x: 20, y: 17, w: 6, h: 4, color: 'water' },
      ],
    }),
    frame(70, {
      parts: {
        cap: { dx: 1 },
        head: { dx: 1 },
        torso: { dx: 1 },
        armFar: { dx: 2, dy: -2 },
        armNear: { dx: 3, dy: -3 },
      },
      fx: [
        { x: 22, y: 17, w: 4, h: 4, color: 'water' },
        { x: 23, y: 16, w: 2, h: 6, color: 'water' },
        { x: 25, y: 16, w: 2, h: 2, color: 'foam' },
        { x: 21, y: 21, w: 2, h: 1, color: 'foam' },
      ],
    }),
    frame(90, {
      parts: {
        cap: { dx: 1 },
        head: { dx: 1 },
        torso: { dx: 1 },
        armFar: { dx: 2, dy: -1 },
        armNear: { dx: 3, dy: -2 },
      },
      fx: [
        { x: 25, y: 17, w: 3, h: 3, color: 'water' },
        { x: 24, y: 18, w: 1, h: 1, color: 'foam' },
      ],
    }),
    frame(110, {
      parts: { armFar: { dx: 1 }, armNear: { dx: 1, dy: -1 } },
    }),
  ],
};

/** The kick: body drops, a sheet of water launches off the surface. */
const KICK: SpriteAnimation = {
  loop: false,
  frames: [
    frame(70, {
      parts: { cap: { dy: -2 }, head: { dy: -2 }, torso: { dy: -1 }, armNear: { dy: -2 } },
    }),
    frame(80, {
      parts: {
        cap: { dy: 2 },
        head: { dy: 2 },
        torso: { dy: 2 },
        armFar: { dy: -1 },
        armNear: { dy: -1 },
      },
      fx: [
        { x: 18, y: 21, w: 6, h: 2, color: 'foam' },
        { x: 21, y: 19, w: 3, h: 2, color: 'water' },
        { x: 24, y: 20, w: 2, h: 2, color: 'water' },
      ],
    }),
    frame(90, {
      parts: { cap: { dy: 1 }, head: { dy: 1 }, torso: { dy: 1 } },
      fx: [
        { x: 19, y: 17, w: 4, h: 2, color: 'foam' },
        { x: 22, y: 14, w: 3, h: 3, color: 'water' },
        { x: 25, y: 15, w: 2, h: 2, color: 'foam' },
        { x: 20, y: 20, w: 6, h: 2, color: 'water' },
      ],
    }),
    frame(120, {
      fx: [
        { x: 24, y: 12, w: 2, h: 2, color: 'water' },
        { x: 21, y: 15, w: 1, h: 1, color: 'foam' },
      ],
    }),
  ],
};

/**
 * Submerging. Holds on the final frame, which *is* the underwater idle: the
 * body is gone and only the ripple and a bubble break the surface.
 */
const DIVE: SpriteAnimation = {
  loop: false,
  frames: [
    frame(80, {
      parts: { cap: { dy: -2 }, head: { dy: -2 }, torso: { dy: -1 } },
    }),
    frame(90, {
      parts: { cap: { dy: 4 }, head: { dy: 4 }, torso: { dy: 4 }, armFar: { dy: 3 }, armNear: { dy: 3 } },
      fx: [{ x: 6, y: 22, w: 16, h: 2, color: 'foam' }],
    }),
    frame(90, {
      parts: {
        cap: { dy: 9 },
        head: { dy: 9 },
        torso: { dy: 8 },
        armFar: { dy: 7 },
        armNear: { dy: 7 },
      },
      fx: [{ x: 4, y: 23, w: 20, h: 2, color: 'foam' }],
    }),
    frame(100, {
      parts: {
        cap: { hidden: true },
        head: { hidden: true },
        torso: { hidden: true },
        armFar: { hidden: true },
        armNear: { hidden: true },
      },
      fx: [{ x: 3, y: 23, w: 22, h: 2, color: 'foam' }],
    }),
    // Held frame — the submerged state.
    frame(400, {
      parts: {
        cap: { hidden: true },
        head: { hidden: true },
        torso: { hidden: true },
        armFar: { hidden: true },
        armNear: { hidden: true },
      },
    }),
  ],
};

/** Taking a hit: sharp recoil, then settle. */
const HIT: SpriteAnimation = {
  loop: false,
  frames: [
    frame(70, {
      parts: {
        cap: { dx: -3, dy: -1 },
        head: { dx: -3, dy: -1 },
        torso: { dx: -2 },
        armFar: { dx: -3, dy: -2 },
        armNear: { dx: -2, dy: -2 },
      },
      fx: [
        { x: 17, y: 15, w: 4, h: 2, color: 'foam' },
        { x: 16, y: 13, w: 2, h: 2, color: 'foam' },
        { x: 15, y: 18, w: 2, h: 1, color: 'water' },
      ],
    }),
    frame(80, {
      parts: {
        cap: { dx: -2 },
        head: { dx: -2 },
        torso: { dx: -1 },
        armFar: { dx: -2, dy: 1 },
        armNear: { dx: -1, dy: 1 },
      },
    }),
    frame(100, {
      parts: { cap: { dx: -1 }, head: { dx: -1 }, armFar: { dx: -1 } },
    }),
  ],
};

export const ANIMATIONS: Record<AnimationId, SpriteAnimation> = {
  idle: IDLE,
  swim: SWIM,
  charge: CHARGE,
  attack: ATTACK,
  kick: KICK,
  dive: DIVE,
  hit: HIT,
};

export const ANIMATION_IDS = Object.keys(ANIMATIONS) as AnimationId[];

/** Total run time of one pass; useful for scheduling one-shot animations. */
export function animationDurationMs(id: AnimationId): number {
  return ANIMATIONS[id].frames.reduce((total, f) => total + f.durationMs, 0);
}
