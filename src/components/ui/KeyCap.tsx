import { cn } from '@/lib/cn';

export interface KeyCapProps {
  children: string;
  /** Dims the cap while the bound ability is recharging. */
  muted?: boolean;
  className?: string;
}

/**
 * A key drawn as a key.
 *
 * Ability rows previously carried a slot glyph — the same `≈` for every
 * attack-1 card — which told a keyboard player nothing about what to press.
 * A bevelled cap reads as "press this" without a legend, and shares the
 * pixel-bevel language the buttons already use (STYLEGUIDE §2).
 */
export function KeyCap({ children, muted = false, className }: KeyCapProps) {
  return (
    <kbd
      className={cn(
        'pixel-bevel inline-flex h-[15px] shrink-0 items-center justify-center px-1',
        'font-mono text-[8px] leading-none font-bold tracking-[0.04em] uppercase',
        muted ? 'bg-ocean/50 text-mist/40' : 'bg-ocean text-foam',
        // Space is the widest cap; a min-width keeps single letters from
        // collapsing to a sliver next to it in the same column.
        children.length > 1 ? 'min-w-[30px]' : 'min-w-[15px]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
