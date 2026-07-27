import { useRef, type ReactNode } from 'react';
import type { GameMap, MinimapEntity } from '@/types/game';
import { WaterCanvas, type WaterCanvasHandle } from '@/components/water/WaterCanvas';
import { FighterBillboard, type Facing } from './FighterBillboard';
import { CHARACTERS } from '@/data/characters';
import { cn } from '@/lib/cn';

export interface ArenaFighter {
  id: string;
  x: number;
  y: number;
  facing: Facing;
  submerged: boolean;
  label?: string;
  colors: { primary: string; secondary: string };
}

export interface ArenaViewProps {
  map: GameMap;
  fighters: ArenaFighter[];
  /** Projectiles in flight, drawn as large pixels. */
  projectiles?: MinimapEntity[];
  children?: ReactNode;
  className?: string;
}

/**
 * PLACEHOLDER(Block 3): the arena stage.
 *
 * Block 1 needs something behind the HUD that reads as the real game: a
 * palette-correct pool rendered by the pixel water canvas with billboard sprites
 * standing in it. Block 3 replaces the contents with the Three.js scene and
 * drives positions from the physics step; the framing and the HUD slot stay.
 */
export function ArenaView({
  map,
  fighters,
  projectiles = [],
  children,
  className,
}: ArenaViewProps) {
  const waterRef = useRef<WaterCanvasHandle | null>(null);

  return (
    <div className={cn('bg-abyss relative h-full w-full overflow-hidden', className)}>
      <WaterCanvas
        ref={waterRef}
        map={map}
        variant="arena"
        pixelSize={5}
        fps={24}
        className="absolute inset-0"
      />

      {/* Fighters live in the lower 78% of the frame — the water body. */}
      <div className="absolute inset-x-0 top-[22%] bottom-0">
        {fighters.map((fighter) => (
          <FighterBillboard
            key={fighter.id}
            colors={fighter.colors}
            facing={fighter.facing}
            submerged={fighter.submerged}
            x={fighter.x}
            y={fighter.y}
            scale={2.4}
            label={fighter.label}
          />
        ))}

        {projectiles.map((projectile) => (
          <span
            key={projectile.id}
            aria-hidden
            className="bg-foam pointer-events-none absolute h-2 w-2 shadow-[0_0_0_2px_var(--color-surf)]"
            style={{
              left: `${projectile.x * 100}%`,
              top: `${projectile.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>

      {children}
    </div>
  );
}

/** Convenience: the two placeholder fighters used by the local/bot preview. */
export function placeholderFighters(
  selfX: number,
  selfY: number,
  selfSubmerged: boolean,
  opponentX: number,
  opponentY: number,
  opponentSubmerged: boolean,
): ArenaFighter[] {
  const [self, opponent] = CHARACTERS;
  return [
    {
      id: 'self',
      x: selfX,
      y: selfY,
      facing: opponentX > selfX ? 'right' : 'left',
      submerged: selfSubmerged,
      label: 'You',
      colors: self.colors,
    },
    {
      id: 'opponent',
      x: opponentX,
      y: opponentY,
      facing: selfX > opponentX ? 'right' : 'left',
      submerged: opponentSubmerged,
      label: 'Bot',
      colors: opponent.colors,
    },
  ];
}
