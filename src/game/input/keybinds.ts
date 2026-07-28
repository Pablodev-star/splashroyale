import type { AbilitySlot } from '@/types/game';

/**
 * The keyboard map, in one place.
 *
 * The match screen used to test `event.code` inline while a hint line at the
 * bottom of the screen spelled the same keys out as literal text. Two copies
 * of one fact: rebinding or adding an action meant editing both, and nothing
 * failed if you edited one. Everything that presses a key or draws a key now
 * reads this table.
 *
 * `codes` is a list because several physical keys can mean one action (either
 * Shift, WASD or the arrows), while `cap` is the single glyph to print on a
 * keycap — the shortest thing a player can recognise mid-fight.
 */
export interface Keybind {
  /** `KeyboardEvent.code` values that trigger this action. */
  codes: string[];
  /** What to print on the keycap. */
  cap: string;
}

export type ActionId = 'attack1' | 'attack2' | 'ultimate' | 'dive' | 'pause';

export const KEYBINDS: Record<ActionId, Keybind> = {
  attack1: { codes: ['Space'], cap: 'Space' },
  attack2: { codes: ['KeyE'], cap: 'E' },
  ultimate: { codes: ['KeyQ'], cap: 'Q' },
  dive: { codes: ['ShiftLeft', 'ShiftRight'], cap: 'Shift' },
  pause: { codes: ['Escape'], cap: 'Esc' },
};

/** The keycap for an ability slot — what the HUD stamps on each ability row. */
export const SLOT_CAP: Record<AbilitySlot, string> = {
  attack1: KEYBINDS.attack1.cap,
  attack2: KEYBINDS.attack2.cap,
  ultimate: KEYBINDS.ultimate.cap,
};

/** Movement, kept separate: it is an axis, not a one-shot action. */
export const MOVE_CODES = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
} as const;

export type MoveAxis = keyof typeof MOVE_CODES;

/** Which movement axis a key drives, or null. */
export function moveAxisFor(code: string): MoveAxis | null {
  for (const axis of Object.keys(MOVE_CODES) as MoveAxis[]) {
    if ((MOVE_CODES[axis] as readonly string[]).includes(code)) return axis;
  }
  return null;
}

/** True when `code` is bound to `action`. */
export function isBound(action: ActionId, code: string): boolean {
  return KEYBINDS[action].codes.includes(code);
}
