import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type PanelVariant = 'default' | 'raised' | 'sunken' | 'gold' | 'danger';

export interface PixelPanelProps {
  children: ReactNode;
  /** Optional header strip rendered above the body. */
  title?: ReactNode;
  /** Right-aligned content inside the header strip. */
  headerAside?: ReactNode;
  variant?: PanelVariant;
  /** Removes the inner padding for panels that host their own layout. */
  flush?: boolean;
  className?: string;
}

const SURFACE: Record<PanelVariant, string> = {
  default: 'bg-deep pixel-border',
  raised: 'bg-ocean pixel-border',
  sunken: 'bg-abyss pixel-border-thin',
  gold: 'bg-deep pixel-border-gold',
  danger: 'bg-deep shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-danger)]',
};

const HEADER: Record<PanelVariant, string> = {
  default: 'bg-lagoon text-abyss',
  raised: 'bg-lagoon text-abyss',
  sunken: 'bg-ocean text-mist',
  gold: 'bg-gold text-abyss',
  danger: 'bg-danger text-abyss',
};

/**
 * The base surface for every menu: flat fill, chunky stepped border, 2px bevel.
 * No radius, no gradient, no blur (STYLEGUIDE §3).
 */
export function PixelPanel({
  children,
  title,
  headerAside,
  variant = 'default',
  flush = false,
  className,
}: PixelPanelProps) {
  return (
    <div className={cn('relative', SURFACE[variant], className)}>
      {title !== undefined && (
        <div
          className={cn(
            'flex items-center justify-between gap-3 px-3 py-2 text-[11px] font-bold tracking-[0.18em] uppercase',
            HEADER[variant],
          )}
        >
          <span className="truncate">{title}</span>
          {headerAside !== undefined && <span className="shrink-0">{headerAside}</span>}
        </div>
      )}
      <div className={cn('relative', flush ? '' : 'p-3 sm:p-4', 'pixel-bevel')}>{children}</div>
    </div>
  );
}
