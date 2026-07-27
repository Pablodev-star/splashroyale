/**
 * Thin-space thousands separator (STYLEGUIDE §8) — deliberately not
 * locale-dependent, so the same string ships everywhere.
 */
export function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** mm:ss from milliseconds. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Room code alphabet: unambiguous when read aloud or off a screen — no O/0 and
 * no I/1. Generation and validation share it so they can never drift apart.
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

/** Six-character room code drawn from {@link ROOM_CODE_ALPHABET}. */
export function generateRoomCode(): string {
  let code = '';
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Normalises a typed room code: trimmed, uppercase, unsupported chars dropped. */
export function normaliseRoomCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => ROOM_CODE_ALPHABET.includes(character))
    .join('')
    .slice(0, ROOM_CODE_LENGTH);
}

/** True when a typed code could have been produced by {@link generateRoomCode}. */
export function isValidRoomCode(code: string): boolean {
  const normalised = code.trim().toUpperCase();
  return (
    normalised.length === ROOM_CODE_LENGTH &&
    normalised.split('').every((character) => ROOM_CODE_ALPHABET.includes(character))
  );
}
