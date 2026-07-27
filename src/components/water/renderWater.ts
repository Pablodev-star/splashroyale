import type { GameMap, WaterPalette } from '@/types/game';

/**
 * Palette-driven pixel water renderer.
 *
 * Everything is written into a small ImageData buffer (see PERF budget in
 * ARCHITECTURE.md §6) which the DOM then upscales with `image-rendering:
 * pixelated`, so we get true chunky pixels with no shader plumbing.
 *
 * Block 2B replaces the in-match surface with a Three.js shader but reuses these
 * palettes and the same wave math, so the menus and the arena stay coherent.
 */

export type WaterVariant = 'background' | 'arena';

export interface Ripple {
  /** Buffer coordinates. */
  x: number;
  y: number;
  /** Seconds, in renderer time. */
  bornAt: number;
  /** 0..1 — scales radius, life and brightness. */
  strength: number;
}

export interface RenderWaterOptions {
  width: number;
  height: number;
  time: number;
  variant: WaterVariant;
  palette: WaterPalette;
  surface: GameMap['surface'];
  ripples: Ripple[];
}

type Rgb = [number, number, number];

const hexCache = new Map<string, Rgb>();

function hexToRgb(hex: string): Rgb {
  const cached = hexCache.get(hex);
  if (cached) return cached;
  const value = hex.replace('#', '');
  const rgb: Rgb = [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
  hexCache.set(hex, rgb);
  return rgb;
}

/** Cheap deterministic hash in 0..1 — used for sparkles and reef noise. */
function hash(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

interface CompiledPalette {
  depth: [Rgb, Rgb, Rgb, Rgb];
  caustic: Rgb;
  crest: Rgb;
  sparkle: Rgb;
  surround: Rgb;
  surroundShade: Rgb;
}

const compiledCache = new WeakMap<WaterPalette, CompiledPalette>();

function compilePalette(palette: WaterPalette): CompiledPalette {
  const cached = compiledCache.get(palette);
  if (cached) return cached;
  const compiled: CompiledPalette = {
    depth: [
      hexToRgb(palette.depth[0]),
      hexToRgb(palette.depth[1]),
      hexToRgb(palette.depth[2]),
      hexToRgb(palette.depth[3]),
    ],
    caustic: hexToRgb(palette.caustic),
    crest: hexToRgb(palette.crest),
    sparkle: hexToRgb(palette.sparkle),
    surround: hexToRgb(palette.surround),
    surroundShade: hexToRgb(palette.surroundShade),
  };
  compiledCache.set(palette, compiled);
  return compiled;
}

const TAU = Math.PI * 2;

/** Ripple ring lifetime in seconds at strength 1. */
const RIPPLE_LIFE = 1.6;

/**
 * Horizontal displacement of the water surface at a given column, in pixels.
 * Exported so Block 2C can spawn splashes that sit exactly on a wave crest.
 */
export function waveOffset(
  x: number,
  time: number,
  surface: GameMap['surface'],
  /** Buffer scale, so waves keep their shape from a 112px preview to a 4K menu. */
  unit = 1,
): number {
  const t = time * surface.speed;
  const wavelength = surface.wavelength * unit;
  const amplitude = surface.amplitude * unit;
  return (
    Math.sin((x / wavelength + t * 0.35) * TAU) * amplitude +
    Math.sin((x / (wavelength * 0.41) - t * 0.6) * TAU) * amplitude * 0.45
  );
}

/**
 * Pool outline for the arena variant: a trapezoid that widens toward the camera
 * to suggest the pseudo-3D space the billboard sprites live in.
 */
function poolBounds(y: number, width: number, height: number) {
  const top = Math.round(height * 0.2);
  const bottom = height;
  if (y < top) return null;
  const t = (y - top) / Math.max(1, bottom - top);
  const halfNear = width * 0.5;
  const halfFar = width * 0.3;
  const half = halfFar + (halfNear - halfFar) * t;
  const center = width * 0.5;
  return { left: center - half, right: center + half, t };
}

export function renderWater(image: ImageData, options: RenderWaterOptions): void {
  const { width, height, time, variant, surface, ripples } = options;
  const palette = compilePalette(options.palette);
  const data = image.data;
  const sparkleFrame = Math.floor(time * 8);
  const bandCount = palette.depth.length;
  // Reference buffer height. Wave size and pattern spacing scale off this so the
  // art reads the same at preview, menu and full-screen resolutions.
  const unit = Math.max(0.45, Math.min(2, height / 90));

  for (let y = 0; y < height; y += 1) {
    // Row-invariant work is hoisted out of the inner loop.
    const bounds = variant === 'arena' ? poolBounds(y, width, height) : null;
    const wobble = bounds ? waveOffset(y * 3, time, surface, unit) * 0.35 : 0;
    const rowLeft = bounds ? bounds.left + wobble : 0;
    const rowRight = bounds ? bounds.right + wobble : width;
    const rowDepthT = variant === 'arena' ? (bounds ? bounds.t : 0) : y / height;

    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;

      let depthT = rowDepthT; // 0 = deepest (far), 1 = shallowest (near)
      let inWater = true;
      let edgeDistance = width;

      if (variant === 'arena') {
        if (!bounds || x < rowLeft || x > rowRight) {
          inWater = false;
          depthT = 0;
        } else {
          edgeDistance = Math.min(x - rowLeft, rowRight - x, (y - height * 0.2) * 1.5);
        }
      }

      if (!inWater) {
        // Deck / sand surround: flat tiles with grout lines and sparse specks.
        const tile = Math.round(6 * unit);
        const grout = x % tile === 0 || y % Math.max(3, Math.round(tile * 0.7)) === 0;
        const shade = grout || hash(x, y, 3) > 0.965;
        const rgb = shade ? palette.surroundShade : palette.surround;
        data[index] = rgb[0];
        data[index + 1] = rgb[1];
        data[index + 2] = rgb[2];
        data[index + 3] = 255;
        continue;
      }

      const wave = waveOffset(x, time, surface, unit);
      const bandFloat = ((depthT * height + wave) / height) * bandCount;
      let band = Math.floor(bandFloat);
      band = band < 0 ? 0 : band > bandCount - 1 ? bandCount - 1 : band;

      // Floor pattern read through the water, darkened by depth.
      let floorLift = 0;
      if (variant === 'arena') {
        const perspective = (0.45 + depthT * 0.85) * unit;
        if (surface.floorPattern === 'poolTiles') {
          const gridY = Math.floor(y / (4 * perspective));
          const gridX = Math.floor((x - width * 0.5) / (7 * perspective));
          if ((gridX + gridY) % 2 === 0) floorLift = 1;
          const laneX = Math.abs(((x - width * 0.5) / (11 * perspective)) % 1);
          if (laneX < 0.08) floorLift = -1;
        } else if (surface.floorPattern === 'sandRipples') {
          const ripple = Math.sin((x / unit) * 0.18 + Math.sin((y / unit) * 0.3) * 1.6);
          if (ripple > 0.55) floorLift = 1;
        } else {
          const blob = hash(Math.floor(x / (3 * unit)), Math.floor(y / (2 * unit)), 11);
          if (blob > 0.86) floorLift = -1;
          else if (blob < 0.08) floorLift = 1;
        }
      }

      let rgb = palette.depth[clampBand(band + floorLift, bandCount)];

      // Caustic net: three interfering sines thresholded into two steps. Tight
      // cells — big soft blobs would read as clouds, not light on water.
      const cx = x / unit;
      const cy = y / unit;
      const caustic =
        Math.sin(cx * 0.32 + time * 1.1) +
        Math.sin(cy * 0.46 - time * 0.85) +
        Math.sin((cx + cy) * 0.19 + time * 0.45);
      if (caustic > 2.5) {
        rgb = palette.caustic;
      } else if (caustic > 2.05) {
        rgb = palette.depth[clampBand(band + 1, bandCount)];
      }

      // Crest / foam lines ride the band boundaries. Only the far bands get pure
      // foam; near the camera a lighter water step reads better than white.
      const bandFraction = bandFloat - Math.floor(bandFloat);
      if (variant === 'background') {
        // Menus: a repeating stack of wave lines reads as open water, where a
        // single band boundary would read as a hill silhouette.
        const period = 9 * unit;
        const offsetY = y + wave;
        const line = Math.floor(offsetY / period);
        if (offsetY - line * period < Math.max(1, unit)) {
          rgb = line % 3 === 0 ? palette.crest : palette.depth[bandCount - 1];
        }
      } else if (bandFraction < 0.03 && band > 0) {
        rgb = band === 1 ? palette.crest : palette.depth[bandCount - 1];
      }

      // Foam against the pool edge.
      if (variant === 'arena' && edgeDistance < unit) {
        rgb = palette.crest;
      }

      // Sparkles: single bright pixels, re-rolled 8 times a second.
      if (hash(x, y, sparkleFrame) < surface.sparkleDensity * 0.06) {
        rgb = palette.sparkle;
      }

      data[index] = rgb[0];
      data[index + 1] = rgb[1];
      data[index + 2] = rgb[2];
      data[index + 3] = 255;
    }
  }

  drawRipples(image, { width, height, time, ripples, palette, variant, unit });
}

function clampBand(band: number, count: number): number {
  return band < 0 ? 0 : band > count - 1 ? count - 1 : band;
}

/**
 * Ripple rings drawn directly into the buffer as squashed pixel circles.
 * Block 2B feeds this from real gameplay events (attack landing, dive, impact);
 * Block 1 only uses the ambient spawner in <WaterCanvas />.
 */
function drawRipples(
  image: ImageData,
  {
    width,
    height,
    time,
    ripples,
    palette,
    variant,
    unit,
  }: {
    width: number;
    height: number;
    time: number;
    ripples: Ripple[];
    palette: CompiledPalette;
    variant: WaterVariant;
    unit: number;
  },
): void {
  const data = image.data;
  // Perspective squash: rings read as ellipses on the arena floor plane.
  const squash = variant === 'arena' ? 0.45 : 0.6;

  for (const ripple of ripples) {
    const age = time - ripple.bornAt;
    const life = RIPPLE_LIFE * (0.6 + ripple.strength * 0.6);
    if (age < 0 || age > life) continue;

    const progress = age / life;
    const radius = (3 + ripple.strength * 22) * progress;
    const rings = progress < 0.45 ? 2 : 1;
    const color = progress < 0.6 ? palette.crest : palette.caustic;

    for (let ring = 0; ring < rings; ring += 1) {
      const r = radius - ring * 3 * unit;
      if (r < 1) continue;
      const steps = Math.max(12, Math.round(r * 6));
      for (let step = 0; step < steps; step += 1) {
        const angle = (step / steps) * TAU;
        const px = Math.round(ripple.x + Math.cos(angle) * r);
        const py = Math.round(ripple.y + Math.sin(angle) * r * squash);
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        const index = (py * width + px) * 4;
        data[index] = color[0];
        data[index + 1] = color[1];
        data[index + 2] = color[2];
        data[index + 3] = 255;
      }
    }
  }
}

export { RIPPLE_LIFE };
