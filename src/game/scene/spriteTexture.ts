import { NearestFilter, SRGBColorSpace, Texture } from 'three';
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  getSpriteSheet,
  type AnimationId,
  type Orientation,
  type SpritePalette,
  type SpriteSheet,
} from '@/game/sprites';

/**
 * Bridges the Block 2A sprite atlas into Three.js (Block 3A).
 *
 * The atlas is already a baked sprite sheet — it is reused as-is rather than
 * re-authored for 3D, so the fighters in the arena are literally the same
 * frames the 2D screens show. Each fighter gets a cloned `Texture` sharing one
 * `Image`, since the clones differ only in UV offset.
 */

interface LoadedAtlas {
  image: HTMLImageElement;
  sheet: SpriteSheet;
  /** Resolves once the data URL has decoded; UVs are wrong until it does. */
  ready: Promise<void>;
}

const atlasCache = new Map<string, LoadedAtlas>();

function paletteKey(palette: SpritePalette): string {
  return `${palette.primary}|${palette.accent}`;
}

function loadAtlas(palette: SpritePalette): LoadedAtlas {
  const key = paletteKey(palette);
  const cached = atlasCache.get(key);
  if (cached) return cached;

  const sheet = getSpriteSheet(palette);
  const image = new Image();
  const ready = new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve(); // Never leave a caller hanging on a bad decode.
  });
  image.src = sheet.url;

  const entry = { image, sheet, ready };
  atlasCache.set(key, entry);
  return entry;
}

export interface SpriteFrameTexture {
  texture: Texture;
  /** Points the texture at one atlas cell. Cheap — safe to call every frame. */
  setFrame(orientation: Orientation, animation: AnimationId, frame: number): void;
  ready: Promise<void>;
  dispose(): void;
}

export function createSpriteTexture(palette: SpritePalette): SpriteFrameTexture {
  const atlas = loadAtlas(palette);
  const texture = new Texture(atlas.image);

  // Pixel art: never interpolate. Mipmaps would blend neighbouring atlas cells
  // into each other at distance, bleeding one animation frame into the next.
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  // The atlas holds sRGB palette colours. Left untagged, Three treats the
  // texels as already-linear and converts them to sRGB again on output, so the
  // characters render brighter than the palette they were authored in.
  texture.colorSpace = SRGBColorSpace;

  const cellU = CELL_WIDTH / atlas.sheet.width;
  const cellV = CELL_HEIGHT / atlas.sheet.height;
  texture.repeat.set(cellU, cellV);

  atlas.ready.then(() => {
    texture.needsUpdate = true;
  });

  let lastKey = '';

  return {
    texture,
    ready: atlas.ready,
    setFrame(orientation, animation, frame) {
      const key = `${orientation}|${animation}|${frame}`;
      if (key === lastKey) return;
      lastKey = key;

      const origin = atlas.sheet.frameOrigin(orientation, animation, frame);
      // Textures are flipped vertically by default (image row 0 becomes v = 1),
      // so the row's V offset is measured from the bottom of the atlas.
      texture.offset.set(
        origin.x / atlas.sheet.width,
        1 - (origin.y + CELL_HEIGHT) / atlas.sheet.height,
      );
    },
    dispose() {
      texture.dispose();
    },
  };
}

export { CELL_HEIGHT, CELL_WIDTH };
