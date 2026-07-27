import { cn } from '@/lib/cn';

export interface PixelSliderProps {
  /** 0..100 */
  value: number;
  onChange: (value: number) => void;
  label: string;
  /** Rendered at the right of the label row; defaults to the percentage. */
  readout?: string;
  step?: number;
  /** Accent colour of the filled notches. */
  tone?: 'surf' | 'gold' | 'hp';
  className?: string;
}

const FILL = {
  surf: 'bg-surf',
  gold: 'bg-gold',
  hp: 'bg-hp',
} as const;

/**
 * Slider drawn as discrete pixel notches. The native range input stays in the
 * DOM (invisible, full-size) so keyboard and touch behaviour is free.
 *
 * The notch count is derived from `step` so one step of the input is always
 * exactly one notch. Hard-coding both independently made a single step land on
 * a fractional notch, so the bar appeared to skip or stall while dragging.
 */
export function PixelSlider({
  value,
  onChange,
  label,
  readout,
  step = 5,
  tone = 'surf',
  className,
}: PixelSliderProps) {
  const segments = Math.max(1, Math.round(100 / step));
  const filled = Math.round(value / step);

  return (
    <label className={cn('group block', className)}>
      <span className="mb-1 flex items-baseline justify-between text-[10px] tracking-[0.18em] uppercase">
        <span className="text-mist/70 group-hover:text-mist transition-colors">{label}</span>
        <span className="text-surf tabular-nums">{readout ?? `${Math.round(value)}%`}</span>
      </span>

      <span className="has-[:focus-visible]:outline-foam relative block has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[6px]">
        <span
          aria-hidden
          className="bg-abyss pixel-border-thin pixel-bevel-inset flex h-6 w-full gap-[2px] p-[3px]"
        >
          {Array.from({ length: segments }, (_, index) => {
            const isFilled = index < filled;
            const isTip = index === filled - 1;
            return (
              <span
                key={index}
                className={cn(
                  'h-full flex-1 transition-colors duration-100',
                  isFilled
                    ? cn(FILL[tone], 'shadow-[inset_0_2px_0_0_rgb(255_255_255_/_0.4)]')
                    : 'bg-ocean/60 group-hover:bg-ocean',
                  // The leading notch reads as the "handle".
                  isTip && 'bg-foam',
                )}
              />
            );
          })}
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
