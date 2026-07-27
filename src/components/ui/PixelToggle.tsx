import { cn } from '@/lib/cn';

export interface PixelToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  className?: string;
}

/** Two-state switch: the knob snaps between positions on a 2-step timeline. */
export function PixelToggle({ value, onChange, label, hint, className }: PixelToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        'group flex w-full items-center justify-between gap-4 py-2 text-left',
        'focus-visible:outline-2 focus-visible:outline-offset-[4px] focus-visible:outline-foam',
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-[11px] tracking-[0.14em] uppercase">{label}</span>
        {hint && <span className="text-mist/50 block text-[10px]">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          'pixel-border-thin relative flex h-7 w-14 shrink-0 items-center p-[3px]',
          value ? 'bg-surf' : 'bg-abyss',
        )}
      >
        <span
          className={cn(
            'h-full w-1/2 transition-transform duration-[90ms] ease-[steps(2,jump-none)]',
            value ? 'bg-abyss translate-x-full' : 'bg-ocean translate-x-0',
          )}
        />
      </span>
    </button>
  );
}
