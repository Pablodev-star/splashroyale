import { cn } from '@/lib/cn';

export interface PixelInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired on Enter so room codes can be submitted without a <form>. */
  onSubmit?: () => void;
  label?: string;
  placeholder?: string;
  maxLength?: number;
  /** Forces uppercase + wide tracking, for room codes. */
  code?: boolean;
  hint?: string;
  invalid?: boolean;
  className?: string;
}

/**
 * Controlled text input. Deliberately not wrapped in a <form> — the design doc
 * forbids form tags, so submission is an explicit button/Enter handler.
 */
export function PixelInput({
  value,
  onChange,
  onSubmit,
  label,
  placeholder,
  maxLength,
  code = false,
  hint,
  invalid = false,
  className,
}: PixelInputProps) {
  return (
    <label className={cn('block w-full', className)}>
      {label && (
        <span className="mb-1 block text-[9px] tracking-[0.18em] text-mist/70 uppercase">
          {label}
        </span>
      )}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(code ? event.target.value.toUpperCase() : event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onSubmit) onSubmit();
        }}
        className={cn(
          'bg-abyss text-mist placeholder:text-mist/30 w-full px-3 py-3 outline-none',
          'pixel-bevel-inset min-h-[44px]',
          'focus-visible:outline-2 focus-visible:outline-offset-[4px] focus-visible:outline-foam',
          code ? 'text-center text-lg tracking-[0.5em] uppercase' : 'text-sm',
          invalid
            ? 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-danger)]'
            : 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-lagoon)]',
        )}
      />
      {hint && (
        <span
          className={cn(
            'mt-1 block text-[10px] tracking-[0.06em]',
            invalid ? 'text-danger' : 'text-mist/50',
          )}
        >
          {hint}
        </span>
      )}
    </label>
  );
}
