import type { ReactNode } from 'react';
import { PixelIconButton } from './PixelIconButton';
import { cn } from '@/lib/cn';

export interface ScreenFrameProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Rendered at the top-right of the header (currency, tabs, …). */
  aside?: ReactNode;
  /** Sticky bar pinned to the bottom of the screen. */
  footer?: ReactNode;
  onBack?: () => void;
  className?: string;
}

/**
 * Shared chrome for every non-menu screen: back button, title block, scrollable
 * body, optional sticky footer. Keeps headers pixel-aligned across screens.
 */
export function ScreenFrame({
  title,
  subtitle,
  children,
  aside,
  footer,
  onBack,
  className,
}: ScreenFrameProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="stage flex shrink-0 items-center gap-3 pb-2">
        {onBack && (
          <PixelIconButton ariaLabel="Go back" onClick={onBack}>
            {'<'}
          </PixelIconButton>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-pixel-shadow truncate text-lg tracking-[0.2em] uppercase sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="text-mist/60 truncate text-[10px] tracking-[0.12em] sm:text-xs">
              {subtitle}
            </p>
          )}
        </div>
        {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
      </header>

      <div className={cn('min-h-0 flex-1 overflow-y-auto', className)}>
        <div className="stage">{children}</div>
      </div>

      {footer && (
        <div className="bg-abyss/90 border-t-[3px] border-lagoon shrink-0 backdrop-blur-none">
          <div className="stage flex flex-wrap items-center justify-end gap-2">{footer}</div>
        </div>
      )}
    </div>
  );
}
