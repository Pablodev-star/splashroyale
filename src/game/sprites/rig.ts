import type { AuthoredOrientation, PaletteKey, PartArt, PartId } from './types';

/**
 * The pixel rig (Block 2A).
 *
 * Palette codes used in the art below:
 *   `.` transparent   `K` outline     `S` skin      `s` skin shade
 *   `P` primary       `p` prim shade  `A` accent    `a` accent shade
 *   `F` foam          `f` foam shade  `W` water     `E` eye
 *
 * Parts are authored at rest; `animations.ts` moves them per frame. Only
 * `front`, `back` and `left` carry art — `right` is `left` mirrored at bake
 * time, which is standard practice and halves the art to keep in sync.
 */

export const PALETTE_CODES: Record<string, PaletteKey> = {
  K: 'outline',
  S: 'skin',
  s: 'skinShade',
  P: 'primary',
  p: 'primaryShade',
  A: 'accent',
  a: 'accentShade',
  F: 'foam',
  f: 'foamShade',
  W: 'water',
  E: 'eye',
};

/** Fixed slots. `primary`/`accent` come from the character, the rest are shared. */
export interface SpritePalette {
  primary: string;
  accent: string;
}

export function resolvePalette(palette: SpritePalette): Record<PaletteKey, string> {
  return {
    outline: '#04121f',
    skin: '#f2c9a0',
    skinShade: '#c99b6f',
    primary: palette.primary,
    primaryShade: shade(palette.primary, 0.62),
    accent: palette.accent,
    accentShade: shade(palette.accent, 0.66),
    foam: '#e8fbff',
    foamShade: '#9ef0f5',
    // Translucent on purpose: the veil tints the submerged body instead of
    // hiding it, which is what makes the waterline read as water.
    water: 'rgb(79 216 255 / 0.42)',
    eye: '#04121f',
  };
}

/** Darkens a hex colour by a factor, staying in the pixel-art palette spirit. */
function shade(hex: string, factor: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const value = Number.parseInt(full, 16);
  const r = Math.round(((value >> 16) & 0xff) * factor);
  const g = Math.round(((value >> 8) & 0xff) * factor);
  const b = Math.round((value & 0xff) * factor);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

const CAP_FRONT: PartArt = {
  x: 8,
  y: 5,
  rows: [
    '...KKKKKK...',
    '..KAAAAAAK..',
    '.KAAAAAAAAK.',
    '.KaaaaaaaaK.',
  ],
};

const CAP_BACK: PartArt = {
  x: 8,
  y: 5,
  rows: [
    '...KKKKKK...',
    '..KAAAAAAK..',
    '.KAAAAAAAAK.',
    '.KAAAAAAAAK.',
    '.KaaaaaaaaK.',
  ],
};

const CAP_LEFT: PartArt = {
  x: 8,
  y: 5,
  rows: [
    '..KKKKKK....',
    '.KAAAAAAK...',
    'KAAAAAAAAK..',
    'KaaaaaaaaK..',
  ],
};

const HEAD_FRONT: PartArt = {
  x: 8,
  y: 6,
  rows: [
    '...KKKKKK...',
    '..KSSSSSSK..',
    '.KSSSSSSSSK.',
    '.KSSSSSSSSK.',
    '.KSEESSEESK.',
    '.KSSSSSSSSK.',
    '.KsSSSSSSsK.',
    '..KsSSSSsK..',
    '...KKKKKK...',
  ],
};

const HEAD_LEFT: PartArt = {
  x: 8,
  y: 6,
  rows: [
    '..KKKKKK....',
    '.KSSSSSSK...',
    'KSSSSSSSSK..',
    'KSSSSSSSSK..',
    'KEESSSSSsK..',
    'KSSSSSSSsK..',
    'KsSSSSSSsK..',
    '.KsSSSSsK...',
    '..KKKKKK....',
  ],
};

const HEAD_BACK: PartArt = {
  x: 8,
  y: 6,
  rows: [
    '...KKKKKK...',
    '..KSSSSSSK..',
    '.KSSSSSSSSK.',
    '.KSSSSSSSSK.',
    '.KSSSSSSSSK.',
    '.KsSSSSSSsK.',
    '.KsSSSSSSsK.',
    '..KsSSSSsK..',
    '...KKKKKK...',
  ],
};

const TORSO_FRONT: PartArt = {
  x: 6,
  y: 15,
  rows: [
    '..KKKKKKKKKKKK..',
    '.KPPPPPPPPPPPPK.',
    'KPPPPPPPPPPPPPPK',
    'KPPPAAAAAAAAPPPK',
    'KPPPPPPPPPPPPPPK',
    'KPPPPPPPPPPPPPPK',
    'KpPPPPPPPPPPPPpK',
    'KppPPPPPPPPPPppK',
    '.KppppppppppppK.',
    '..KKKKKKKKKKKK..',
  ],
};

const TORSO_BACK: PartArt = {
  x: 6,
  y: 15,
  rows: [
    '..KKKKKKKKKKKK..',
    '.KPPPPPPPPPPPPK.',
    'KPPPPPPPPPPPPPPK',
    'KPPPPPPPPPPPPPPK',
    'KPPPPPPPPPPPPPPK',
    'KPPPPPPPPPPPPPPK',
    'KpPPPPPPPPPPPPpK',
    'KppPPPPPPPPPPppK',
    '.KppppppppppppK.',
    '..KKKKKKKKKKKK..',
  ],
};

const TORSO_LEFT: PartArt = {
  x: 8,
  y: 15,
  rows: [
    '..KKKKKKKK..',
    '.KPPPPPPPPK.',
    'KPPPPPPPPPPK',
    'KPPPAAAAPPPK',
    'KPPPPPPPPPPK',
    'KPPPPPPPPPPK',
    'KpPPPPPPPPpK',
    'KppPPPPPPppK',
    '.KppppppppK.',
    '..KKKKKKKK..',
  ],
};

/** One arm; the rig places it twice (near/far) and poses move it. */
const ARM: PartArt = {
  x: 3,
  y: 17,
  rows: ['KSSK', 'KSSK', 'KSSK', 'KSSK', 'KSSK', 'KssK', 'KSSK', 'KSSK', '.KK.'],
};

/** The surface line where the body breaks the water. Irregular, not a bar. */
const FOAM: PartArt = {
  x: 2,
  y: 24,
  rows: [
    '..FFFF..FFFFFFFF..FFFF..',
    '.FFFFFFFFFFFFFFFFFFFFFF.',
    '..ffff.ffffffff..ffff...',
  ],
};

/**
 * The body continuing below the surface — legs and hips in shadow tones. The
 * translucent `veil` goes over this, which is what makes it read as refracted
 * through water rather than as a solid object sitting in a bowl.
 */
const UNDERWATER: PartArt = {
  x: 7,
  y: 25,
  rows: [
    '..pppppppppp..',
    '.pppppppppppp.',
    '.pppppppppppp.',
    '..pppppppppp..',
    '..ssss..ssss..',
    '..ssss..ssss..',
    '..ssss..ssss..',
    '...ss....ss...',
  ],
};

/** Translucent water over everything below the surface. */
const VEIL: PartArt = {
  x: 1,
  y: 25,
  rows: [
    '.WW..WWWWWWWWWW..WWWWWW.',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    '.WWWWWWWWWWWWWWWWWWWWWW.',
    '.WWWWWWWWWWWWWWWWWWWWWW.',
    '..WWWWWWWWWWWWWWWWWWWW..',
  ],
};

const BUBBLE: PartArt = { x: 9, y: 22, rows: ['FF', 'FF'] };

type OrientationParts = Partial<Record<PartId, PartArt>>;

const SHARED: OrientationParts = {
  armFar: ARM,
  armNear: { ...ARM, x: 21 },
  foam: FOAM,
  underwater: UNDERWATER,
  veil: VEIL,
  bubble: BUBBLE,
};

export const RIG: Record<AuthoredOrientation, OrientationParts> = {
  front: { ...SHARED, cap: CAP_FRONT, head: HEAD_FRONT, torso: TORSO_FRONT },
  back: { ...SHARED, cap: CAP_BACK, head: HEAD_BACK, torso: TORSO_BACK },
  left: {
    ...SHARED,
    cap: CAP_LEFT,
    head: HEAD_LEFT,
    torso: TORSO_LEFT,
    // Side-on, the far arm is mostly hidden behind the body.
    armFar: { ...ARM, x: 7 },
    armNear: { ...ARM, x: 16 },
  },
};

/**
 * Draw order: back-to-front. `cap` comes *after* `head` — it sits on the skull,
 * so drawing it first lets the head paint straight over it and the character
 * loses their hair. The water layers come last so they read as being in front of
 * the submerged body.
 */
export const DRAW_ORDER: PartId[] = [
  'armFar',
  'underwater',
  'head',
  'cap',
  'torso',
  'armNear',
  'veil',
  'foam',
  'bubble',
];

/**
 * Rows of a part must all be the same length or every pixel after the short row
 * shifts. Called from a unit test rather than at module load so the check costs
 * nothing at runtime.
 */
export function validateRig(): string[] {
  const problems: string[] = [];
  for (const [orientation, parts] of Object.entries(RIG)) {
    for (const [partId, art] of Object.entries(parts) as [PartId, PartArt][]) {
      const widths = new Set(art.rows.map((row) => row.length));
      if (widths.size > 1) {
        problems.push(
          `${orientation}.${partId}: rows have differing widths (${[...widths].join(', ')})`,
        );
      }
      for (const row of art.rows) {
        for (const code of row) {
          if (code !== '.' && !(code in PALETTE_CODES)) {
            problems.push(`${orientation}.${partId}: unknown palette code "${code}"`);
          }
        }
      }
    }
  }
  return problems;
}
