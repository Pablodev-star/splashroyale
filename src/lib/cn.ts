/** Joins class names, dropping falsy values. Keeps JSX readable. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
