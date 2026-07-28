import type { AbilityCard, AbilitySlot, HudState } from '@/types/game';
import { Nameplate } from './Nameplate';
import { ChargeMeter } from './ChargeMeter';
import { UltimateIndicator } from './UltimateIndicator';
import { Minimap } from './Minimap';
import { MatchTimer } from './MatchTimer';
import { AbilityRail } from './AbilityRail';
import { PixelIconButton } from '@/components/ui/PixelIconButton';
import { KEYBINDS } from '@/game/input/keybinds';
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
  /**
   * True when the touch layer is on screen.
   *
   * The HUD has to know: the stick claims the bottom-left corner and the pads
   * claim the bottom strip, so the minimap, charge meter and ultimate all move
   * out of the way. This used to be inferred from `md:` breakpoints, which
   * assumed "wide screen" meant "no pads" — false on a tablet, where the HUD
   * then sat directly on top of the controls.
   */
  touch?: boolean;
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
  touch = false,
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

      {/* Bottom-left: minimap and the equipped deck — only without the touch
          layer, whose stick sits in this exact corner and whose pads already
          carry the ability names. */}
      {!touch && (
        <div className="absolute bottom-3 left-3 flex flex-col gap-2">
          {abilities && <AbilityRail cards={abilities} cooldowns={cooldowns} showKeys />}
          {showMinimap && <Minimap entities={state.entities} aspect={arenaAspect} />}
        </div>
      )}

      {/* Bottom-centre: charge meter, lifted above the pads when they exist. */}
      <div
        className={cn(
          'absolute left-1/2 -translate-x-1/2',
          touch ? 'bottom-[184px] w-[78vw]' : 'bottom-3 w-[min(420px,60vw)]',
        )}
      >
        <ChargeMeter value={state.self.charge} charging={state.self.charge > 0} />
      </div>

      {/* Bottom-right: ultimate, cleared the same way. */}
      <div
        className={cn(
          'pointer-events-auto absolute',
          touch ? 'right-2 bottom-[184px]' : 'right-3 bottom-3',
        )}
      >
        <UltimateIndicator
          value={state.self.ultimate}
          name={ultimateName}
          locked={state.self.submerged}
          keyCap={touch ? undefined : KEYBINDS.ultimate.cap}
          onActivate={onActivateUltimate}
          className={touch ? 'h-16 w-16' : 'h-20 w-20'}
        />
      </div>
    </div>
  );
}
