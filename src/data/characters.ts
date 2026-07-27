import type { Character } from '@/types/game';

/**
 * PLACEHOLDER(Block 3): stats and ultimates are first-pass balance values.
 *
 * `colors` is no longer only UI trim — Block 2A feeds it to the sprite system as
 * the palette (`primary` = suit, `secondary` = cap), so each character is a
 * recolour of the shared rig. No per-character sprite sheet reference is needed.
 */
export const CHARACTERS: Character[] = [
  {
    id: 'rookie',
    name: 'Rookie',
    title: 'Lane 4 regular',
    stats: { health: 100, speed: 100, power: 100, lungCapacity: 6 },
    ultimate: {
      name: 'Cannonball',
      description: 'Leap up and slam down, knocking every nearby fighter out of the water.',
    },
    colors: { primary: '#34b6d8', secondary: '#ffc247' },
  },
  {
    id: 'lifeguard',
    name: 'Lifeguard',
    title: 'On duty, off script',
    stats: { health: 120, speed: 90, power: 95, lungCapacity: 8 },
    ultimate: {
      name: 'Riptide',
      description: 'Drag everyone in a wide cone toward you, then release a pressure blast.',
    },
    colors: { primary: '#ff4d5e', secondary: '#e8fbff' },
  },
  {
    id: 'diver',
    name: 'Diver',
    title: 'Comes from below',
    stats: { health: 90, speed: 110, power: 105, lungCapacity: 12 },
    ultimate: {
      name: 'Undertow',
      description: 'Stay submerged with no oxygen cost, then surface with a piercing geyser.',
    },
    colors: { primary: '#b463ff', secondary: '#4fd8ff' },
  },
];

export const DEFAULT_CHARACTER = CHARACTERS[0];
