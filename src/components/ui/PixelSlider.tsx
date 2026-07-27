import { cn } from '@/lib/cn';

export interface PixelSliderProps {
  /** 0..100 */
  value: number;
  onChange: (value: number) => void;
  label: string;
  /** Rendered at the right of the label row; defaults to the percentage. */
  readout?: string;
  step?: number;
  className?: string;
}

const SEGMENTS = 16;

/**
 * Slider drawn as discrete pixel notches. The native range input stays in the
 * DOM (invisible, full-size) so keyboard and touch behaviour is free.
 */
export function PixelSlider({
  value,
  onChange,
  label,
  readout,
  step = 5,
  className,
}: PixelSliderProps) {
  const filled = Math.round((value / 100) * SEGMENTS);

  return (
    <label className={cn('block', className)}>
      <span className="mb-1 flex items-baseline justify-between text-[10px] tracking-[0.18em] uppercase">
        <span className="text-mist/70">{label}</span>
        <span className="text-surf tabular-nums">{readout ?? `${Math.round(value)}%`}</span>
      </span>
      <span className="relative block has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[6px] has-[:focus-visible]:outline-foam">
        <span
          aria-hidden
          className="bg-abyss pixel-border-thin pixel-bevel-inset flex h-6 w-full gap-[2px] p-[3px]"
        >
          {Array.from({ length: SEGMENTS }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-full flex-1',
                index < filled
                  ? 'bg-surf shadow-[inset_0_2px_0_0_rgb(255_255_255_/_0.4)]'
                  : 'bg-ocean/60',
              )}
            />
          ))}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 outline-none"
        />
      </span>
    </label>
  );
}
