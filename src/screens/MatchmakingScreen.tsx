import { useEffect, useState } from 'react';
import type { MapId } from '@/types/game';
import { MAP_BY_ID } from '@/data/maps';
import { WaterCanvas } from '@/components/water/WaterCanvas';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { useNavigation } from '@/state/NavigationContext';
import { useSettings } from '@/state/SettingsContext';
import { usePlayer } from '@/state/PlayerContext';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/cn';

export interface MatchmakingScreenProps {
  mapId: MapId;
}

type Phase = 'searching' | 'found' | 'starting';

const OPPONENT = { name: 'Tidewalker', elo: 1204 };

/**
 * Ranked queue. The search widens its rating window over time, then reveals the
 * opponent before dropping into the match.
 *
 * PLACEHOLDER(Block 6): timings are scripted. Supabase Realtime matchmaking
 * replaces the timers and fills in the real opponent.
 */
export function MatchmakingScreen({ mapId }: MatchmakingScreenProps) {
  const { navigate, back } = useNavigation();
  const { settings } = useSettings();
  const { profile } = usePlayer();
  const map = MAP_BY_ID[mapId];

  const [phase, setPhase] = useState<Phase>('searching');
  const [elapsedMs, setElapsedMs] = useState(0);

  // Queue timer.
  useEffect(() => {
    if (phase !== 'searching') return;
    const interval = window.setInterval(() => setElapsedMs((value) => value + 100), 100);
    return () => window.clearInterval(interval);
  }, [phase]);

  // Scripted match found → short reveal → into the match.
  useEffect(() => {
    if (phase !== 'searching') return;
    const timer = window.setTimeout(() => setPhase('found'), 3400);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'found') return;
    const timer = window.setTimeout(() => {
      setPhase('starting');
      navigate('match', { mode: 'online', mapId }, 'scale');
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [phase, mapId, navigate]);

  // The acceptable rating gap grows the longer you wait.
  const searchRange = 40 + Math.floor(elapsedMs / 1000) * 25;

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <WaterCanvas
        map={map}
        variant="background"
        pixelSize={9}
        fps={20}
        className="absolute inset-0"
      />
      <div aria-hidden className="bg-abyss/88 absolute inset-0" />

      <div className="stage relative flex h-full flex-col items-center justify-center gap-6">
        {phase === 'searching' ? (
          <>
            {/* Radar: expanding rings behind a pulsing core. */}
            <div className="relative flex h-52 w-52 items-center justify-center">
              {[0, 1, 2].map((ring) => (
                <span
                  key={ring}
                  aria-hidden
                  className="animate-radar border-surf absolute h-full w-full border-4"
                  style={{ animationDelay: `${ring * 0.6}s` }}
                />
              ))}
              <span className="bg-surf text-abyss animate-pulse-glow flex h-16 w-16 items-center justify-center text-3xl">
                ◈
              </span>
            </div>

            <div className="text-center">
              <h1 className="text-pixel-shadow text-2xl tracking-[0.2em] uppercase sm:text-3xl">
                Finding opponent
                <AnimatedDots />
              </h1>
              <p className="text-mist/60 mt-2 text-[11px] tracking-[0.1em]">
                Searching {profile.elo - searchRange}–{profile.elo + searchRange} ELO ·{' '}
                {formatDuration(elapsedMs)}
              </p>
            </div>

            <PixelPanel title="Queue" variant="default" className="w-full max-w-sm">
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="text-mist/60 tracking-[0.1em] uppercase">Map</span>
                <span>{map.name}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
                <span className="text-mist/60 tracking-[0.1em] uppercase">Your rating</span>
                <PixelBadge tone="gold">{profile.elo} ELO</PixelBadge>
              </div>
            </PixelPanel>

            <PixelButton variant="danger" size="md" onClick={back}>
              Cancel search
            </PixelButton>
          </>
        ) : (
          <div className="animate-pop-in flex w-full max-w-2xl flex-col items-center gap-5">
            <h1 className="text-gold text-pixel-shadow text-3xl tracking-[0.22em] uppercase sm:text-5xl">
              Match found
            </h1>

            <div className="flex w-full items-center justify-center gap-3 sm:gap-6">
              <FighterCard name={settings.playerName || 'Rookie'} elo={profile.elo} isSelf />
              <span className="text-danger animate-pulse-glow text-2xl font-bold sm:text-4xl">
                VS
              </span>
              <FighterCard name={OPPONENT.name} elo={OPPONENT.elo} />
            </div>

            <div className="text-center">
              <PixelBadge tone="surf">{map.name}</PixelBadge>
              <p className="text-mist/60 mt-2 text-[11px] tracking-[0.1em] uppercase">
                Diving in
                <AnimatedDots />
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FighterCard({
  name,
  elo,
  isSelf = false,
}: {
  name: string;
  elo: number;
  isSelf?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-deep animate-rise-in flex w-full max-w-[190px] flex-col items-center gap-2 p-3',
        isSelf
          ? 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-surf)]'
          : 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-danger)]',
      )}
      style={{ animationDelay: isSelf ? '80ms' : '220ms' }}
    >
      <div className="bg-abyss pixel-bevel-inset flex h-20 w-full items-center justify-center">
        <span className="animate-bob relative block">
          <span className="mx-auto block h-5 w-5 bg-[#f2c9a0]" />
          <span className="block h-6 w-8" style={{ background: isSelf ? '#34b6d8' : '#ff4d5e' }} />
          <span className="bg-foam mt-[2px] block h-[2px] w-10 -translate-x-1" />
        </span>
      </div>
      <div className="w-full truncate text-center text-[12px] font-bold tracking-[0.1em] uppercase">
        {name}
      </div>
      <PixelBadge tone={isSelf ? 'surf' : 'danger'}>{elo} ELO</PixelBadge>
    </div>
  );
}

/** Three dots that fill in on a loop. */
function AnimatedDots() {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="animate-blink inline-block"
          style={{ animationDelay: `${index * 0.25}s` }}
        >
          .
        </span>
      ))}
    </>
  );
}
