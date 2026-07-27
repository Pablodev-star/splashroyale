import type { MinimapEntity } from '@/types/game';
import { cn } from '@/lib/cn';

export interface MinimapProps {
  entities: MinimapEntity[];
  /** Arena aspect ratio (width / depth) so the map matches the real bounds. */
  aspect?: number;
  className?: string;
}

const DOT: Record<MinimapEntity['kind'], string> = {
  self: 'bg-surf h-[6px] w-[6px]',
  opponent: 'bg-danger h-[6px] w-[6px]',
  projectile: 'bg-foam h-[3px] w-[3px]',
};

/** Optional tactical overlay — toggled in Settings. */
export function Minimap({ entities, aspect = 16 / 9, className }: MinimapProps) {
  return (
    <div
      className={cn('bg-abyss/80 pixel-border-thin relative w-[112px] p-1', className)}
      aria-hidden
    >
      <div className="bg-deep relative w-full" style={{ aspectRatio: aspect }}>
        {/* Pool outline: two-tone pixel border, no radius. */}
        <span className="border-lagoon pointer-events-none absolute inset-0 border-2" />
        {entities.map((entity) => (
          <span
            key={entity.id}
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2',
              DOT[entity.kind],
              entity.submerged && 'opacity-50',
            )}
            style={{
              left: `${Math.max(0, Math.min(1, entity.x)) * 100}%`,
              top: `${Math.max(0, Math.min(1, entity.y)) * 100}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
