import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { SPLASH_TIERS, type SplashTier } from '@/game/vfx';
import { ANIMATIONS, type AnimationId, type SpritePalette } from '@/game/sprites';
import { renderWater, RIPPLE_LIFE, type Ripple } from '@/components/water/renderWater';
import type { GameMap } from '@/types/game';
import { orientationFor } from './orientation';
import { createSpriteTexture, type SpriteFrameTexture } from './spriteTexture';
import { buildScenery, type Scenery } from './scenery';
import { EffectLayer, EMPTY_EFFECTS, type SceneEffects } from './effects';

/**
 * The 3D arena (Block 3A).
 *
 * Deliberately framework-free — no React in here. It owns a Three.js scene and
 * is driven imperatively, so the render loop never waits on a re-render and
 * fighters can be updated 60 times a second without touching component state.
 *
 * Three things carry over from Blocks 2A–2C rather than being rebuilt for 3D:
 * the sprite atlas becomes the billboard texture, the pixel water renderer
 * becomes the surface texture (ripples, wakes and all), and the palettes stay
 * the single source of colour. The move to 3D changes the *camera*, not the art.
 */

/**
 * Pool size in world units. Fighters arrive in 0..1 and are mapped onto this,
 * so this also sets how far apart two fighters can get. Sized against the 2.3u
 * sprite height: much larger and the fighters read as specks in an ocean.
 */
const ARENA_SIZE = 16;

/**
 * Water texture resolution. Square, so a ripple is round on the plane.
 *
 * This is the cost that matters: `pixelSize` shrinks the *WebGL* buffer, but
 * the water is a CPU-painted `ImageData` whose cost is this number squared,
 * repainted at `WATER_FPS` on the main thread regardless of how large the canvas
 * ends up on screen. A thumbnail rendering at 192 is doing the same 37k pixel
 * iterations per repaint as the full-screen match — three of them side by side
 * on the map picker cost more than the match itself.
 */
const WATER_TEXTURE_SIZE = 192;

/**
 * The water texture repaints at this rate while the scene renders at display
 * rate. Repainting 37k pixels every frame would blow the §6 budget for no
 * visible gain — the waves are far slower than 60fps.
 */
const WATER_FPS = 24;

/** Sprite billboard height in world units, and the rig's waterline row. */
const SPRITE_HEIGHT = 2.3;
const SPRITE_ASPECT = 28 / 44;
/**
 * Which rig row lands on the water plane. The foam line occupies rows 24-26, so
 * anchoring at 27 leaves those three rows just above the surface: the sprite's
 * own painted waterline stays visible instead of being swallowed by the opaque
 * water plane, which is what made the fighters read as busts cut off at the
 * chest. Everything below is genuinely underwater and correctly hidden.
 */
const SPRITE_WATERLINE = 27 / 44;

/**
 * Splash droplets in 3D.
 *
 * The Block 2C tier table stays the source of truth for how big a splash is —
 * only the units change, from the 2D buffer's pixels to world metres. Rendering
 * them as a 2D overlay would have put them wherever the old flat projection
 * said, which no longer lines up with where a fighter actually appears once a
 * real camera can orbit.
 */
const SPLASH_SPEED_SCALE = 0.07;
const SPLASH_GRAVITY = 12;
const MAX_SCENE_DROPLETS = 400;

/**
 * Projectiles in flight. Drawn as chunky points riding above the surface: the
 * 2D arena drew them and the first 3D pass dropped them, which left attacks
 * with no visible representation at all on mobile, where the minimap is hidden.
 */
const MAX_PROJECTILES = 32;
const PROJECTILE_HEIGHT = 0.85;

/**
 * Third-person framing. Close and low enough that a fighter fills a useful part
 * of the screen — the first pass sat far back and high, which read as a map
 * preview rather than a character you control.
 */
const CAMERA_DISTANCE = 7;
const CAMERA_HEIGHT = 3.2;
const CAMERA_LOOK_HEIGHT = 0.9;

/**
 * Other fighters closer to the camera than this are not drawn.
 *
 * The camera sits seven units behind the player, so an opponent circling around
 * the player's back walks straight through it. Before Block 3C gave the bot real
 * movement nothing ever went there; now it does, and a billboard a metre from
 * the lens fills the screen with a smear of magnified pixels that hides the
 * whole fight. Culling is the right tool rather than fading: a semi-transparent
 * sprite is off-palette (STYLEGUIDE §3), and by the time a fighter is this close
 * they are an unreadable wall anyway. The minimap and their nameplate still
 * track them, so nothing is actually lost.
 */
const CAMERA_CULL_DISTANCE = 2.4;

/** A projectile in flight, in the same normalised arena space as fighters. */
export interface SceneProjectile {
  id: string;
  x: number;
  y: number;
}

export interface SceneFighter {
  id: string;
  /** Normalised arena position, 0..1 — the same space the 2D arena used. */
  x: number;
  y: number;
  /**
   * Facing as a world angle in the XZ plane. `undefined` for the local player,
   * whose facing is always the camera's forward direction.
   */
  facing?: number;
  animation: AnimationId;
  submerged: boolean;
  isSelf: boolean;
  palette: SpritePalette;
}

interface FighterNode {
  mesh: Mesh;
  material: MeshBasicMaterial;
  sprite: SpriteFrameTexture;
  animation: AnimationId;
  elapsedMs: number;
  frame: number;
}

export interface ArenaSceneOptions {
  map: GameMap;
  /** CSS pixels per rendered pixel. Larger = chunkier and cheaper. */
  pixelSize?: number;
  /**
   * Water texture edge, in texels. Defaults to the full-match resolution;
   * thumbnails pass something far smaller, since the cost is quadratic in this
   * and has nothing to do with how big the canvas is.
   */
  waterSize?: number;
  /** Water repaints per second. Lower for previews, where nobody is looking. */
  waterFps?: number;
}

export class ArenaScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly fighters = new Map<string, FighterNode>();

  private readonly waterCanvas: HTMLCanvasElement;
  private readonly waterImage: ImageData;
  private readonly waterTexture: CanvasTexture;
  private readonly ripples: Ripple[] = [];
  private waterClock = 0;
  private waterAccumulator = 0;

  private readonly map: GameMap;
  private readonly pixelSize: number;
  private readonly waterSize: number;
  private readonly waterFps: number;
  private readonly scenery: Scenery;

  /** Camera azimuth. The player's facing is derived from this, never stored. */
  private yaw = 0;
  private playerX = 0;
  private playerZ = 0;

  // Droplets live in flat arrays rather than objects: they are rewritten into a
  // GPU buffer every frame, and per-droplet objects would mean re-boxing 400
  // vectors each time.
  private readonly droplets = {
    position: new Float32Array(MAX_SCENE_DROPLETS * 3),
    velocity: new Float32Array(MAX_SCENE_DROPLETS * 3),
    age: new Float32Array(MAX_SCENE_DROPLETS),
    life: new Float32Array(MAX_SCENE_DROPLETS),
    count: 0,
  };
  private readonly dropletPoints: Points;
  private readonly dropletGeometry = new BufferGeometry();

  private readonly projectileGeometry = new BufferGeometry();
  private readonly projectilePositions = new Float32Array(MAX_PROJECTILES * 3);
  private readonly projectilePoints: Points;

  /** Zones, waves, beams, mines and geysers (Block 7B). */
  private readonly effectLayer = new EffectLayer(ARENA_SIZE);
  private effects: SceneEffects = EMPTY_EFFECTS;

  constructor(
    canvas: HTMLCanvasElement,
    { map, pixelSize = 3, waterSize = WATER_TEXTURE_SIZE, waterFps = WATER_FPS }: ArenaSceneOptions,
  ) {
    this.map = map;
    this.pixelSize = pixelSize;
    this.waterSize = Math.max(16, Math.floor(waterSize));
    this.waterFps = Math.max(1, waterFps);

    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false });
    // Render below display resolution and let CSS upscale with
    // `image-rendering: pixelated`, exactly like the 2D canvases. Antialiasing
    // is off for the same reason: smooth edges would fight the pixel art.
    this.renderer.setPixelRatio(1);

    this.camera = new PerspectiveCamera(55, 1, 0.1, 200);

    // --- Water surface -----------------------------------------------------
    this.waterCanvas = document.createElement('canvas');
    this.waterCanvas.width = this.waterSize;
    this.waterCanvas.height = this.waterSize;
    const context = this.waterCanvas.getContext('2d');
    if (!context) throw new Error('ArenaScene: 2D context unavailable for the water texture');
    this.waterImage = context.createImageData(this.waterSize, this.waterSize);

    this.waterTexture = new CanvasTexture(this.waterCanvas);
    this.waterTexture.magFilter = NearestFilter;
    this.waterTexture.minFilter = NearestFilter;
    this.waterTexture.generateMipmaps = false;
    // Same reason as the sprite atlas: these are sRGB palette colours, and an
    // untagged texture gets double-converted and washes out.
    this.waterTexture.colorSpace = SRGBColorSpace;

    const water = new Mesh(
      new PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
      new MeshBasicMaterial({ map: this.waterTexture }),
    );
    water.rotation.x = -Math.PI / 2;
    this.scene.add(water);

    // --- Surroundings -------------------------------------------------------
    // The map's own place: deck and lane ropes, or a shore with parasols, or a
    // reef with palms and a jetty. Replaces the single flat coloured square that
    // made every map the same scene in a different colour, and gives the water
    // an edge instead of letting it stop in mid-air (see `scenery.ts`).
    this.scenery = buildScenery(map);
    this.scene.add(this.scenery.root);
    this.scene.background = this.scenery.sky;

    // --- Splash droplets -----------------------------------------------------
    this.dropletGeometry.setAttribute(
      'position',
      new BufferAttribute(this.droplets.position, 3).setUsage(35048 /* DynamicDrawUsage */),
    );
    this.dropletGeometry.setDrawRange(0, 0);
    this.dropletPoints = new Points(
      this.dropletGeometry,
      new PointsMaterial({
        color: new Color(map.palette.crest),
        size: 0.16,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    // Bounds change every frame and the droplets are always near the camera;
    // culling them would cost a bounding-sphere recompute for nothing.
    this.dropletPoints.frustumCulled = false;
    this.scene.add(this.dropletPoints);

    // --- Projectiles ---------------------------------------------------------
    this.projectileGeometry.setAttribute(
      'position',
      new BufferAttribute(this.projectilePositions, 3).setUsage(35048 /* DynamicDrawUsage */),
    );
    this.projectileGeometry.setDrawRange(0, 0);
    this.projectilePoints = new Points(
      this.projectileGeometry,
      new PointsMaterial({
        color: new Color(map.palette.crest),
        size: 0.42,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.projectilePoints.frustumCulled = false;
    this.scene.add(this.projectilePoints);
    this.scene.add(this.effectLayer.group);

    this.paintWater(0);
  }

  /** Places the projectiles for this frame. */
  setProjectiles(list: SceneProjectile[]): void {
    const count = Math.min(list.length, MAX_PROJECTILES);
    for (let i = 0; i < count; i += 1) {
      const { x, z } = this.toWorld(list[i].x, list[i].y);
      this.projectilePositions[i * 3] = x;
      this.projectilePositions[i * 3 + 1] = PROJECTILE_HEIGHT;
      this.projectilePositions[i * 3 + 2] = z;
    }
    this.projectileGeometry.setDrawRange(0, count);
    this.projectileGeometry.attributes.position.needsUpdate = true;
  }

  /**
   * Hands the frame's lingering effects to the effect layer.
   *
   * Stored rather than applied here: the layer animates (spin, flicker, the
   * geyser's rise) and so needs the frame delta, which only `render` has.
   */
  setEffects(effects: SceneEffects): void {
    this.effects = effects;
  }

  /**
   * Throws a splash at normalised arena coordinates, sized by the Block 2C tier.
   */
  splash(nx: number, ny: number, tier: SplashTier): void {
    const spec = SPLASH_TIERS[tier];
    const { x, z } = this.toWorld(nx, ny);
    const d = this.droplets;
    const count = Math.min(spec.droplets, MAX_SCENE_DROPLETS - d.count);

    for (let i = 0; i < count; i += 1) {
      const index = d.count;
      // Thrown in a cone around vertical: a full sphere reads as an explosion,
      // the same reason the 2D burst used an upward fan.
      const azimuth = Math.random() * Math.PI * 2;
      const spread = Math.random() * spec.spread;
      const speed = spec.speed * SPLASH_SPEED_SCALE * (0.45 + Math.random() * 0.55);

      d.position[index * 3] = x;
      d.position[index * 3 + 1] = 0.05;
      d.position[index * 3 + 2] = z;
      d.velocity[index * 3] = Math.cos(azimuth) * spread * speed;
      d.velocity[index * 3 + 1] = speed;
      d.velocity[index * 3 + 2] = Math.sin(azimuth) * spread * speed;
      d.age[index] = 0;
      d.life[index] = spec.life * (0.6 + Math.random() * 0.4);
      d.count += 1;
    }
  }

  private updateDroplets(dt: number): void {
    const d = this.droplets;
    if (d.count === 0) {
      this.dropletGeometry.setDrawRange(0, 0);
      return;
    }

    let write = 0;
    for (let read = 0; read < d.count; read += 1) {
      const age = d.age[read] + dt;
      const vy = d.velocity[read * 3 + 1] - SPLASH_GRAVITY * dt;
      const y = d.position[read * 3 + 1] + vy * dt;

      // Dies on expiry or on falling back through the surface it came from.
      if (age >= d.life[read] || (vy < 0 && y <= 0)) continue;

      const x = d.position[read * 3] + d.velocity[read * 3] * dt;
      const z = d.position[read * 3 + 2] + d.velocity[read * 3 + 2] * dt;

      d.position[write * 3] = x;
      d.position[write * 3 + 1] = y;
      d.position[write * 3 + 2] = z;
      d.velocity[write * 3] = d.velocity[read * 3];
      d.velocity[write * 3 + 1] = vy;
      d.velocity[write * 3 + 2] = d.velocity[read * 3 + 2];
      d.age[write] = age;
      d.life[write] = d.life[read];
      write += 1;
    }

    d.count = write;
    this.dropletGeometry.setDrawRange(0, d.count);
    this.dropletGeometry.attributes.position.needsUpdate = true;
  }

  /** Maps normalised arena coordinates (0..1) onto world XZ. */
  private toWorld(nx: number, ny: number): { x: number; z: number } {
    return { x: (nx - 0.5) * ARENA_SIZE, z: (ny - 0.5) * ARENA_SIZE };
  }

  /**
   * Spawns a surface ripple at normalised arena coordinates.
   *
   * In 3D these are the *same* 0..1 coordinates fighters use, because the water
   * plane spans exactly the arena. The 2D arena needed its actor coordinates
   * rebased onto a taller canvas first (the `WATER_TOP` offset); that whole
   * class of mismatch disappears here.
   */
  spawnRipple(nx: number, ny: number, strength = 0.6): void {
    this.ripples.push({
      x: nx * this.waterSize,
      y: ny * this.waterSize,
      bornAt: this.waterClock,
      strength: Math.max(0.1, Math.min(1, strength)),
    });
  }

  setYaw(yaw: number): void {
    this.yaw = yaw;
  }

  getYaw(): number {
    return this.yaw;
  }

  setFighters(list: SceneFighter[]): void {
    const seen = new Set<string>();

    for (const fighter of list) {
      seen.add(fighter.id);
      let node = this.fighters.get(fighter.id);

      if (!node) {
        const sprite = createSpriteTexture(fighter.palette);
        const material = new MeshBasicMaterial({
          map: sprite.texture,
          transparent: true,
          // Cut fully transparent texels rather than blending them: blended
          // edges would grey-fringe the sprite against the water.
          alphaTest: 0.5,
          side: DoubleSide,
        });
        const mesh = new Mesh(
          new PlaneGeometry(SPRITE_HEIGHT * SPRITE_ASPECT, SPRITE_HEIGHT),
          material,
        );
        this.scene.add(mesh);
        node = { mesh, material, sprite, animation: fighter.animation, elapsedMs: 0, frame: 0 };
        this.fighters.set(fighter.id, node);
      }

      if (node.animation !== fighter.animation) {
        node.animation = fighter.animation;
        node.elapsedMs = 0;
        node.frame = 0;
      }

      const { x, z } = this.toWorld(fighter.x, fighter.y);
      // Lift so the rig's foam row sits exactly on the water plane.
      node.mesh.position.set(x, SPRITE_HEIGHT * (SPRITE_WATERLINE - 0.5), z);

      if (fighter.isSelf) {
        this.playerX = x;
        this.playerZ = z;
      }
    }

    for (const [id, node] of this.fighters) {
      if (seen.has(id)) continue;
      this.scene.remove(node.mesh);
      node.mesh.geometry.dispose();
      node.material.dispose();
      node.sprite.dispose();
      this.fighters.delete(id);
    }
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width / this.pixelSize));
    const h = Math.max(1, Math.floor(height / this.pixelSize));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /** Advances animation + water and draws one frame. `dt` is in seconds. */
  render(dt: number, fighters: SceneFighter[]): void {
    this.updateCamera();
    this.updateWater(dt);
    this.updateDroplets(dt);
    this.effectLayer.update(this.effects, dt);
    this.updateFighters(dt, fighters);
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(): void {
    // The player faces where the camera looks, so the camera sits directly
    // behind them: dragging the view turns the fighter with it, and their back
    // is what you see.
    const forwardX = Math.sin(this.yaw);
    const forwardZ = Math.cos(this.yaw);

    this.camera.position.set(
      this.playerX - forwardX * CAMERA_DISTANCE,
      CAMERA_HEIGHT,
      this.playerZ - forwardZ * CAMERA_DISTANCE,
    );
    this.camera.lookAt(this.playerX, CAMERA_LOOK_HEIGHT, this.playerZ);
  }

  private updateWater(dt: number): void {
    this.waterClock += dt;
    this.waterAccumulator += dt;
    if (this.waterAccumulator < 1 / this.waterFps) return;
    this.waterAccumulator = 0;

    // Drop dead ripples so the array cannot grow without bound.
    if (this.ripples.length > 0) {
      const cutoff = this.waterClock - RIPPLE_LIFE * 1.2;
      let write = 0;
      for (let i = 0; i < this.ripples.length; i += 1) {
        if (this.ripples[i].bornAt >= cutoff) this.ripples[write++] = this.ripples[i];
      }
      this.ripples.length = write;
    }

    this.paintWater(this.waterClock);
  }

  private paintWater(time: number): void {
    renderWater(this.waterImage, {
      width: this.waterSize,
      height: this.waterSize,
      time,
      variant: 'surface',
      palette: this.map.palette,
      surface: this.map.surface,
      ripples: this.ripples,
    });
    this.waterCanvas.getContext('2d')?.putImageData(this.waterImage, 0, 0);
    this.waterTexture.needsUpdate = true;
  }

  private updateFighters(dt: number, list: SceneFighter[]): void {
    for (const fighter of list) {
      const node = this.fighters.get(fighter.id);
      if (!node) continue;

      // --- Frame advance (same timing data as the 2D playback hook) ---------
      const spec = ANIMATIONS[node.animation];
      const total = spec.frames.reduce((sum, f) => sum + f.durationMs, 0);
      node.elapsedMs += dt * 1000;
      let position = node.elapsedMs;
      if (spec.loop) {
        position %= total;
      } else if (position >= total) {
        position = total - 0.001; // Hold the final frame.
      }
      let index = 0;
      let cursor = 0;
      for (let i = 0; i < spec.frames.length; i += 1) {
        cursor += spec.frames[i].durationMs;
        index = i;
        if (position < cursor) break;
      }
      node.frame = index;

      // --- Orientation relative to the camera --------------------------------
      const dxCamera = node.mesh.position.x - this.camera.position.x;
      const dzCamera = node.mesh.position.z - this.camera.position.z;
      // The local player is pinned at the camera's own distance, so this only
      // ever culls someone who has walked between you and the lens.
      node.mesh.visible =
        fighter.isSelf || Math.hypot(dxCamera, dzCamera) > CAMERA_CULL_DISTANCE;

      const toFighter = Math.atan2(dzCamera, dxCamera);
      // The local player is pinned to the camera's forward direction, so they
      // are always seen from behind — no need to derive it.
      const facing = fighter.isSelf
        ? toFighter
        : (fighter.facing ?? 0);
      node.sprite.setFrame(orientationFor(facing, toFighter), node.animation, node.frame);

      // --- Billboard ---------------------------------------------------------
      // Yaw only. Copying the camera's full rotation would tip the sprites back
      // as the camera looks down, and swimmers must stay upright.
      node.mesh.rotation.y = Math.atan2(
        this.camera.position.x - node.mesh.position.x,
        this.camera.position.z - node.mesh.position.z,
      );
    }
  }

  dispose(): void {
    this.scene.remove(this.scenery.root);
    this.scenery.dispose();
    this.scene.remove(this.effectLayer.group);
    this.effectLayer.dispose();
    for (const node of this.fighters.values()) {
      this.scene.remove(node.mesh);
      node.mesh.geometry.dispose();
      node.material.dispose();
      node.sprite.dispose();
    }
    this.fighters.clear();

    // Points as well as Mesh: the droplet and projectile clouds are `Points`,
    // and a Mesh-only traversal leaked their buffers on every map change.
    this.scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof Points) {
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      }
    });

    this.waterTexture.dispose();
    this.renderer.dispose();
  }
}

export { ARENA_SIZE };
