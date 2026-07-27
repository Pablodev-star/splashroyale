import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PixelIconButtonProps {
  /** Glyph or short label. Always pair with `ariaLabel`. */
  children: ReactNode;
  ariaLabel: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

/** Square 44px control used for back arrows, settings gears and tab switches. */
export function PixelIconButton({
  children,
  ariaLabel,
  onClick,
  active = false,
  className,
}: PixelIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center text-base leading-none',
        'transition-transform duration-[90ms] ease-[steps(2,jump-none)]',
        'hover:-translate-y-[2px] active:translate-y-[2px]',
        'focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-foam',
        active ? 'bg-surf text-abyss pixel-border-active' : 'bg-ocean text-mist pixel-border',
        className,
      )}
    >
      {children}
    </button>
  );
}
