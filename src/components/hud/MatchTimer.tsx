import { cn } from '@/lib/cn';

export interface MatchTimerProps {
  remainingMs: number;
  round: { current: number; total: number };
  className?: string;
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Centre-top clock plus round pips. */
export function MatchTimer({ remainingMs, round, className }: MatchTimerProps) {
  const urgent = remainingMs <= 10_000;

  return (
    <div className={cn('bg-deep/85 pixel-border-thin px-3 py-1 text-center', className)}>
      <div
        className={cn(
          'text-pixel-shadow-sm text-xl leading-none font-bold tabular-nums',
          urgent ? 'text-danger animate-blink' : 'text-mist',
        )}
      >
        {formatClock(remainingMs)}
      </div>
      <div className="mt-1 flex items-center justify-center gap-1">
        {Array.from({ length: round.total }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-[6px] w-[10px]',
              index < round.current - 1
                ? 'bg-gold'
                : index === round.current - 1
                  ? 'bg-surf'
                  : 'bg-ocean',
            )}
          />
        ))}
      </div>
    </div>
  );
}
