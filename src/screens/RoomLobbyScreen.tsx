import { useEffect, useState } from 'react';
import { WaterCanvas } from '@/components/water/WaterCanvas';
import { ScreenFrame } from '@/components/ui/ScreenFrame';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { useNavigation } from '@/state/NavigationContext';
import { useSettings } from '@/state/SettingsContext';
import { usePlayer } from '@/state/PlayerContext';
import { cn } from '@/lib/cn';

export interface RoomLobbyScreenProps {
  roomCode: string;
  isHost: boolean;
}

/**
 * Private room lobby: the code to share, both player slots, and ready state.
 *
 * PLACEHOLDER(Block 6): the opponent joining and the ready handshake are
 * simulated on a timer. Supabase Realtime presence replaces the timers; the
 * slots, the code and the start rules stay exactly as they are.
 */
export function RoomLobbyScreen({ roomCode, isHost }: RoomLobbyScreenProps) {
  const { navigate, back } = useNavigation();
  const { settings } = useSettings();
  const { profile } = usePlayer();

  const [opponentJoined, setOpponentJoined] = useState(!isHost);
  const [selfReady, setSelfReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [copied, setCopied] = useState(false);

  // The guest is already in the room; a host waits for someone to arrive.
  useEffect(() => {
    if (!isHost) return;
    const timer = window.setTimeout(() => setOpponentJoined(true), 4200);
    return () => window.clearTimeout(timer);
  }, [isHost]);

  // Once both are present, the other side readies up shortly after you do.
  useEffect(() => {
    if (!opponentJoined || !selfReady) return;
    const timer = window.setTimeout(() => setOpponentReady(true), 1100);
    return () => window.clearTimeout(timer);
  }, [opponentJoined, selfReady]);

  const bothReady = selfReady && opponentReady;

  const copyCode = () => {
    navigator.clipboard?.writeText(roomCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <WaterCanvas variant="background" pixelSize={9} fps={20} className="absolute inset-0" />
      <div aria-hidden className="bg-abyss/86 absolute inset-0" />

      <div className="relative h-full">
        <ScreenFrame
          title="Private Room"
          subtitle={isHost ? 'You are hosting' : 'You joined this room'}
          onBack={back}
          aside={
            <PixelBadge tone={bothReady ? 'gold' : 'neutral'}>
              {bothReady ? 'Ready' : 'Waiting'}
            </PixelBadge>
          }
          footer={
            <>
              <PixelButton variant="danger" size="md" onClick={back}>
                Leave room
              </PixelButton>
              <PixelButton
                variant={bothReady ? 'gold' : 'secondary'}
                size="lg"
                icon="▶"
                emphasis={bothReady}
                disabled={!bothReady || !isHost}
                onClick={() => navigate('mapSelect', { mode: 'privateRoom', roomCode })}
              >
                {isHost ? 'Pick map & start' : 'Host starts the match'}
              </PixelButton>
            </>
          }
        >
          <div className="grid gap-4 pb-6 lg:grid-cols-[minmax(0,320px)_1fr]">
            {/* Share code */}
            <PixelPanel title="Room code" variant="gold" className="animate-rise-in">
              <div className="bg-abyss pixel-bevel-inset px-3 py-5 text-center">
                <div className="text-mist/45 text-[9px] tracking-[0.22em] uppercase">
                  Share this code
                </div>
                <div className="text-gold text-pixel-shadow mt-1 text-4xl tracking-[0.32em]">
                  {roomCode}
                </div>
              </div>

              <PixelButton
                variant={copied ? 'primary' : 'secondary'}
                size="md"
                icon={copied ? '✓' : '⧉'}
                fullWidth
                className="mt-3"
                onClick={copyCode}
              >
                {copied ? 'Copied!' : 'Copy code'}
              </PixelButton>

              <p className="text-mist/45 mt-2 text-[10px] leading-snug">
                Anyone with this code can join until the match starts.
              </p>
            </PixelPanel>

            {/* Player slots */}
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <PlayerSlot
                  name={settings.playerName || 'Rookie'}
                  tag={isHost ? 'Host' : 'Guest'}
                  elo={profile.elo}
                  ready={selfReady}
                  present
                  isSelf
                  delayMs={60}
                />
                <PlayerSlot
                  name={opponentJoined ? 'Challenger' : 'Waiting…'}
                  tag={isHost ? 'Guest' : 'Host'}
                  elo={opponentJoined ? 1204 : undefined}
                  ready={opponentReady}
                  present={opponentJoined}
                  delayMs={120}
                />
              </div>

              <PixelPanel title="Status" variant="default" className="animate-rise-in">
                <ul className="flex flex-col gap-2 text-[11px]">
                  <StatusRow done={opponentJoined} label="Both fighters in the room" />
                  <StatusRow done={selfReady} label="You are ready" />
                  <StatusRow done={opponentReady} label="Opponent is ready" />
                </ul>

                <PixelButton
                  variant={selfReady ? 'secondary' : 'primary'}
                  size="lg"
                  icon={selfReady ? '✓' : '▲'}
                  fullWidth
                  className="mt-3"
                  disabled={!opponentJoined}
                  onClick={() => setSelfReady((value) => !value)}
                >
                  {selfReady ? 'Ready — tap to cancel' : 'Ready up'}
                </PixelButton>
              </PixelPanel>
            </div>
          </div>
        </ScreenFrame>
      </div>
    </div>
  );
}

function PlayerSlot({
  name,
  tag,
  elo,
  ready,
  present,
  isSelf = false,
  delayMs,
}: {
  name: string;
  tag: string;
  elo?: number;
  ready: boolean;
  present: boolean;
  isSelf?: boolean;
  delayMs: number;
}) {
  return (
    <div
      className={cn(
        'bg-deep animate-rise-in relative flex flex-col items-center gap-2 p-4',
        ready
          ? 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-hp)]'
          : present
            ? 'pixel-border'
            : 'pixel-border-thin opacity-70',
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {/* Avatar */}
      <div className="bg-abyss pixel-bevel-inset relative flex h-20 w-20 items-center justify-center overflow-hidden">
        {present ? (
          <span className="animate-bob relative block">
            <span className="mx-auto block h-5 w-5 bg-[#f2c9a0]" />
            <span
              className="block h-6 w-8"
              style={{ background: isSelf ? '#34b6d8' : '#ff4d5e' }}
            />
            <span className="bg-foam mt-[2px] block h-[2px] w-10 -translate-x-1" />
          </span>
        ) : (
          <span className="text-ocean animate-blink text-3xl">?</span>
        )}
      </div>

      <div className="text-center">
        <div className="truncate text-[12px] font-bold tracking-[0.1em] uppercase">{name}</div>
        <div className="mt-1 flex items-center justify-center gap-1.5">
          <PixelBadge tone={isSelf ? 'surf' : 'neutral'}>{tag}</PixelBadge>
          {elo !== undefined && <PixelBadge tone="neutral">{elo}</PixelBadge>}
        </div>
      </div>

      <div
        className={cn(
          'w-full py-1 text-center text-[9px] font-bold tracking-[0.16em] uppercase',
          ready
            ? 'bg-hp text-abyss'
            : present
              ? 'bg-ocean text-mist/60'
              : 'bg-ocean/50 text-mist/40',
        )}
      >
        {ready ? 'Ready' : present ? 'Not ready' : 'Empty slot'}
      </div>
    </div>
  );
}

function StatusRow({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center text-[10px]',
          done ? 'bg-hp text-abyss' : 'bg-ocean text-mist/50',
        )}
      >
        {done ? '✓' : '·'}
      </span>
      <span className={done ? 'text-mist' : 'text-mist/50'}>{label}</span>
    </li>
  );
}
