/**
 * Sprite system types (Block 2A).
 *
 * The roster is animated with a *pixel rig*: a small set of hand-authored body
 * parts (pixel matrices) that each animation frame repositions on an integer
 * grid. Authoring 7 animations x 4 orientations as full frames would mean ~84
 * hand-drawn matrices; a rig gets the same motion from 6 parts plus tiny offset
 * tables, stays diffable in review, and guarantees every part lands on the same
 * pixel grid (STYLEGUIDE §3.4).
 */

/** Authored orientations. `right` is `left` mirrored at bake time. */
export type Orientation = 'front' | 'back' | 'left' | 'right';

/** The orientations that actually carry art; `right` mirrors `left`. */
export type AuthoredOrientation = 'front' | 'back' | 'left';

/**
 * The seven states the match engine (Block 3) can ask for. `dive` holds on its
 * final frame, which doubles as the submerged idle.
 */
export type AnimationId = 'idle' | 'swim' | 'charge' | 'attack' | 'kick' | 'dive' | 'hit';

export type PartId =
  | 'cap'
  | 'head'
  | 'torso'
  | 'armFar'
  | 'armNear'
  | 'foam'
  | 'underwater'
  | 'veil'
  | 'bubble';

/** Palette slots. Each character supplies primary/accent; the rest are fixed. */
export type PaletteKey =
  | 'outline'
  | 'skin'
  | 'skinShade'
  | 'primary'
  | 'primaryShade'
  | 'accent'
  | 'accentShade'
  | 'foam'
  | 'foamShade'
  | 'water'
  | 'eye';

/**
 * A part's art: rows of single-character palette codes. `.` is transparent.
 * Every row in a part must be the same length.
 */
export interface PartArt {
  rows: string[];
  /** Anchor offset from the cell origin, in pixels, at rest. */
  x: number;
  y: number;
}

/** Where a part sits on a given frame, relative to its rest anchor. */
export interface PartPose {
  dx?: number;
  dy?: number;
  hidden?: boolean;
}

/** A flat rectangle of one palette colour — used for splashes and water orbs. */
export interface FxRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: PaletteKey;
}

export interface SpriteFrame {
  durationMs: number;
  parts?: Partial<Record<PartId, PartPose>>;
  fx?: FxRect[];
}

export interface SpriteAnimation {
  /** `false` holds the last frame instead of restarting. */
  loop: boolean;
  frames: SpriteFrame[];
}

/** Logical cell the rig is authored in. Everything scales as a whole. */
export const CELL_WIDTH = 28;
export const CELL_HEIGHT = 44;
