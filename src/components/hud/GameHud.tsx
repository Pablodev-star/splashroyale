import type { AbilityCard, AbilitySlot, HudState } from '@/types/game';
import { Nameplate } from './Nameplate';
import { ChargeMeter } from './ChargeMeter';
import { UltimateIndicator } from './UltimateIndicator';
import { Minimap } from './Minimap';
import { MatchTimer } from './MatchTimer';
import { AbilityRail } from './AbilityRail';
import { PixelIconButton } from '@/components/ui/PixelIconButton';
import { cn } from '@/lib/cn';

export interface GameHudProps {
  state: HudState;
  ultimateName: string;
  /** The equipped deck (Block 3B), shown beside the minimap on desktop. */
  abilities?: Partial<Record<AbilitySlot, AbilityCard>>;
  /** Seconds left per ability, from the engine (Block 3C). */
  cooldowns?: Partial<Record<AbilitySlot, number>>;
  /** Rounds won so far, shown under the clock. */
  score?: { self: number; opponent: number };
  showMinimap?: boolean;
  /** Arena width / depth, forwarded to the minimap. */
  arenaAspect?: number;
  onPause?: () => void;
  onActivateUltimate?: () => void;
  className?: string;
}

/**
 * The complete in-match overlay. Pure and prop-driven: Block 3 hands it a fresh
 * `HudState` each frame and nothing else (ARCHITECTURE.md §4.1).
 */
export function GameHud({
  state,
  ultimateName,
  abilities,
  cooldowns,
  score,
  showMinimap = true,
  arenaAspect,
  onPause,
  onActivateUltimate,
  className,
}: GameHudProps) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 select-none', className)}>
      {/* Top row: both nameplates flanking the clock. */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        <Nameplate fighter={state.self} align="left" />
        <div className="flex flex-col items-center gap-2">
          <MatchTimer remainingMs={state.timeRemainingMs} round={state.round} />
          {score && (
            <div className="bg-abyss/75 flex items-center gap-2 px-2 py-0.5 text-[11px] tabular-nums">
              <span className="text-surf">{score.self}</span>
              <span className="text-mist/40 text-[9px]">—</span>
              <span className="text-danger">{score.opponent}</span>
            </div>
          )}
          {onPause && (
            <div className="pointer-events-auto">
              <PixelIconButton ariaLabel="Pause match" onClick={onPause}>
                II
              </PixelIconButton>
            </div>
          )}
        </div>
        <Nameplate fighter={state.opponent} align="right" />
      </div>

      {/* Bottom-left: minimap and the equipped deck. Hidden on phones, where the
          stick lives there and the touch pads already name the abilities. */}
      <div className="absolute bottom-3 left-3 hidden flex-col gap-2 md:flex">
        {abilities && <AbilityRail cards={abilities} cooldowns={cooldowns} />}
        {showMinimap && <Minimap entities={state.entities} aspect={arenaAspect} />}
      </div>

      {/* Bottom-centre: charge meter. Sits above the touch pads on phones. */}
      <div className="absolute bottom-[184px] left-1/2 w-[78vw] -translate-x-1/2 md:bottom-3 md:w-[min(420px,60vw)]">
        <ChargeMeter value={state.self.charge} charging={state.self.charge > 0} />
      </div>

      {/* Bottom-right: ultimate, also lifted clear of the touch pads. */}
      <div className="pointer-events-auto absolute right-2 bottom-[184px] md:right-3 md:bottom-3">
        <UltimateIndicator
          value={state.self.ultimate}
          name={ultimateName}
          locked={state.self.submerged}
          onActivate={onActivateUltimate}
          className="h-16 w-16 md:h-20 md:w-20"
        />
      </div>
    </div>
  );
}
