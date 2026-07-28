import {
  BoxGeometry,
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

/**
 * Visuals for the block 7A ability effects.
 *
 * Every shape the engine can produce needs to be legible at a glance while
 * something is trying to hit you, which is a stricter requirement than looking
 * good in a screenshot. Two rules follow from it:
 *
 * 1. **Colour carries meaning, not decoration.** Green is "this hurts you over
 *    time", amber is "this is about to happen here", cyan is the arena's own
 *    water. A player should be able to name what a patch of colour will do
 *    before reading anything.
 * 2. **Ownership is visible.** Effects you cast and effects cast at you look
 *    different (yours keep a cool rim, theirs a hot one), because "is that
 *    mine?" is the first question about anything on the floor.
 *
 * Transparency is done with **dithered alpha**, not smooth alpha: the texture
 * is a Bayer-thresholded checker so edges stay hard pixels under
 * `NearestFilter`. Smooth alpha would give soft gradients that read as modern
 * 3D and break the palette rule (STYLEGUIDE §3) the rest of the scene keeps.
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
  /** Fill, and the harder rim drawn around it. */
  fill: string;
  rim: string;
  /** Radians per second the disc turns. Zero for a still puddle. */
  spin: number;
}

const ZONE_SKIN: Record<SceneZone['flavour'], ZoneSkin> = {
  // Sickly green, the one colour nothing else in the arena uses — a poison
  // patch has to be identifiable against blue water and a white deck at any
  // camera angle.
  poison: { fill: '#4faa2e', rim: '#8fe04a', spin: 0.25 },
  // Chemical yellow-green: reads as "treated water gone wrong" and stays
  // distinct from poison at a glance because it is much paler.
  chlorine: { fill: '#b4c93a', rim: '#e9f77d', spin: 0.15 },
  // A hole rather than a stain, so it is dark where the others are bright, and
  // it turns fast enough to read as a current.
  whirlpool: { fill: '#07243f', rim: '#3fa9d8', spin: 2.6 },
};

/** Rim colour by ownership. Answers "is that mine?" before anything else. */
const OWNER_RIM = { mine: '#9ef0f5', theirs: '#ff6b6b' } as const;

// Deliberately darker than any depth band in the pool palettes, so the wall
// reads as a solid mass against the water rather than a brighter patch of it.
const WAVE_BODY = '#12496f';
const WAVE_TROUGH = '#06243c';
const WAVE_CREST = '#eafcff';
const BEAM_CORE = '#eafcff';
const BEAM_EDGE = '#34b6d8';
const MINE_BODY = '#0a1f33';
const GEYSER_COLUMN = '#bfefff';
const WARN_COLOUR = '#ffc247';

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
 * Builds one zone disc as a texture: dithered body, solid rim, and a couple of
 * concentric rings so the surface has some structure to rotate against.
 *
 * Drawn once per flavour at construction and shared by every instance — these
 * are 64px canvases, but rebuilding them per cast would allocate during combat.
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

      // The rim is a hard band at the edge; inside it, density falls off
      // toward the centre so the middle is see-through and a fighter standing
      // in the puddle is never hidden by it.
      const isRim = distance > 0.87;
      // Two faint rings give the spin something to show.
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
 * Effects appear and vanish constantly, and creating a `Mesh` per cast would
 * allocate geometry and materials mid-fight — the one place in this codebase
 * where a GC pause is actually visible. Instead every slot is built once and
 * simply hidden when unused, exactly as the droplet and projectile buffers
 * already work.
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

  /** Next free mesh, or null once the pool is exhausted. */
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

  /** Hides everything not claimed this frame. */
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

/* --- The layer -------------------------------------------------------------- */

/** Caps. Generous enough that nothing is ever dropped in a real match. */
const LIMITS = { zone: 8, wave: 6, beam: 4, mine: 8, geyser: 12 };

/** Metres above the water plane each effect sits, so nothing z-fights. */
const Y = { zone: 0.05, wave: 0.02, beam: 0.9, mine: 0.12, warn: 0.07 };

/** Metres a wave stands at full height — comfortably above head height. */
const WAVE_HEIGHT = 2.4;
/** Metres a geyser column reaches. Tall enough to read, short enough to frame. */
const GEYSER_HEIGHT = 3.2;

export class EffectLayer {
  readonly group = new Group();

  private readonly zoneTextures: Record<SceneZone['flavour'], CanvasTexture>;
  private readonly zones: MeshPool<Mesh>;
  private readonly waves: MeshPool<Group>;
  private readonly beams: MeshPool<Group>;
  private readonly mines: MeshPool<Group>;
  private readonly geysers: MeshPool<Group>;

  private clock = 0;

  /** `arena` is the world size one normalised unit maps to. */
  constructor(private readonly arena: number) {
    this.zoneTextures = {
      poison: makeZoneTexture(ZONE_SKIN.poison),
      chlorine: makeZoneTexture(ZONE_SKIN.chlorine),
      whirlpool: makeZoneTexture(ZONE_SKIN.whirlpool),
    };

    this.zones = new MeshPool(
      this.group,
      () => {
        // A unit disc laid flat; scale sets the real radius each frame.
        const mesh = new Mesh(
          new CircleGeometry(1, 24),
          new MeshBasicMaterial({ transparent: true, depthWrite: false }),
        );
        mesh.rotation.x = -Math.PI / 2;
        return mesh;
      },
      LIMITS.zone,
    );

    this.waves = new MeshPool(this.group, () => makeWaveMesh(), LIMITS.wave);
    this.beams = new MeshPool(this.group, () => makeBeamMesh(), LIMITS.beam);
    this.mines = new MeshPool(this.group, () => makeMineMesh(), LIMITS.mine);
    this.geysers = new MeshPool(this.group, () => makeGeyserMesh(), LIMITS.geyser);
  }

  /**
   * Normalised arena coordinate to world. The water plane is centred on the
   * origin, so 0..1 maps to -arena/2..+arena/2 — the same transform
   * `ArenaScene.toWorld` uses. Lengths (radii, widths) just multiply by
   * `arena`; only positions need the shift.
   */
  private wx(n: number): number {
    return (n - 0.5) * this.arena;
  }

  /** Places every effect for this frame. `dt` drives spin and flicker. */
  update(effects: SceneEffects, dt: number): void {
    this.clock += dt;
    const scale = this.arena;

    /* --- Zones ----------------------------------------------------------- */
    this.zones.begin();
    for (const zone of effects.zones) {
      const mesh = this.zones.next();
      if (!mesh) break;
      const skin = ZONE_SKIN[zone.flavour];
      const material = mesh.material as MeshBasicMaterial;
      material.map = this.zoneTextures[zone.flavour];
      // Fades only over the last quarter of its life: a hazard that starts
      // dimming immediately reads as already gone while it is still lethal.
      const fade = zone.progress > 0.75 ? 1 - (zone.progress - 0.75) / 0.25 : 1;
      material.opacity = 0.55 + 0.45 * fade;
      material.needsUpdate = true;

      mesh.position.set(this.wx(zone.x), Y.zone, this.wx(zone.y));
      const radius = zone.radius * scale;
      // A whirlpool visibly tightens as it spins down; the puddles hold size.
      const pulse = zone.flavour === 'whirlpool' ? 1 - zone.progress * 0.25 : 1;
      mesh.scale.setScalar(radius * pulse);
      mesh.rotation.z = this.clock * skin.spin * (zone.mine ? 1 : -1);
    }
    this.zones.end();

    /* --- Waves ----------------------------------------------------------- */
    this.waves.begin();
    for (const wave of effects.waves) {
      const group = this.waves.next();
      if (!group) break;
      group.position.set(this.wx(wave.x), Y.wave, this.wx(wave.y));
      // The wall stands across its direction of travel.
      group.rotation.y = -wave.angle;
      const halfWidth = wave.width * scale;
      // Rears up as it starts, then flattens out as it spends itself, which is
      // what makes a wave read as breaking rather than as a sliding box. The
      // height multiplier is what sells it as a tsunami: at 1m the wall was
      // shorter than the fighters and vanished behind them.
      const rise = Math.min(1, wave.progress * 5);
      const spend = 1 - Math.max(0, wave.progress - 0.7) / 0.3;
      group.scale.set(1, Math.max(0.35, rise * spend) * WAVE_HEIGHT, halfWidth);
      tintGroup(group, 'rim', wave.mine ? OWNER_RIM.mine : OWNER_RIM.theirs);
    }
    this.waves.end();

    /* --- Beams ----------------------------------------------------------- */
    this.beams.begin();
    for (const beam of effects.beams) {
      const group = this.beams.next();
      if (!group) break;
      group.position.set(this.wx(beam.x), Y.beam, this.wx(beam.y));
      group.rotation.y = -beam.angle;
      const length = beam.length * scale;
      // Flickers on a fast sine so a sustained beam looks powered rather than
      // painted on. Never reaches zero — a beam that blinks out reads as over.
      const flicker = 0.82 + 0.18 * Math.sin(this.clock * 40);
      group.scale.set(length, flicker, beam.width * scale * 2 * flicker);
      tintGroup(group, 'core', beam.mine ? BEAM_CORE : '#ffdede');
    }
    this.beams.end();

    /* --- Mines ----------------------------------------------------------- */
    this.mines.begin();
    for (const item of effects.mines) {
      const group = this.mines.next();
      if (!group) break;
      group.position.set(this.wx(item.x), Y.mine, this.wx(item.y));
      // The warning ring closes in on the charge as the fuse burns down — a
      // countdown you read spatially instead of as a number.
      const ring = group.getObjectByName('ring');
      if (ring) {
        const radius = item.radius * scale * (1 - item.progress * 0.72);
        ring.scale.setScalar(Math.max(0.1, radius));
        ring.rotation.z = this.clock * 1.4;
      }
      // Blinks faster the closer it gets, and is solid for the last moment.
      const rate = 3 + item.progress * 22;
      const blink = item.progress > 0.92 ? 1 : Math.sin(this.clock * rate) > 0 ? 1 : 0.25;
      tintGroup(group, 'ring', item.mine ? OWNER_RIM.mine : WARN_COLOUR, blink);
    }
    this.mines.end();

    /* --- Geysers --------------------------------------------------------- */
    this.geysers.begin();
    for (const geyser of effects.geysers) {
      const group = this.geysers.next();
      if (!group) break;
      group.position.set(this.wx(geyser.x), 0, this.wx(geyser.y));
      const radius = geyser.radius * scale;

      const warn = group.getObjectByName('warn');
      const column = group.getObjectByName('column');
      if (warn) {
        // Visible only while arming, and filling as it does.
        warn.visible = !geyser.erupting;
        warn.scale.setScalar(radius * (0.35 + 0.65 * geyser.progress));
        warn.rotation.z = -this.clock * 2;
      }
      const cap = group.getObjectByName('cap');
      if (column) {
        column.visible = geyser.erupting;
        if (cap) cap.visible = geyser.erupting;
        if (geyser.erupting) {
          // Shoots up fast, then falls back — the eruption is over in under
          // half a second, so the rise has to be near-instant to be seen.
          const rise = Math.min(1, geyser.progress * 4);
          const fall = 1 - Math.max(0, geyser.progress - 0.55) / 0.45;
          // Narrower than its damage radius: a column as wide as the ring
          // filled the screen and hid the fight behind it. The ring is what
          // states the actual danger area; the column only has to be seen.
          const bore = radius * 0.55;
          const height = Math.max(0.05, rise * fall) * GEYSER_HEIGHT;
          column.scale.set(bore, height, bore);
          if (cap) {
            cap.scale.set(bore * 1.5, 1, bore * 1.5);
            cap.position.y = height;
          }
        }
      }
      tintGroup(group, 'warn', geyser.mine ? OWNER_RIM.mine : WARN_COLOUR);
    }
    this.geysers.end();
  }

  dispose(): void {
    this.zones.dispose();
    this.waves.dispose();
    this.beams.dispose();
    this.mines.dispose();
    this.geysers.dispose();
    for (const texture of Object.values(this.zoneTextures)) texture.dispose();
  }
}

/* --- Mesh builders ---------------------------------------------------------- */

/** Recolours one named child of a pooled group. */
function tintGroup(group: Group, name: string, colour: string, opacity?: number): void {
  const node = group.getObjectByName(name) as Mesh | undefined;
  if (!node) return;
  const material = node.material as MeshBasicMaterial;
  material.color.set(colour);
  if (opacity !== undefined) {
    material.opacity = opacity;
    material.transparent = opacity < 1;
  }
}

/**
 * A wave is a body plus a crest cap. Built around a unit half-width on Z and a
 * unit height on Y so the layer can scale it per instance, with the body's
 * origin at its base so scaling grows it upward rather than through the floor.
 */
function makeWaveMesh(): Group {
  const group = new Group();

  // Opaque and darker than the pool. The first pass used a translucent
  // mid-blue, which at distance blended into the water it was crossing and
  // read as a lighting change rather than a wall — for the ability whose whole
  // counterplay is seeing it coming and diving, that is the one unacceptable
  // failure.
  const body = new Mesh(
    new BoxGeometry(0.7, 1, 2),
    new MeshBasicMaterial({ color: WAVE_BODY }),
  );
  body.position.y = 0.5;
  body.name = 'body';
  group.add(body);

  // A dark trough at the base, so the wall is bounded below as well as above
  // and does not appear to melt into the surface.
  const trough = new Mesh(
    new BoxGeometry(0.78, 0.18, 2),
    new MeshBasicMaterial({ color: WAVE_TROUGH }),
  );
  trough.position.y = 0.09;
  trough.name = 'trough';
  group.add(trough);

  // The white lip that makes it read as breaking water rather than a slab.
  const crest = new Mesh(
    new BoxGeometry(0.95, 0.3, 2),
    new MeshBasicMaterial({ color: WAVE_CREST }),
  );
  crest.position.y = 1.02;
  crest.name = 'rim';
  group.add(crest);

  // Spray thrown forward off the crest, breaking the silhouette so it is not a
  // perfect rectangle from any angle.
  const spray = new Mesh(
    new BoxGeometry(0.3, 0.16, 1.6),
    new MeshBasicMaterial({ color: WAVE_CREST, transparent: true, opacity: 0.75 }),
  );
  spray.position.set(0.5, 1.2, 0);
  spray.name = 'spray';
  group.add(spray);

  return group;
}

/** A beam: bright core inside a wider, darker sheath. */
function makeBeamMesh(): Group {
  const group = new Group();

  const sheath = new Mesh(
    new BoxGeometry(1, 0.42, 1),
    new MeshBasicMaterial({ color: BEAM_EDGE, transparent: true, opacity: 0.7 }),
  );
  // Origin at the caster: shifting the box half its length forward means
  // scaling X extends it away from them rather than through them.
  sheath.position.x = 0.5;
  sheath.name = 'sheath';
  group.add(sheath);

  const core = new Mesh(new BoxGeometry(1, 0.2, 0.45), new MeshBasicMaterial({ color: BEAM_CORE }));
  core.position.x = 0.5;
  core.name = 'core';
  group.add(core);

  return group;
}

/** A mine: a dark charge under a closing warning ring. */
function makeMineMesh(): Group {
  const group = new Group();

  const body = new Mesh(new BoxGeometry(0.4, 0.4, 0.4), new MeshBasicMaterial({ color: MINE_BODY }));
  body.name = 'body';
  group.add(body);

  const ring = new Mesh(
    new RingGeometry(0.82, 1, 20),
    new MeshBasicMaterial({ color: WARN_COLOUR, transparent: true, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -Y.mine + Y.warn;
  ring.name = 'ring';
  group.add(ring);

  return group;
}

/** A geyser: a warning ring while arming, a column once it fires. */
function makeGeyserMesh(): Group {
  const group = new Group();

  const warn = new Mesh(
    new RingGeometry(0.6, 1, 20),
    new MeshBasicMaterial({ color: WARN_COLOUR, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  warn.rotation.x = -Math.PI / 2;
  warn.position.y = Y.warn;
  warn.name = 'warn';
  group.add(warn);

  // The geometry is shifted so its *base* sits at the mesh origin. The column
  // is scaled directly rather than through its group (its radius and height are
  // driven independently), and a centre-origin box would have grown downward
  // through the pool floor as much as upward.
  const columnGeometry = new BoxGeometry(1, 1, 1);
  columnGeometry.translate(0, 0.5, 0);
  const column = new Mesh(
    columnGeometry,
    new MeshBasicMaterial({ color: GEYSER_COLUMN, transparent: true, opacity: 0.9 }),
  );
  column.name = 'column';
  group.add(column);

  // Foam capping the column. Deliberately a *sibling* of the shaft, not a
  // child: the shaft is scaled non-uniformly (thin, and several metres tall),
  // and a child would inherit that vertical stretch — the cap became a slab
  // hanging over the pool a metre thick. As a sibling it keeps its own
  // proportions and is simply placed at whatever height the column reached.
  const cap = new Mesh(new BoxGeometry(1, 0.26, 1), new MeshBasicMaterial({ color: '#ffffff' }));
  cap.name = 'cap';
  group.add(cap);

  return group;
}
