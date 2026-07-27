import type { ReactNode } from 'react';
import type { TransitionKind } from '@/types/game';
import { ENTER_MS, EXIT_MS } from '@/state/NavigationContext';
import { cn } from '@/lib/cn';

export interface ScreenTransitionProps {
  children: ReactNode;
  kind: TransitionKind;
  phase: 'idle' | 'exiting';
  className?: string;
}

const ENTER: Record<TransitionKind, string> = {
  fade: 'screen-fade-in',
  slideForward: 'screen-slide-in-left',
  slideBack: 'screen-slide-in-right',
  scale: 'screen-scale-in',
};

const EXIT: Record<TransitionKind, string> = {
  fade: 'screen-fade-out',
  slideForward: 'screen-slide-out-left',
  slideBack: 'screen-slide-out-right',
  scale: 'screen-scale-out',
};

/**
 * Wraps a screen and plays the enter animation on mount / the exit animation
 * while the router is transitioning away. Screens must not animate themselves
 * (STYLEGUIDE §5) — this is the single place mount/unmount motion lives.
 */
export function ScreenTransition({ children, kind, phase, className }: ScreenTransitionProps) {
  const exiting = phase === 'exiting';
  return (
    <div
      className={cn('h-full w-full', className)}
      style={{
        animationName: exiting ? EXIT[kind] : ENTER[kind],
        animationDuration: `${exiting ? EXIT_MS : ENTER_MS}ms`,
        animationTimingFunction: kind === 'scale' ? 'var(--ease-overshoot)' : 'var(--ease-pixel)',
        animationFillMode: 'both',
      }}
    >
      {children}
    </div>
  );
}
