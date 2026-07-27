import type { FighterHudState } from '@/types/game';
import { PixelBar } from '@/components/ui/PixelBar';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { cn } from '@/lib/cn';

export interface NameplateProps {
  fighter: FighterHudState;
  align?: 'left' | 'right';
  className?: string;
}

/**
 * Corner nameplate: identity, health, and — only while submerged — oxygen.
 * Oxygen is deliberately hidden above water so the bar itself signals "you are
 * on the clock" (design doc §5).
 */
export function Nameplate({ fighter, align = 'left', className }: NameplateProps) {
  const lowHealth = fighter.health <= 0.25;

  return (
    <div
      className={cn(
        'bg-deep/85 pixel-border-thin w-[38vw] max-w-[260px] p-1.5 sm:p-2',
        align === 'right' && 'text-right',
        className,
      )}
    >
      <div className={cn('mb-1 flex items-center gap-2', align === 'right' && 'flex-row-reverse')}>
        <span className="truncate text-[11px] font-bold tracking-[0.14em] uppercase">
          {fighter.name}
        </span>
        <PixelBadge tone={align === 'left' ? 'surf' : 'danger'} className="shrink-0">
          {fighter.tag}
        </PixelBadge>
        {fighter.submerged && (
          <span className="text-oxygen shrink-0 text-[9px] tracking-[0.18em]" title="Submerged">
            DIVED
          </span>
        )}
      </div>

      <PixelBar
        value={fighter.health}
        tone={lowHealth ? 'danger' : 'hp'}
        segments={16}
        height="md"
        label="HP"
        readout={`${Math.round(fighter.health * 100)}%`}
        warnBelow={0.2}
      />

      {/* Oxygen only exists on screen while underwater. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-[var(--ease-pixel)]',
          fighter.submerged ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <PixelBar
            value={fighter.oxygen}
            tone="oxygen"
            segments={16}
            height="sm"
            label="Oxygen"
            readout={`${Math.ceil(fighter.oxygen * 100)}%`}
            warnBelow={0.25}
          />
        </div>
      </div>
    </div>
  );
}
