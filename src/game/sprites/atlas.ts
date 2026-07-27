import { ANIMATIONS } from './animations';
import {
  DRAW_ORDER,
  PALETTE_CODES,
  RIG,
  resolvePalette,
  validateRig,
  type SpritePalette,
} from './rig';
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  type AnimationId,
  type Orientation,
  type PaletteKey,
  type PartArt,
  type PartId,
  type PartPose,
} from './types';

/**
 * Bakes the rig into a real sprite sheet (Block 2A).
 *
 * ARCHITECTURE.md originally reserved `public/sprites/**` for shipped PNGs. We
 * generate the sheet at runtime instead: the art is palette-swapped per
 * character, so shipping PNGs would mean one binary per character per recolour,
 * none of it reviewable in a diff. Baking once into an offscreen canvas gives
 * the same result — a genuine sprite sheet, blitted by CSS `background-position`
 * — while the source of truth stays the plain-text rig.
 *
 * The sheet is cached per palette, so N fighters sharing a palette bake once.
 */

const ORIENTATIONS: Orientation[] = ['front', 'back', 'left', 'right'];
const ANIMATION_ORDER = Object.keys(ANIMATIONS) as AnimationId[];

const MAX_FRAMES = Math.max(...ANIMATION_ORDER.map((id) => ANIMATIONS[id].frames.length));
const ATLAS_WIDTH = MAX_FRAMES * CELL_WIDTH;
const ATLAS_HEIGHT = ORIENTATIONS.length * ANIMATION_ORDER.length * CELL_HEIGHT;

export interface SpriteSheet {
  /** Data URL of the baked atlas. */
  url: string;
  width: number;
  height: number;
  /** Frames available for an animation (used to clamp playback). */
  frameCount(animation: AnimationId): number;
  /** Top-left of a frame inside the atlas, in atlas pixels. */
  frameOrigin(orientation: Orientation, animation: AnimationId, frame: number): { x: number; y: number };
}

const cache = new Map<string, SpriteSheet>();

function rowIndex(orientation: Orientation, animation: AnimationId): number {
  return ORIENTATIONS.indexOf(orientation) * ANIMATION_ORDER.length + ANIMATION_ORDER.indexOf(animation);
}

/** `right` reuses `left`'s art, mirrored inside the cell. */
function artOrientation(orientation: Orientation): 'front' | 'back' | 'left' {
  return orientation === 'right' ? 'left' : orientation;
}

function drawPart(
  ctx: CanvasRenderingContext2D,
  art: PartArt,
  pose: PartPose | undefined,
  colors: Record<PaletteKey, string>,
  originX: number,
  originY: number,
  mirror: boolean,
) {
  if (pose?.hidden) return;
  const baseX = art.x + (pose?.dx ?? 0);
  const baseY = art.y + (pose?.dy ?? 0);

  for (let row = 0; row < art.rows.length; row += 1) {
    const line = art.rows[row];
    for (let col = 0; col < line.length; col += 1) {
      const code = line[col];
      if (code === '.') continue;
      const key = PALETTE_CODES[code];
      if (!key) continue;

      const cellX = baseX + col;
      // Mirror by reflecting the pixel inside the cell — an exact integer flip,
      // unlike a canvas scale(-1,1) which can land art off the pixel grid.
      const drawX = mirror ? CELL_WIDTH - 1 - cellX : cellX;
      const drawY = baseY + row;
      if (drawX < 0 || drawX >= CELL_WIDTH || drawY < 0 || drawY >= CELL_HEIGHT) continue;

      ctx.fillStyle = colors[key];
      ctx.fillRect(originX + drawX, originY + drawY, 1, 1);
    }
  }
}

function bake(palette: SpritePalette): SpriteSheet {
  // A ragged row in the art shifts every pixel after it, which is easy to miss
  // by eye. Surface it loudly while editing; costs nothing in production.
  if (import.meta.env.DEV) {
    const problems = validateRig();
    if (problems.length) console.error('Sprite rig invalid:\n' + problems.join('\n'));
  }

  const colors = resolvePalette(palette);
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_WIDTH;
  canvas.height = ATLAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sprite atlas: 2D context unavailable');
  ctx.imageSmoothingEnabled = false;

  for (const orientation of ORIENTATIONS) {
    const parts = RIG[artOrientation(orientation)];
    // Body art: the authored `left` rig faces left, so `right` is its mirror.
    const mirrorBody = orientation === 'right';
    // Effects are authored in front of a *right*-facing fighter (at the cell's
    // right edge), so they mirror on the opposite orientation to the body. Using
    // one flag for both put the orb behind the fighter in *both* side views.
    const mirrorFx = orientation === 'left';

    for (const animation of ANIMATION_ORDER) {
      const row = rowIndex(orientation, animation);
      const originY = row * CELL_HEIGHT;

      ANIMATIONS[animation].frames.forEach((frame, frameIndex) => {
        const originX = frameIndex * CELL_WIDTH;

        for (const partId of DRAW_ORDER) {
          const art = parts[partId as PartId];
          if (!art) continue;
          // `bubble` only reads underwater, where the body is hidden.
          if (partId === 'bubble' && !frame.parts?.torso?.hidden) continue;
          drawPart(ctx, art, frame.parts?.[partId], colors, originX, originY, mirrorBody);
        }

        for (const rect of frame.fx ?? []) {
          const x = mirrorFx ? CELL_WIDTH - (rect.x + rect.w) : rect.x;
          ctx.fillStyle = colors[rect.color];
          ctx.fillRect(originX + x, originY + rect.y, rect.w, rect.h);
        }
      });
    }
  }

  return {
    url: canvas.toDataURL(),
    width: ATLAS_WIDTH,
    height: ATLAS_HEIGHT,
    frameCount: (animation) => ANIMATIONS[animation].frames.length,
    // Clamp to the frames this animation actually has, not to the atlas width.
    // Animations have different lengths, so a frame index left over from the
    // previous animation (state resets a render later than the prop changes)
    // would otherwise address a never-baked, fully transparent cell and blink
    // the fighter out for one paint — visible on every surface-from-dive.
    frameOrigin: (orientation, animation, frame) => {
      const last = ANIMATIONS[animation].frames.length - 1;
      const index = Math.min(Math.max(frame, 0), last);
      return {
        x: index * CELL_WIDTH,
        y: rowIndex(orientation, animation) * CELL_HEIGHT,
      };
    },
  };
}

/** Bakes (or returns the cached) sheet for a palette. Requires a DOM. */
export function getSpriteSheet(palette: SpritePalette): SpriteSheet {
  const key = `${palette.primary}|${palette.accent}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sheet = bake(palette);
  cache.set(key, sheet);
  return sheet;
}

export const ATLAS_INFO = { ATLAS_WIDTH, ATLAS_HEIGHT, MAX_FRAMES, ORIENTATIONS, ANIMATION_ORDER };
