import type { GameMap, WaterPalette } from '@/types/game';

/**
 * Palette-driven pixel water renderer.
 *
 * Everything is written into a small ImageData buffer (see PERF budget in
 * ARCHITECTURE.md §6) which the DOM then upscales with `image-rendering:
 * pixelated`, so we get true chunky pixels with no shader plumbing.
 *
 * Block 2B kept this renderer rather than moving the in-match surface to a
 * Three.js shader as originally sketched: §2.1 reserves WebGL for the match
 * *scene*, and routing the water through a second renderer would have meant two
 * implementations of the same wave math drifting apart between menus and arena.
 * Ripples are simulated here instead, as a height field the surface reads from.
 */

/**
 * `background` — menu backdrop. `arena` — the old 2D pseudo-3D pool (a trapezoid
 * faked with perspective). `surface` — a flat top-down sheet meant to be mapped
 * onto the Three.js water plane (Block 3A), where the perspective comes from the
 * real camera instead of being drawn in.
 */
export type WaterVariant = 'background' | 'arena' | 'surface';

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
 * How far a full-strength ripple pushes the depth bands, in reference pixels.
 * Tuned by eye: below ~8 the bands barely move and the ripple reads as a drawn
 * ring; far above this the surface tears into stripes.
 */
const RIPPLE_BAND_LIFT = 15;

/** How far a ripple displaces caustic sampling — the refraction cue. */
const RIPPLE_REFRACT = 7;

/**
 * A ripple resolved to this frame. Derived once per frame rather than per pixel:
 * the inner loop runs 44k times, so anything hoistable must be hoisted.
 */
interface PreparedRipple {
  x: number;
  y: number;
  /** Radius of the advancing ring right now, in buffer pixels. */
  front: number;
  /** Half-width of the ring band. Outside it the ripple contributes nothing. */
  width: number;
  /** Height amplitude driving the surface deformation, 0..1. */
  amp: number;
  /**
   * Foam amplitude. Deliberately separate from `amp` and faded more slowly: the
   * deformation and the visible crest want different curves, and driving both
   * from one value means either the foam smothers the deformation or the ripple
   * loses its crest halfway through its life.
   */
  foamAmp: number;
  /** front + width — used to reject pixels with four comparisons. */
  reach: number;
}

function prepareRipples(
  ripples: Ripple[],
  time: number,
  unit: number,
): PreparedRipple[] {
  const prepared: PreparedRipple[] = [];
  for (const ripple of ripples) {
    const age = time - ripple.bornAt;
    const life = RIPPLE_LIFE * (0.6 + ripple.strength * 0.6);
    if (age < 0 || age > life) continue;
    const progress = age / life;
    // Wide enough that the deformed water outside the foam peak is readable.
    const width = (2 + ripple.strength * 2.5) * unit;
    // Decelerating front: fast expansion that eases out reads as water, a
    // linear one reads as an animated circle. Kept small relative to the pool —
    // a ring much past this stops reading as a ripple and becomes a crater.
    const front = (2 + ripple.strength * 13) * unit * Math.sqrt(progress);
    prepared.push({
      x: ripple.x,
      y: ripple.y,
      front,
      width,
      amp: ripple.strength * (1 - progress),
      // Only weakly tied to strength. Strength already sets the ring's radius,
      // width and life, which is what carries "how big was that splash"; scaling
      // foam by it as well pushed weak ripples (a swimmer's wake) under the foam
      // threshold entirely, so they rendered as nothing at all.
      foamAmp: (0.55 + ripple.strength * 0.45) * (1 - progress * progress),
      reach: front + width,
    });
  }
  return prepared;
}

/** Reused across every pixel — allocating here would mean 44k objects a frame. */
const sample = { lift: 0, foam: 0 };

/**
 * Samples all ripples at a point, yielding two separate quantities.
 *
 * This is what makes the water *reactive* rather than decorated:
 * - `lift` is added to the wave height, so depth bands and caustics bend around
 *   a ripple instead of having a ring drawn on top of them. Broad and smooth, so
 *   overlapping ripples sum into a believable surface.
 * - `foam` decides where the visible crest goes. Cubed, so it stays a tight
 *   highlight on the peak and leaves the deformation either side of it readable,
 *   and taken as a max rather than a sum so crossing ripples don't blow out.
 */
function sampleRipples(
  x: number,
  y: number,
  prepared: PreparedRipple[],
  squash: number,
): typeof sample {
  let lift = 0;
  let foam = 0;

  for (let i = 0; i < prepared.length; i += 1) {
    const r = prepared[i];
    const dx = x - r.x;
    if (dx > r.reach || dx < -r.reach) continue;
    const dy = (y - r.y) / squash;
    if (dy > r.reach || dy < -r.reach) continue;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const band = distance - r.front;
    if (band > r.width || band < -r.width) continue;

    // Cosine bump across the ring: crest at the front, easing to flat at the
    // band edges, so neighbouring ripples add up smoothly.
    const bump = Math.cos((band / r.width) * (Math.PI / 2));
    lift += bump * r.amp;
    const crest = bump * bump * bump * r.foamAmp;
    if (crest > foam) foam = crest;
  }

  sample.lift = lift;
  sample.foam = foam;
  return sample;
}

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

  // Perspective squash: rings read as ellipses on the arena floor plane.
  // Ripples are squashed into ellipses to fake a viewing angle — except on the
  // `surface` texture, where the 3D camera supplies the angle and a ripple must
  // be a true circle on the plane or it reads as skewed once tilted.
  const squash = variant === 'arena' ? 0.45 : variant === 'surface' ? 1 : 0.6;
  const prepared = prepareRipples(ripples, time, unit);
  const hasRipples = prepared.length > 0;

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
      // Ripples raise and lower the surface, so they push the depth bands and
      // the caustic net around — the water deforms instead of being drawn over.
      let lift = 0;
      let foam = 0;
      if (hasRipples) {
        const sampled = sampleRipples(x, y, prepared, squash);
        lift = sampled.lift;
        foam = sampled.foam;
      }
      const bandFloat =
        ((depthT * height + wave + lift * RIPPLE_BAND_LIFT * unit) / height) * bandCount;
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
      // Refraction: the same lift displaces where the caustics are sampled, so
      // light on the floor scatters as a ripple passes over it.
      const cx = (x + lift * RIPPLE_REFRACT * unit) / unit;
      const cy = (y + lift * RIPPLE_REFRACT * 0.7 * unit) / unit;
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
      if (variant === 'background' || variant === 'surface') {
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

      // Foam riding the ripple crest. Thresholding the deformation (rather than
      // stroking a circle) means the ring breaks up over waves and where two
      // ripples meet, which is what stops it reading as a drawn ellipse.
      // Only the very peak becomes foam. Wider thresholds overpaint the ring and
      // hide the band deformation underneath it, which makes the whole thing
      // collapse back into looking like a stroked ellipse.
      if (foam > 0.62) {
        rgb = palette.crest;
      } else if (foam > 0.34) {
        rgb = palette.caustic;
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
}

function clampBand(band: number, count: number): number {
  return band < 0 ? 0 : band > count - 1 ? count - 1 : band;
}

export { RIPPLE_LIFE };
