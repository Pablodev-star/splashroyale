import { ArenaScene } from '@/game/scene/ArenaScene';
import type { SceneEffects } from '@/game/scene/effects';
import { MAPS } from '@/data/maps';

/**
 * Development harness for the ability effect layer (Block 7B).
 *
 * Charging an ultimate honestly takes fifty seconds, so driving these through
 * real gameplay is not a practical way to look at them. This mounts a real
 * `ArenaScene` and feeds it hand-written effect state, which is exactly what
 * the match screen does — only the numbers come from here instead of the
 * engine. Served by `vite dev` at /vfx-harness.html; not part of the build.
 *
 * `?case=poison` etc. selects one; the default cycles through all of them.
 */

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const scene = new ArenaScene(canvas, { map: MAPS[0], pixelSize: 2 });

function empty(): SceneEffects {
  return { zones: [], waves: [], beams: [], mines: [], geysers: [] };
}

const CASES: Record<string, (t: number) => SceneEffects> = {
  poison: (t) => ({
    ...empty(),
    zones: [
      {
        id: 'z1',
        flavour: 'poison',
        x: 0.5,
        y: 0.55,
        radius: 0.14,
        progress: (t * 0.2) % 1,
        mine: true,
      },
    ],
  }),
  chlorine: (t) => ({
    ...empty(),
    zones: [
      {
        id: 'z2',
        flavour: 'chlorine',
        x: 0.5,
        y: 0.55,
        radius: 0.17,
        progress: (t * 0.2) % 1,
        mine: false,
      },
    ],
  }),
  whirlpool: (t) => ({
    ...empty(),
    zones: [
      {
        id: 'z3',
        flavour: 'whirlpool',
        x: 0.5,
        y: 0.55,
        radius: 0.16,
        progress: (t * 0.25) % 1,
        mine: true,
      },
    ],
  }),
  wave: (t) => ({
    ...empty(),
    waves: [
      {
        id: 'w1',
        x: 0.5,
        y: 0.35 + ((t * 0.22) % 0.5),
        angle: Math.PI / 2,
        width: 0.22,
        progress: (t * 0.35) % 1,
        mine: true,
      },
    ],
  }),
  beam: (t) => ({
    ...empty(),
    beams: [
      {
        id: 'b1',
        x: 0.5,
        y: 0.28,
        angle: Math.PI / 2,
        length: 0.55,
        width: 0.045,
        progress: (t * 0.5) % 1,
        mine: true,
      },
    ],
  }),
  mine: (t) => ({
    ...empty(),
    mines: [
      { id: 'm1', x: 0.5, y: 0.6, radius: 0.16, progress: (t * 0.5) % 1, mine: false },
    ],
  }),
  geysers: (t) => {
    const phase = (t * 0.5) % 1;
    return {
      ...empty(),
      geysers: [0, 1, 2, 3].map((i) => {
        const local = (phase + i * 0.18) % 1;
        return {
          id: `g${i}`,
          x: 0.34 + i * 0.11,
          y: 0.5 + (i % 2) * 0.12,
          radius: 0.12,
          erupting: local > 0.6,
          progress: local > 0.6 ? (local - 0.6) / 0.4 : local / 0.6,
          mine: i % 2 === 0,
        };
      }),
    };
  },
};

// Ownership check: the same effect cast by each side, side by side. Added
// after a review caught that the wave and beam rewrites had dropped the
// owner tint entirely — a regression a single-effect screenshot cannot show.
CASES.owners = (t) => ({
  ...empty(),
  waves: [
    { id: 'wa', x: 0.3, y: 0.62 + ((t * 0.1) % 0.2), angle: Math.PI / 2, width: 0.11, progress: (t * 0.3) % 1, mine: true },
    { id: 'wb', x: 0.7, y: 0.62 + ((t * 0.1) % 0.2), angle: Math.PI / 2, width: 0.11, progress: (t * 0.3) % 1, mine: false },
  ],
  // Near the camera and large, because the zone cue is a ring of small accent
  // blocks: at thumbnail distance it is invisible either way, which defeats
  // the point of a comparison shot.
  zones: [
    { id: 'za', flavour: 'poison', x: 0.3, y: 0.3, radius: 0.16, progress: 0.2, mine: true },
    { id: 'zb', flavour: 'poison', x: 0.7, y: 0.3, radius: 0.16, progress: 0.2, mine: false },
  ],
});

const requested = new URLSearchParams(location.search).get('case');
const names = requested && CASES[requested] ? [requested] : Object.keys(CASES);

function resize() {
  scene.resize(window.innerWidth, window.innerHeight);
}
resize();
window.addEventListener('resize', resize);

// A fixed camera angle looking down the arena, so every capture is comparable.
scene.setYaw(0);

let last = performance.now();
let clock = 0;

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;

  // Cycle when showing everything; hold when a single case was asked for.
  const index = names.length === 1 ? 0 : Math.floor(clock / 3) % names.length;
  scene.setEffects(CASES[names[index]](clock));
  scene.render(dt, []);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Lets the screenshot script wait for a specific case and a settled frame.
(window as unknown as { __VFX__: unknown }).__VFX__ = {
  show(name: string, t: number) {
    scene.setEffects(CASES[name](t));
    scene.render(1 / 60, []);
  },
  cases: Object.keys(CASES),
};
