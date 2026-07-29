import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type Group,
} from 'three';

/**
 * One instanced field of axis-aligned boxes, shared by every ability effect.
 *
 * The effects used to be built from a handful of large `Mesh` primitives — a
 * wave was four stretched boxes — which is why they read as boxes. Detail means
 * *many small pieces*: a breaking wave is a row of crest segments at different
 * heights with a lip curling over them and spray coming off the top, and that
 * is a hundred-odd boxes per wave.
 *
 * A hundred `Mesh` objects per effect would be a hundred draw calls per effect.
 * One `InstancedMesh` is one draw call for every chunk of every effect on
 * screen, which is what makes the detail affordable on a phone. Colour varies
 * per instance, so foam, body water and debris all come from this one field.
 *
 * Opaque on purpose. Alpha would need sorting to look right, and the rest of
 * the arena is flat, hard-edged colour (STYLEGUIDE §3) — a semi-transparent
 * chunk would read as modern 3D next to it.
 */
export class ChunkField {
  readonly mesh: InstancedMesh;

  private index = 0;
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly quaternion = new Quaternion();
  private readonly scale = new Vector3();
  private readonly colour = new Color();
  /** Set once a frame writes any colour, so the buffer only uploads if used. */
  private colourDirty = false;

  constructor(
    parent: Group,
    private readonly capacity: number,
  ) {
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new InstancedMesh(geometry, material, capacity);
    // Rewritten every frame from arbitrary positions, so leave culling to the
    // effects themselves — a bounding sphere computed once would be wrong the
    // moment a wave moved.
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    parent.add(this.mesh);
  }

  begin(): void {
    this.index = 0;
    this.colourDirty = false;
  }

  /**
   * Places one box. `yaw` turns it about the vertical axis, which is all the
   * rotation any of these need — chunks are water, and water has no facing.
   *
   * Silently drops chunks past capacity rather than growing: a frame that
   * wanted more boxes than the budget should lose the last few, not stall to
   * reallocate a GPU buffer mid-fight.
   */
  add(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    colour: string | number,
    yaw = 0,
  ): void {
    if (this.index >= this.capacity) return;
    this.position.set(x, y, z);
    this.quaternion.setFromAxisAngle(UP, yaw);
    this.scale.set(sx, sy, sz);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.mesh.setMatrixAt(this.index, this.matrix);
    this.colour.set(colour as string);
    this.mesh.setColorAt(this.index, this.colour);
    this.colourDirty = true;
    this.index += 1;
  }

  end(): void {
    this.mesh.count = this.index;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.colourDirty && this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.mesh.dispose();
  }
}

const UP = new Vector3(0, 1, 0);

/**
 * Deterministic pseudo-random in 0..1.
 *
 * Chunk jitter has to be stable per chunk across frames — re-rolling it every
 * frame makes a wave boil rather than travel. Seeded by the chunk's own index
 * instead of a running generator so it does not depend on draw order.
 */
export function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Symmetric jitter in -1..1. */
export function hash11(n: number): number {
  return hash01(n) * 2 - 1;
}
