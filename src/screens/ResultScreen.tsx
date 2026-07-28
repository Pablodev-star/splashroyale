import type { GameMode, MapId, MatchOutcome } from '@/types/game';
import { MAP_BY_ID } from '@/data/maps';
import { WaterCanvas } from '@/components/water/WaterCanvas';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { PixelBar } from '@/components/ui/PixelBar';
import { useNavigation } from '@/state/NavigationContext';
import { useCountUp } from '@/hooks/useCountUp';
import { formatDuration, formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

export interface ResultScreenProps {
  mode: GameMode;
  mapId: MapId;
  outcome: MatchOutcome;
  /** Carried through so a private-room rematch stays in the same room. */
  roomCode?: string;
}

export function ResultScreen({ mode, mapId, outcome, roomCode }: ResultScreenProps) {
  const { navigate, home } = useNavigation();
  const map = MAP_BY_ID[mapId];

  const gold = useCountUp(outcome.goldEarned, 900, 350);
  const xp = useCountUp(outcome.xpEarned, 900, 550);
  const xpProgress = useCountUp(
    Math.round((outcome.xpIntoLevel / outcome.xpPerLevel) * 100),
    1100,
    650,
  );

  const { victory } = outcome;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <WaterCanvas
        map={map}
        variant="background"
        pixelSize={8}
        fps={20}
        className="absolute inset-0"
      />
      <div
        aria-hidden
        className={cn('absolute inset-0', victory ? 'bg-abyss/75' : 'bg-abyss/90')}
      />

      <div className="stage relative flex h-full flex-col items-center justify-center gap-4 overflow-y-auto">
        {/* Banner */}
        <div className="flex flex-col items-center gap-1">
          <h1
            className={cn(
              'text-pixel-shadow text-4xl tracking-[0.24em] uppercase sm:text-6xl',
              victory ? 'text-gold' : 'text-danger',
            )}
          >
            {victory ? 'Victory' : 'Defeat'}
          </h1>
          <div className="flex items-center gap-2">
            <PixelBadge tone={victory ? 'gold' : 'danger'} shimmer={victory}>
              {outcome.score.self} – {outcome.score.opponent}
            </PixelBadge>
            <PixelBadge tone="neutral">{map.name}</PixelBadge>
            <PixelBadge tone="neutral">{formatDuration(outcome.durationMs)}</PixelBadge>
          </div>
        </div>

        <div className="grid w-full max-w-3xl gap-3 md:grid-cols-2">
          {/* Rewards */}
          <PixelPanel title="Rewards" variant={victory ? 'gold' : 'default'}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] tracking-[0.16em] uppercase">Gold</span>
                <span className="text-gold text-2xl tabular-nums">
                  +{formatNumber(gold)} <span className="text-base">◆</span>
                </span>
              </div>
              {/* A capped payout has to say so. Silently paying less than the
                  match was worth reads as a bug, not as a rule. */}
              {outcome.goldCapped && (
                <p className="text-mist/50 -mt-3 text-[10px] leading-snug">
                  Daily gold cap reached — XP still counts in full.
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] tracking-[0.16em] uppercase">Experience</span>
                <span className="text-surf text-2xl tabular-nums">+{formatNumber(xp)} XP</span>
              </div>

              <div>
                <div className="mb-1 flex items-baseline justify-between text-[10px] tracking-[0.14em] uppercase">
                  <span className="text-mist/60">Level {outcome.levelAfter}</span>
                  <span className="text-mist tabular-nums">
                    {outcome.xpIntoLevel}/{outcome.xpPerLevel}
                  </span>
                </div>
                <PixelBar value={xpProgress / 100} tone="gold" segments={24} height="md" />
              </div>

              {outcome.eloDelta !== null && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] tracking-[0.16em] uppercase">Rating</span>
                  <PixelBadge tone={outcome.eloDelta >= 0 ? 'surf' : 'danger'}>
                    {outcome.eloDelta >= 0 ? `+${outcome.eloDelta}` : outcome.eloDelta} ELO
                  </PixelBadge>
                </div>
              )}

              {mode === 'localBots' && (
                <p className="text-mist/50 text-[10px] leading-snug">
                  Practice matches pay reduced rewards.
                </p>
              )}
            </div>
          </PixelPanel>

          {/* Match stats */}
          <PixelPanel title="Match Summary" variant="default">
            <dl className="flex flex-col gap-2 text-[11px]">
              <StatRow label="Damage dealt" value={formatNumber(outcome.stats.damageDealt)} />
              <StatRow label="Splashes landed" value={formatNumber(outcome.stats.splashesLanded)} />
              <StatRow
                label="Time submerged"
                value={formatDuration(outcome.stats.timeSubmergedMs)}
              />
              <StatRow label="Match length" value={formatDuration(outcome.durationMs)} />
            </dl>

            {/* PLACEHOLDER(Block 4): mission progress lands here. */}
            <div className="border-lagoon mt-3 border-t-2 pt-3">
              <span className="text-mist/50 text-[10px] tracking-[0.14em] uppercase">
                Daily mission
              </span>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[11px]">Win 3 matches</span>
                <span className="text-surf text-[11px] tabular-nums">2/3</span>
              </div>
              <PixelBar value={2 / 3} tone="surf" segments={18} height="sm" className="mt-1" />
            </div>
          </PixelPanel>
        </div>

        <div className="flex w-full max-w-3xl flex-wrap justify-center gap-2 pb-2">
          <PixelButton
            variant="primary"
            size="lg"
            icon="↻"
            onClick={() => navigate('match', { mode, mapId, roomCode }, 'fade')}
          >
            Rematch
          </PixelButton>
          <PixelButton
            variant="secondary"
            size="md"
            icon="▤"
            onClick={() => navigate('mapSelect', { mode, roomCode })}
          >
            Change Map
          </PixelButton>
          <PixelButton variant="gold" size="md" icon="▣" onClick={() => navigate('shop')}>
            Spend Gold
          </PixelButton>
          <PixelButton variant="ghost" size="md" onClick={home}>
            Main Menu
          </PixelButton>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-mist/60 tracking-[0.1em] uppercase">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
