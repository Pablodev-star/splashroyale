import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'gold' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface PixelButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading glyph — kept as text so it stays pixel-crisp. */
  icon?: ReactNode;
  /** Small right-aligned annotation, e.g. a gold cost. */
  aside?: ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Draws attention with a slow glow — one per screen at most. */
  emphasis?: boolean;
  ariaLabel?: string;
  className?: string;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-surf text-abyss hover:bg-foam',
  secondary: 'bg-ocean text-mist hover:bg-lagoon',
  gold: 'bg-gold text-abyss hover:bg-[#ffd579]',
  danger: 'bg-danger text-abyss hover:bg-[#ff7a86]',
  ghost: 'bg-transparent text-mist hover:bg-ocean',
};

const BORDER: Record<ButtonVariant, string> = {
  primary: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-foam)]',
  secondary: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-lagoon)]',
  gold: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-gold-deep)]',
  danger: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-danger-deep)]',
  ghost: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-ocean)]',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-3 py-1.5 text-[10px]',
  md: 'min-h-[44px] px-4 py-2 text-xs',
  lg: 'min-h-[52px] px-5 py-3 text-sm',
};

/**
 * Menu button. Hover lifts it 2px and brightens the top bevel; press drops it
 * 2px on a 2-step timeline so the motion reads as sprite animation, never as a
 * smooth CSS ease (STYLEGUIDE §5). Size never changes — that would break pixel
 * alignment.
 */
export function PixelButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  icon,
  aside,
  disabled = false,
  fullWidth = false,
  emphasis = false,
  ariaLabel,
  className,
}: PixelButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'group relative inline-flex items-center justify-center gap-2',
        'font-bold tracking-[0.16em] uppercase select-none',
        'transition-[transform,background-color] duration-[90ms] ease-[steps(2,jump-none)]',
        'hover:-translate-y-[2px] active:translate-y-[2px]',
        'focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-foam',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0',
        VARIANT[variant],
        BORDER[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {/* Top bevel highlight — brightens on hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-white/25 group-hover:bg-white/60"
      />
      {/* Bottom shade line. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-black/35"
      />
      {emphasis && (
        <span
          aria-hidden
          className="animate-pulse-glow pointer-events-none absolute -inset-[7px] shadow-[0_0_0_2px_var(--color-foam)]"
        />
      )}
      {icon !== undefined && <span className="text-[1.15em] leading-none">{icon}</span>}
      <span className="leading-none">{children}</span>
      {aside !== undefined && (
        <span className="ml-auto pl-2 text-[0.9em] leading-none opacity-80">{aside}</span>
      )}
    </button>
  );
}
