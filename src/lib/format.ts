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

/** Six-character room code, unambiguous alphabet (no O/0/I/1). */
export function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/** True when a typed room code has the right shape. */
export function isValidRoomCode(code: string): boolean {
  return /^[A-Z2-9]{6}$/.test(code.trim().toUpperCase());
}
