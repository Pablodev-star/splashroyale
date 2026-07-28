import type { SplashSpec } from './splashTiers';

/**
 * Droplet simulation for splashes (Block 2C).
 *
 * Pure and framework-free so it can be unit-reasoned about and reused by Block 3
 * without dragging React in. All coordinates are **buffer pixels**, matching the
 * low-resolution VFX canvas.
 */

export interface Droplet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds lived so far. */
  age: number;
  life: number;
  size: number;
  /** Surface height it was thrown from — it dies on falling back to this. */
  surfaceY: number;
  /** 0 foam (brightest) … 2 deep water. Picked at spawn so a burst is varied. */
  shade: 0 | 1 | 2;
}

/**
 * Gravity in buffer pixels per second squared. Deliberately lighter than real
 * scale: the arc has to stay readable for a few frames at this buffer size, and
 * true gravity pulls droplets back before the throw registers.
 */
const GRAVITY = 105;

/** Hard ceiling on live droplets, so a mash of max-tier splashes can't run away. */
export const MAX_DROPLETS = 320;

/**
 * Adds a burst to `list`, in place.
 *
 * Droplets are thrown in a fan biased upward rather than a full circle: water
 * leaving a surface impact goes up and out, and a symmetric ring reads as an
 * explosion instead of a splash.
 */
export function spawnSplash(
  list: Droplet[],
  x: number,
  y: number,
  spec: SplashSpec,
  random: () => number = Math.random,
): void {
  const count = Math.min(spec.droplets, MAX_DROPLETS - list.length);

  for (let i = 0; i < count; i += 1) {
    // Fan from -160° to -20°, i.e. up-left through up-right.
    const angle = (-160 + random() * 140) * (Math.PI / 180);
    // Vary speed so the burst has a leading edge and a slower core.
    const speed = spec.speed * (0.45 + random() * 0.55);

    list.push({
      x,
      y,
      vx: Math.cos(angle) * speed * spec.spread,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: spec.life * (0.6 + random() * 0.4),
      size: 1 + Math.floor(random() * spec.maxSize),
      surfaceY: y,
      shade: Math.floor(random() * 3) as 0 | 1 | 2,
    });
  }
}

/**
 * Advances every droplet and drops the dead ones. Compacts in place rather than
 * allocating a filtered array — this runs every frame.
 */
export function stepDroplets(list: Droplet[], dt: number): void {
  let write = 0;

  for (let read = 0; read < list.length; read += 1) {
    const d = list[read];
    d.age += dt;
    d.vy += GRAVITY * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;

    // Dies on expiry, or the moment it falls back through the surface it came
    // from (still travelling downward, so a droplet spawned mid-arc survives).
    const landed = d.vy > 0 && d.y >= d.surfaceY;
    if (d.age >= d.life || landed) continue;

    list[write] = d;
    write += 1;
  }

  list.length = write;
}
