import {
  CanvasTexture,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  RingGeometry,
  SRGBColorSpace,
  type Object3D,
} from 'three';
import { ChunkField, hash01, hash11 } from './chunks';

/**
 * Visuals for the ability effects.
 *
 * Every shape the engine can produce needs to be legible at a glance while
 * something is trying to hit you, which is a stricter requirement than looking
 * good in a screenshot. Three rules follow from it:
 *
 * 1. **Colour carries meaning, not decoration.** Green is "this hurts you over
 *    time", amber is "this is about to happen here", cyan is the arena's own
 *    water.
 * 2. **Ownership is visible.** Effects you cast and effects cast at you differ,
 *    because "is that mine?" is the first question about anything on the floor.
 * 3. **A phenomenon is made of pieces.** The first pass built each effect from
 *    a few stretched primitives, and it showed: a tsunami was a box sliding
 *    across the pool. Water does not have flat faces. Everything here is
 *    assembled from many small chunks whose heights, widths and offsets vary
 *    across the shape and over time — a crest is fifteen columns at different
 *    heights with a lip curling over them and spray coming off the top.
 *
 * All of that detail goes through one `ChunkField`, so a screen full of
 * effects is a single draw call regardless of how many pieces they are made
 * of. Only the flat zone discs and the warning rings are separate meshes,
 * because both need a texture or a ring geometry a box cannot give.
 */

/** Normalised (0..1 arena) effect data, mirroring the engine snapshot. */
export interface SceneZone {
  id: string;
  flavour: 'poison' | 'chlorine' | 'whirlpool';
  x: number;
  y: number;
  radius: number;
  progress: number;
  mine: boolean;
}

export interface SceneWave {
  id: string;
  x: number;
  y: number;
  angle: number;
  width: number;
  progress: number;
  mine: boolean;
}

export interface SceneBeam {
  id: string;
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
  progress: number;
  mine: boolean;
}

export interface SceneMine {
  id: string;
  x: number;
  y: number;
  radius: number;
  progress: number;
  mine: boolean;
}

export interface SceneGeyser {
  id: string;
  x: number;
  y: number;
  radius: number;
  erupting: boolean;
  progress: number;
  mine: boolean;
}

export interface SceneEffects {
  zones: SceneZone[];
  waves: SceneWave[];
  beams: SceneBeam[];
  mines: SceneMine[];
  geysers: SceneGeyser[];
}

export const EMPTY_EFFECTS: SceneEffects = {
  zones: [],
  waves: [],
  beams: [],
  mines: [],
  geysers: [],
};

/* --- Palette --------------------------------------------------------------- */

interface ZoneSkin {
  fill: string;
  rim: string;
  /** Radians per second the disc turns. */
  spin: number;
  /** Colour of the bubbles and churn rising off it. */
  froth: string;
}

const ZONE_SKIN: Record<SceneZone['flavour'], ZoneSkin> = {
  // Sickly green, the one colour nothing else in the arena uses — a poison
  // patch has to be identifiable against blue water and a white deck.
  poison: { fill: '#4faa2e', rim: '#8fe04a', spin: 0.25, froth: '#b6f26a' },
  // Chemical yellow-green: "treated water gone wrong", and much paler than
  // poison so the two never blur together.
  chlorine: { fill: '#b4c93a', rim: '#e9f77d', spin: 0.15, froth: '#f4ffa8' },
  // A hole rather than a stain: dark where the others are bright, turning fast
  // enough to read as a current.
  whirlpool: { fill: '#07243f', rim: '#3fa9d8', spin: 2.6, froth: '#9ef0f5' },
};

/** Rim colour by ownership. Answers "is that mine?" before anything else. */
const OWNER_RIM = { mine: '#9ef0f5', theirs: '#ff6b6b' } as const;

/* Water tones for the wave.
 *
 * Dark enough to stand against every pool palette, but not as dark as the
 * first pass: at #0a3255 the mass read as a rock rather than as water, because
 * nothing else in the arena is that close to black. The four tones step up
 * from the shadowed base to a lit band under the crest. */
const WAVE_DEEP = '#0d3d63';
const WAVE_BODY = '#175a86';
const WAVE_FACE = '#2482b8';
const WAVE_LIT = '#4aa8d8';
const WAVE_CREST = '#eafcff';
const FOAM = '#ffffff';

/**
 * Foam on an effect that is not yours.
 *
 * Warm rather than red: foam is white in the world, and a scarlet crest reads
 * as lava, not water. A rose cast against the cool blues of the pool is enough
 * to answer "is that mine?" at a glance while still looking like sea spray —
 * the same treatment the beam core already used before this rewrite.
 */
const FOAM_HOSTILE = '#ffdede';
const WAVE_CREST_HOSTILE = '#ffd2d2';

const BEAM_CORE = '#eafcff';
const BEAM_EDGE = '#34b6d8';
const MINE_BODY = '#0a1f33';
const MINE_TRIM = '#ff6b6b';
const GEYSER_WATER = '#7fd4f0';
const GEYSER_FOAM = '#eafcff';
const WARN_COLOUR = '#ffc247';

/* --- Dimensions ------------------------------------------------------------- */

/** Metres above the water plane, so nothing z-fights the surface. */
const Y = { zone: 0.05, mine: 0.14, warn: 0.07 };

/** Metres a wave stands at full height — comfortably above head height. */
const WAVE_HEIGHT = 2.6;
/** Columns across a wave's face. More reads as water; fewer reads as a fence. */
const WAVE_SEGMENTS = 15;
/** Metres a geyser column reaches. Tall enough to read, short enough to frame. */
const GEYSER_HEIGHT = 3.4;
/** Boxes stacked up a geyser column. */
const GEYSER_STACK = 10;
/** Segments along a beam, so it can taper and flicker unevenly. */
const BEAM_SEGMENTS = 14;
/** Metres a beam stands tall. Independent of its width — see `drawBeam`. */
const BEAM_THICKNESS = 0.5;

/** Caps. Generous enough that nothing is ever dropped in a real match. */
// Rings are shared by three effects — zone outlines, mine fuses and geyser
// telegraphs — so the cap has to cover the worst case of all three at once
// (8 + 8 + 12), not any one of them.
const LIMITS = { zone: 8, ring: 32 };

/**
 * Chunk budget.
 *
 * Worst case is roughly: 3 waves x 62, 12 geysers x 24, 8 zones x 50, 4 beams
 * x 32, 8 mines x 11. Real matches use a fraction of that — this is sized so
 * the cap is never the thing you notice.
 */
const CHUNK_CAPACITY = 1400;

/* --- Dithered disc texture -------------------------------------------------- */

/**
 * A 4x4 Bayer matrix, the smallest that gives four believable density steps.
 * Used as an alpha threshold so a "50% transparent" fill becomes a hard checker
 * rather than a smooth wash.
 */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * One zone disc as a texture: dithered body, solid rim, concentric rings for
 * the spin to show against. Drawn once per flavour and shared — rebuilding a
 * canvas per cast would allocate during combat.
 */
function makeZoneTexture(skin: ZoneSkin): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new CanvasTexture(canvas);

  const image = ctx.createImageData(size, size);
  const data = image.data;
  const centre = (size - 1) / 2;
  const fill = hexToRgb(skin.fill);
  const rim = hexToRgb(skin.rim);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const distance = Math.hypot(x - centre, y - centre) / centre;
      if (distance > 1) continue; // Outside the disc: fully transparent.

      // Hard rim band; inside it the density falls toward the centre so a
      // fighter standing in the puddle is never hidden by it.
      const isRim = distance > 0.87;
      const isRing = Math.abs(distance - 0.42) < 0.05 || Math.abs(distance - 0.66) < 0.04;
      const density = isRim ? 1 : isRing ? 0.85 : 0.34 + (1 - distance) * 0.18;

      const threshold = (BAYER4[y % 4][x % 4] + 0.5) / 16;
      if (density < threshold) continue;

      const colour = isRim || isRing ? rim : fill;
      data[index] = colour[0];
      data[index + 1] = colour[1];
      data[index + 2] = colour[2];
      data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/* --- Pooling ---------------------------------------------------------------- */

/**
 * A fixed pool of meshes reused across frames.
 *
 * Effects appear and vanish constantly, and building a `Mesh` per cast would
 * allocate geometry and materials mid-fight — the one place a GC pause is
 * actually visible. Every slot is built once and hidden when unused, exactly
 * as the droplet and projectile buffers already work.
 */
class MeshPool<T extends Object3D> {
  private readonly items: T[] = [];
  private used = 0;

  constructor(
    private readonly parent: Group,
    private readonly make: () => T,
    private readonly limit: number,
  ) {}

  begin(): void {
    this.used = 0;
  }

  next(): T | null {
    if (this.used >= this.limit) return null;
    let item = this.items[this.used];
    if (!item) {
      item = this.make();
      this.items.push(item);
      this.parent.add(item);
    }
    this.used += 1;
    item.visible = true;
    return item;
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i += 1) this.items[i].visible = false;
  }

  dispose(): void {
    for (const item of this.items) {
      this.parent.remove(item);
      item.traverse((node) => {
        const mesh = node as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as MeshBasicMaterial | MeshBasicMaterial[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
    }
    this.items.length = 0;
  }
}

/** Stable numeric seed from an effect id, so its jitter never re-rolls. */
function seedOf(id: string): number {
  let seed = 0;
  for (let i = 0; i < id.length; i += 1) seed = (seed * 31 + id.charCodeAt(i)) % 100000;
  return seed;
}

/* --- The layer -------------------------------------------------------------- */

export class EffectLayer {
  readonly group = new Group();

  private readonly zoneTextures: Record<SceneZone['flavour'], CanvasTexture>;
  private readonly discs: MeshPool<Mesh>;
  private readonly rings: MeshPool<Mesh>;
  private readonly chunks: ChunkField;

  private clock = 0;

  /** `arena` is the world size one normalised unit maps to. */
  constructor(private readonly arena: number) {
    this.zoneTextures = {
      poison: makeZoneTexture(ZONE_SKIN.poison),
      chlorine: makeZoneTexture(ZONE_SKIN.chlorine),
      whirlpool: makeZoneTexture(ZONE_SKIN.whirlpool),
    };

    this.discs = new MeshPool(
      this.group,
      () => {
        const mesh = new Mesh(
          new CircleGeometry(1, 28),
          new MeshBasicMaterial({ transparent: true, depthWrite: false }),
        );
        mesh.rotation.x = -Math.PI / 2;
        return mesh;
      },
      LIMITS.zone,
    );

    this.rings = new MeshPool(
      this.group,
      () => {
        const mesh = new Mesh(
          new RingGeometry(0.74, 1, 24),
          new MeshBasicMaterial({ transparent: true, depthWrite: false }),
        );
        mesh.rotation.x = -Math.PI / 2;
        return mesh;
      },
      LIMITS.ring,
    );

    this.chunks = new ChunkField(this.group, CHUNK_CAPACITY);
  }

  /**
   * Normalised arena coordinate to world. The water plane is centred on the
   * origin, so 0..1 maps to -arena/2..+arena/2 — the same transform
   * `ArenaScene.toWorld` uses. Lengths just multiply by `arena`.
   */
  private wx(n: number): number {
    return (n - 0.5) * this.arena;
  }

  /** Places every effect for this frame. `dt` drives spin, flicker and spray. */
  update(effects: SceneEffects, dt: number): void {
    this.clock += dt;
    this.discs.begin();
    this.rings.begin();
    this.chunks.begin();

    for (const zone of effects.zones) this.drawZone(zone);
    for (const wave of effects.waves) this.drawWave(wave);
    for (const beam of effects.beams) this.drawBeam(beam);
    for (const item of effects.mines) this.drawMine(item);
    for (const geyser of effects.geysers) this.drawGeyser(geyser);

    this.discs.end();
    this.rings.end();
    this.chunks.end();
  }

  /* --- Zones ------------------------------------------------------------- */

  private drawZone(zone: SceneZone): void {
    const skin = ZONE_SKIN[zone.flavour];
    const cx = this.wx(zone.x);
    const cz = this.wx(zone.y);
    const radius = zone.radius * this.arena;
    const seed = seedOf(zone.id);

    // Fades only over the last quarter of its life: a hazard that starts
    // dimming immediately reads as already gone while it is still lethal.
    const fade = zone.progress > 0.75 ? 1 - (zone.progress - 0.75) / 0.25 : 1;

    const disc = this.discs.next();
    if (disc) {
      const material = disc.material as MeshBasicMaterial;
      material.map = this.zoneTextures[zone.flavour];
      material.opacity = 0.55 + 0.45 * fade;
      material.needsUpdate = true;
      disc.position.set(cx, Y.zone, cz);
      const pulse = zone.flavour === 'whirlpool' ? 1 - zone.progress * 0.25 : 1;
      disc.scale.setScalar(radius * pulse);
      disc.rotation.z = this.clock * skin.spin * (zone.mine ? 1 : -1);
    }

    // Churn around the rim: the disc alone is a decal, and a decal on water
    // reads as a sticker. Blocks rising and falling at its edge give it a
    // surface that is being disturbed.
    //
    // Every third block takes the owner colour instead of the flavour's. For a
    // zone this is the most consequential cue in the game and not merely a
    // nicety: a zone only ever damages the enemy of whoever cast it, so "is it
    // mine?" is literally "does this hurt me?". The flavour still owns the
    // fill and the froth, because *what kind of hazard* has to survive the
    // answer — a green puddle ringed in red is theirs, ringed in cyan is
    // yours, and both are still obviously poison.
    const ownerTint = zone.mine ? OWNER_RIM.mine : OWNER_RIM.theirs;

    // An outline in the owner's colour, drawn around the patch.
    //
    // Tinting a few of the churn blocks was not enough on its own: against a
    // bright green slick the accents read as more slick. A continuous ring is
    // unambiguous, and it reuses the language the mine and geyser telegraphs
    // already established — a coloured ring on the water means "this circle
    // matters".
    const outline = this.rings.next();
    if (outline) {
      const material = outline.material as MeshBasicMaterial;
      material.color.set(ownerTint);
      material.opacity = 0.75 * fade;
      outline.position.set(cx, Y.warn, cz);
      outline.scale.setScalar(radius * 1.06);
      outline.rotation.z = this.clock * skin.spin * 0.4;
    }

    const rimCount = 14;
    for (let i = 0; i < rimCount; i += 1) {
      const a = (i / rimCount) * Math.PI * 2 + this.clock * skin.spin * 0.5;
      const bob = Math.sin(this.clock * 3.4 + i * 1.7 + seed) * 0.5 + 0.5;
      const h = (0.12 + bob * 0.22) * fade;
      if (h < 0.04) continue;
      const r = radius * (0.9 + hash01(seed + i) * 0.12);
      this.chunks.add(
        cx + Math.cos(a) * r,
        h * 0.5,
        cz + Math.sin(a) * r,
        0.3,
        h,
        0.3,
        i % 3 === 0 ? ownerTint : skin.froth,
        a,
      );
    }

    // Bubbles breaking the surface, on independent loops.
    const bubbles = 9;
    for (let i = 0; i < bubbles; i += 1) {
      const phase = (this.clock * (0.5 + hash01(seed + i * 7) * 0.5) + hash01(seed + i)) % 1;
      const a = hash01(seed + i * 3) * Math.PI * 2;
      const r = radius * 0.2 + hash01(seed + i * 11) * radius * 0.6;
      const size = (0.12 + hash01(seed + i * 5) * 0.14) * (1 - phase) * fade;
      if (size < 0.03) continue;
      this.chunks.add(
        cx + Math.cos(a) * r,
        0.08 + phase * 0.55,
        cz + Math.sin(a) * r,
        size,
        size,
        size,
        skin.froth,
      );
    }

    // A whirlpool is a hole, so it gets a funnel — but the funnel has to be
    // built *upward*. The first attempt stepped the rings down below y=0 to
    // dig into the pool, and the water plane is opaque: the entire funnel was
    // hidden under it and the whirlpool was a dark circle again. Instead the
    // rim is thrown up into a wall and each ring inward sits lower and darker,
    // which reads as a bowl from every camera angle the player can reach.
    if (zone.flavour === 'whirlpool') {
      const rings = 3;
      const perRing = 14;
      for (let r = 0; r < rings; r += 1) {
        const t = r / (rings - 1); // 0 at the rim, 1 at the centre.
        const ringRadius = radius * (1 - t * 0.62);
        const wallHeight = (0.62 - t * 0.42) * fade;
        if (wallHeight < 0.05) continue;
        // Deeper rings turn faster, which is what a real vortex does and what
        // makes the shape read as rotating rather than merely round.
        const spin = this.clock * (1.8 + r * 1.9) * (zone.mine ? 1 : -1);
        for (let i = 0; i < perRing; i += 1) {
          const a = (i / perRing) * Math.PI * 2 + spin;
          const lean = Math.sin(this.clock * 4 + i) * 0.06;
          this.chunks.add(
            cx + Math.cos(a) * ringRadius,
            wallHeight * 0.5 + lean,
            cz + Math.sin(a) * ringRadius,
            0.36,
            wallHeight,
            0.36,
            r === 0 ? skin.rim : r === 1 ? skin.fill : WAVE_DEEP,
            a,
          );
        }
      }
    }
  }

  /* --- Waves ------------------------------------------------------------- */

  /**
   * A breaking wave, built as a row of crest columns.
   *
   * The shape that matters: tall through the middle and tapering at the ends,
   * with the face sloping back, a white lip overhanging the front, and spray
   * thrown off the top. A single stretched box has none of that and is why the
   * first pass looked like a wall sliding across the pool.
   */
  private drawWave(wave: SceneWave): void {
    const cx = this.wx(wave.x);
    const cz = this.wx(wave.y);
    const seed = seedOf(wave.id);

    // Local axes: `f` is where the wave is going, `a` runs along its face.
    const fx = Math.cos(wave.angle);
    const fz = Math.sin(wave.angle);
    const ax = -Math.sin(wave.angle);
    const az = Math.cos(wave.angle);
    const yaw = -wave.angle;

    // Rears up quickly, holds, then collapses as it spends itself.
    const rise = Math.min(1, wave.progress * 6);
    const spend = 1 - Math.max(0, wave.progress - 0.68) / 0.32;
    const envelope = Math.max(0, Math.min(rise, spend));
    if (envelope <= 0.01) return;

    const halfWidth = wave.width * this.arena;
    const segWidth = (halfWidth * 2) / WAVE_SEGMENTS;

    // Ownership rides on the foam. Everything else about a wave is water and
    // has to stay water-coloured, but foam is the one part that can carry a
    // tint without looking wrong — and something this large crossing the arena
    // is exactly when "whose is it?" matters most.
    const foam = wave.mine ? FOAM : FOAM_HOSTILE;
    const crestColour = wave.mine ? WAVE_CREST : WAVE_CREST_HOSTILE;

    for (let i = 0; i < WAVE_SEGMENTS; i += 1) {
      const u = (i + 0.5) / WAVE_SEGMENTS;
      const lateral = (u - 0.5) * halfWidth * 2;

      // Crown profile: a flattened sine, so the middle is a broad mass rather
      // than a single peak, and the ends still taper into the water.
      const crown = Math.pow(Math.sin(Math.PI * u), 0.55);
      // Undulation travelling along the crest, so no two columns are level.
      const ripple = 0.84 + 0.16 * Math.sin(u * 11 + this.clock * 7 + seed);
      const height = WAVE_HEIGHT * crown * ripple * envelope;
      if (height < 0.12) continue;

      const bx = cx + ax * lateral;
      const bz = cz + az * lateral;

      // Back of the wave. Both sides get a full treatment on purpose: a wave
      // you cast travels away from you, so the *back* is the side you look at
      // for most of its life, and an earlier pass that only detailed the face
      // left the caster watching a flat navy hill.
      //
      // Split into a shadowed base and a lighter upper mass, so the back reads
      // as a curved surface rather than one extruded shape.
      this.chunks.add(
        bx - fx * 0.55,
        height * 0.24,
        bz - fz * 0.55,
        0.7,
        height * 0.48,
        segWidth * 0.98,
        WAVE_DEEP,
        yaw,
      );
      this.chunks.add(
        bx - fx * 0.52,
        height * 0.62,
        bz - fz * 0.52,
        0.66,
        height * 0.4,
        segWidth * 0.96,
        hash01(seed + i * 3) > 0.5 ? WAVE_BODY : WAVE_FACE,
        yaw,
      );
      // Lit strip along the back's shoulder, catching the sky.
      this.chunks.add(
        bx - fx * 0.5,
        height * 0.84,
        bz - fz * 0.5,
        0.6,
        height * 0.16,
        segWidth * 0.94,
        WAVE_LIT,
        yaw,
      );
      // Foam tumbling down the back of the break, thickest where the wave is
      // tallest and therefore breaking hardest.
      if (crown > 0.4 && i % 2 === 0) {
        const n = seed + i * 23;
        const spill = (this.clock * 0.7 + hash01(n)) % 1;
        const size = 0.3 * (1 - spill * 0.6);
        this.chunks.add(
          bx - fx * (0.7 + spill * 0.5),
          height * (0.86 - spill * 0.55),
          bz - fz * (0.7 + spill * 0.5),
          size,
          size,
          segWidth * 0.6,
          foam,
          yaw,
        );
      }

      // The face, stepped forward and slightly shorter, so the wall is not one
      // flat plane from the front.
      this.chunks.add(
        bx,
        height * 0.5,
        bz,
        0.5,
        height,
        segWidth * 0.94,
        // Tone picked by hash, not by column parity. Alternating every other
        // column produced evenly spaced vertical stripes down the wall — the
        // wave read as a picket fence, which is worse than the flat slab it
        // replaced. Irregular placement is what makes it look like water.
        hash01(seed + i * 7) > 0.5 ? WAVE_BODY : WAVE_FACE,
        yaw,
      );

      // Flow bands sliding down the wall. Deliberately wider than one column
      // and only emitted from every third, so they cut *across* the segment
      // grid: a band per column would just be more vertical striping.
      if (i % 3 === 1) {
        const n = seed + i * 17;
        const slide = (this.clock * 0.5 + hash01(n)) % 1;
        const sy = height * (0.22 + slide * 0.5);
        if (sy < height - 0.25) {
          this.chunks.add(
            bx + fx * 0.1,
            sy,
            bz + fz * 0.1,
            0.56,
            height * 0.1,
            segWidth * (1.8 + hash01(n + 1) * 1.2),
            WAVE_FACE,
            yaw,
          );
        }
      }

      // Where the wall meets the pool: a bright churn line, so the wave sits
      // *in* the water instead of on top of it.
      this.chunks.add(
        bx + fx * 0.3,
        0.1,
        bz + fz * 0.3,
        0.5,
        0.2 + 0.1 * Math.sin(this.clock * 8 + i),
        segWidth * 0.96,
        foam,
        yaw,
      );

      // A lit band just under the crest, where the sun catches the shoulder of
      // the wave. This is what stops the mass reading as one silhouette: with
      // only body tones the wall was a dark shape with a white hat.
      const shoulder = 0.3 + 0.12 * hash01(seed + i * 5);
      this.chunks.add(
        bx + fx * 0.06,
        height - shoulder * 0.5,
        bz + fz * 0.06,
        0.58,
        shoulder,
        segWidth * 0.96,
        WAVE_LIT,
        yaw,
      );

      // Crest cap.
      const crestH = 0.26 + 0.1 * hash01(seed + i);
      this.chunks.add(
        bx + fx * 0.12,
        height + crestH * 0.4,
        bz + fz * 0.12,
        0.62,
        crestH,
        segWidth * 1.02,
        crestColour,
        yaw,
      );

      // The lip: an overhang thrown ahead of the crest where the wave is tall,
      // which is what makes it read as breaking rather than merely standing.
      if (crown > 0.45) {
        const reach = 0.42 + 0.5 * crown;
        this.chunks.add(
          bx + fx * reach,
          height - 0.12,
          bz + fz * reach,
          0.42,
          0.3,
          segWidth * 0.9,
          foam,
          yaw,
        );
      }

      // Spray off the top. Each droplet is on its own loop so the crest is
      // constantly shedding water rather than pulsing in unison.
      if (crown > 0.3 && i % 2 === 0) {
        for (let s = 0; s < 2; s += 1) {
          const n = seed + i * 13 + s * 71;
          const phase = (this.clock * (1.1 + hash01(n) * 0.9) + hash01(n + 1)) % 1;
          const size = 0.16 * (1 - phase);
          if (size < 0.03) continue;
          // Thrown forward and up, arcing over as it goes.
          const forward = 0.3 + phase * 1.5;
          const lift = height + phase * 1.3 - phase * phase * 1.5;
          this.chunks.add(
            bx + fx * forward + ax * hash11(n + 2) * 0.4,
            Math.max(0.05, lift),
            bz + fz * forward + az * hash11(n + 2) * 0.4,
            size,
            size,
            size,
            foam,
          );
        }
      }

      // Foam left on the water behind the wave.
      if (i % 2 === 1) {
        const trail = 1.2 + hash01(seed + i * 5) * 0.9;
        this.chunks.add(
          bx - fx * trail,
          0.06,
          bz - fz * trail,
          0.5,
          0.12,
          segWidth * 0.8,
          foam,
          yaw,
        );
      }
    }
  }

  /* --- Beams ------------------------------------------------------------- */

  private drawBeam(beam: SceneBeam): void {
    const ox = this.wx(beam.x);
    const oz = this.wx(beam.y);
    const fx = Math.cos(beam.angle);
    const fz = Math.sin(beam.angle);
    const yaw = -beam.angle;
    const seed = seedOf(beam.id);
    const length = beam.length * this.arena;
    // Deliberately narrower than the hitbox it represents. `beam.width` is a
    // half-width the engine tests against, so drawing the full 1.6m as solid
    // geometry put a slab across the lower half of the screen — the caster
    // stands at the camera, so a beam is always seen from its own nozzle.
    // A lance should look like a lance; the damage stays as wide as it was.
    const width = beam.width * this.arena * 1.15;
    const segLength = length / BEAM_SEGMENTS;
    const height = 0.9;
    // A beam is the fastest-appearing effect in the game and two can be live at
    // once, so the core carries the owner tint the same way wave foam does.
    const core = beam.mine ? BEAM_CORE : FOAM_HOSTILE;

    for (let i = 0; i < BEAM_SEGMENTS; i += 1) {
      const t = (i + 0.5) / BEAM_SEGMENTS;
      const distance = t * length;
      const px = ox + fx * distance;
      const pz = oz + fz * distance;

      // The jet loses coherence with distance and boils along its length, so
      // the beam is never a uniform bar.
      const boil = 0.78 + 0.22 * Math.sin(t * 22 - this.clock * 26 + seed);
      const spread = 1 + t * 0.5;
      // Horizontal width and vertical thickness are separate numbers. Driving
      // both from the card's `width` made a 1.6m-wide lance also 1.6m tall —
      // a white cube parked in front of the camera rather than a jet.
      const w = width * spread * boil;
      const thickness = BEAM_THICKNESS * boil;

      this.chunks.add(px, height, pz, segLength * 0.95, thickness, w, BEAM_EDGE, yaw);
      this.chunks.add(
        px,
        height,
        pz,
        segLength * 0.95,
        thickness * 0.5,
        w * 0.45,
        core,
        yaw,
      );

      // Bright slugs of water running down the beam, which is what makes it
      // read as pressurised flow rather than a light.
      const pulse = (t + this.clock * 1.6) % 1;
      if (pulse < 0.12) {
        this.chunks.add(px, height, pz, segLength * 1.1, thickness * 1.3, w * 1.15, core, yaw);
      }
    }

    // Muzzle burst at the nozzle.
    for (let i = 0; i < 5; i += 1) {
      const n = seed + i * 17;
      const phase = (this.clock * 3 + hash01(n)) % 1;
      const size = 0.26 * (1 - phase);
      const out = 0.3 + phase * 0.8;
      this.chunks.add(
        ox + fx * 0.3 + hash11(n + 1) * out * 0.6,
        height + hash11(n + 2) * 0.4,
        oz + fz * 0.3 + hash11(n + 3) * out * 0.6,
        size,
        size,
        size,
        core,
      );
    }

    // Where it lands: spray kicking back off the far end.
    for (let i = 0; i < 6; i += 1) {
      const n = seed + 400 + i * 23;
      const phase = (this.clock * 2.4 + hash01(n)) % 1;
      const size = 0.24 * (1 - phase);
      if (size < 0.04) continue;
      const back = phase * 1.2;
      this.chunks.add(
        ox + fx * (length - back) + hash11(n + 1) * 0.7,
        Math.max(0.08, height + phase * 0.9 - phase * phase * 1.4),
        oz + fz * (length - back) + hash11(n + 2) * 0.7,
        size,
        size,
        size,
        core,
      );
    }
  }

  /* --- Mines ------------------------------------------------------------- */

  private drawMine(item: SceneMine): void {
    const cx = this.wx(item.x);
    const cz = this.wx(item.y);
    const radius = item.radius * this.arena;
    const seed = seedOf(item.id);

    // The charge itself: a body with fins, so it is an object rather than a
    // cube sitting on the water.
    const bob = Math.sin(this.clock * 2.2 + seed) * 0.05;
    this.chunks.add(cx, Y.mine + bob, cz, 0.42, 0.42, 0.42, MINE_BODY);
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      this.chunks.add(
        cx + Math.cos(a) * 0.3,
        Y.mine + bob,
        cz + Math.sin(a) * 0.3,
        0.22,
        0.16,
        0.22,
        MINE_TRIM,
        a,
      );
    }
    // A blinking eye on top, faster as the fuse burns down.
    const rate = 3 + item.progress * 22;
    const lit = item.progress > 0.92 || Math.sin(this.clock * rate) > 0;
    this.chunks.add(cx, Y.mine + bob + 0.26, cz, 0.16, 0.1, 0.16, lit ? MINE_TRIM : MINE_BODY);

    // Bubbles trailing up off it, so a sunk charge is visible from above.
    for (let i = 0; i < 4; i += 1) {
      const n = seed + i * 29;
      const phase = (this.clock * 0.8 + hash01(n)) % 1;
      const size = 0.12 * (1 - phase);
      if (size < 0.03) continue;
      this.chunks.add(
        cx + hash11(n + 1) * 0.3,
        0.2 + phase * 0.7,
        cz + hash11(n + 2) * 0.3,
        size,
        size,
        size,
        GEYSER_FOAM,
      );
    }

    // The warning ring closes in as the fuse burns: a countdown read spatially
    // rather than as a number.
    const ring = this.rings.next();
    if (ring) {
      const material = ring.material as MeshBasicMaterial;
      material.color.set(item.mine ? OWNER_RIM.mine : WARN_COLOUR);
      material.opacity = lit ? 0.9 : 0.4;
      ring.position.set(cx, Y.warn, cz);
      ring.scale.setScalar(Math.max(0.1, radius * (1 - item.progress * 0.7)));
      ring.rotation.z = this.clock * 1.4;
    }
  }

  /* --- Geysers ----------------------------------------------------------- */

  private drawGeyser(geyser: SceneGeyser): void {
    const cx = this.wx(geyser.x);
    const cz = this.wx(geyser.y);
    const radius = geyser.radius * this.arena;
    const seed = seedOf(geyser.id);

    if (!geyser.erupting) {
      // Arming: a filling ring plus the water starting to boil inside it, so
      // the telegraph is visible even with the ring edge-on to the camera.
      const ring = this.rings.next();
      if (ring) {
        const material = ring.material as MeshBasicMaterial;
        material.color.set(geyser.mine ? OWNER_RIM.mine : WARN_COLOUR);
        material.opacity = 0.85;
        ring.position.set(cx, Y.warn, cz);
        ring.scale.setScalar(radius * (0.35 + 0.65 * geyser.progress));
        ring.rotation.z = -this.clock * 2;
      }
      const boil = 5;
      for (let i = 0; i < boil; i += 1) {
        const n = seed + i * 19;
        const a = hash01(n) * Math.PI * 2 + this.clock * 2;
        const r = radius * 0.5 * hash01(n + 1);
        const h = (0.1 + 0.2 * Math.abs(Math.sin(this.clock * 6 + i))) * geyser.progress;
        this.chunks.add(
          cx + Math.cos(a) * r,
          h * 0.5,
          cz + Math.sin(a) * r,
          0.24,
          h,
          0.24,
          GEYSER_FOAM,
        );
      }
      return;
    }

    // Erupting: a turbulent column, not a cylinder. Each slice is narrower
    // than the one below and offset slightly, so the shaft leans and frays as
    // it climbs.
    const rise = Math.min(1, geyser.progress * 4);
    const fall = 1 - Math.max(0, geyser.progress - 0.55) / 0.45;
    const height = Math.max(0.05, rise * fall) * GEYSER_HEIGHT;
    // Narrower than its damage radius: a column as wide as the ring hid the
    // fight behind it. The ring states the danger area; the column only has to
    // be seen.
    const bore = radius * 0.5;
    const sliceH = height / GEYSER_STACK;

    for (let i = 0; i < GEYSER_STACK; i += 1) {
      const t = i / (GEYSER_STACK - 1);
      const n = seed + i * 37;
      // The jet is thinner and more broken the higher it gets, and each slice
      // is offset from the one below. A constant taper looked like a moulded
      // cone; the variance is what makes it read as water under pressure.
      const w = bore * (1 - t * 0.5) * (0.62 + hash01(n) * 0.8);
      // Slices drift upward through the column rather than sitting still, so
      // the shaft has visible flow instead of only a rising outline.
      const flow = (this.clock * 2.2 + hash01(n + 5)) % 1;
      const lean = hash11(n + 1) * 0.3 * t * bore;
      const sway = Math.sin(this.clock * 5 + i * 0.8 + seed) * 0.14 * t;
      this.chunks.add(
        cx + lean + sway,
        t * height + sliceH * 0.5,
        cz + hash11(n + 2) * 0.3 * t * bore,
        w,
        sliceH * 1.05,
        w,
        // Banded rather than a single colour: foam is thrown where the column
        // is breaking up, which is at the top and wherever a slug is passing.
        t > 0.7 || flow > 0.72 ? GEYSER_FOAM : GEYSER_WATER,
      );

      // Water shedding off the sides of the shaft as it climbs.
      if (i % 2 === 1) {
        const m = n + 900;
        const a = hash01(m) * Math.PI * 2 + this.clock * 3;
        const shed = 0.2 + hash01(m + 1) * 0.5;
        const size = 0.16 * (1 - t) * fall;
        if (size > 0.03) {
          this.chunks.add(
            cx + Math.cos(a) * bore * (0.7 + shed),
            t * height,
            cz + Math.sin(a) * bore * (0.7 + shed),
            size,
            size,
            size,
            GEYSER_FOAM,
          );
        }
      }
    }

    // The plume at the top, thrown outward and falling back.
    for (let i = 0; i < 8; i += 1) {
      const n = seed + 200 + i * 41;
      const a = (i / 8) * Math.PI * 2 + hash01(n) * 0.6;
      const phase = (this.clock * 1.6 + hash01(n + 1)) % 1;
      const out = phase * bore * 3;
      const size = 0.28 * (1 - phase) * fall;
      if (size < 0.04) continue;
      this.chunks.add(
        cx + Math.cos(a) * out,
        Math.max(0.06, height + phase * 0.8 - phase * phase * 2.2),
        cz + Math.sin(a) * out,
        size,
        size,
        size,
        GEYSER_FOAM,
      );
    }

    // Displaced water shoved outward at the base.
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const r = bore * (1.4 + rise * 0.8);
      this.chunks.add(
        cx + Math.cos(a) * r,
        0.1,
        cz + Math.sin(a) * r,
        0.34,
        0.2 * fall,
        0.34,
        GEYSER_FOAM,
        a,
      );
    }
  }

  dispose(): void {
    this.discs.dispose();
    this.rings.dispose();
    this.chunks.dispose();
    this.group.remove(this.chunks.mesh);
    for (const texture of Object.values(this.zoneTextures)) texture.dispose();
  }
}
