import { useState } from 'react';
import type { GameMode } from '@/types/game';
import { WaterCanvas } from '@/components/water/WaterCanvas';
import { ScreenFrame } from '@/components/ui/ScreenFrame';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { PixelInput } from '@/components/ui/PixelInput';
import { useNavigation } from '@/state/NavigationContext';
import { usePlayer } from '@/state/PlayerContext';
import { generateRoomCode, isValidRoomCode } from '@/lib/format';
import { cn } from '@/lib/cn';

interface ModeOption {
  id: GameMode;
  title: string;
  glyph: string;
  blurb: string;
  detail: string;
  badge?: { label: string; tone: 'surf' | 'gold' | 'neutral' };
}

const MODES: ModeOption[] = [
  {
    id: 'localBots',
    title: 'Local vs Bots',
    glyph: '▶',
    blurb: 'Practice against the AI.',
    detail: 'No connection needed. Bots approach, splash, dive when hurt and use their ultimate.',
    badge: { label: 'Offline', tone: 'neutral' },
  },
  {
    id: 'online',
    title: 'Competitive Online',
    glyph: '◈',
    blurb: 'Ranked matchmaking by ELO.',
    detail: 'Matched against a fighter near your rating. Wins pay gold up to the daily cap.',
    badge: { label: 'Ranked', tone: 'gold' },
  },
  {
    id: 'privateRoom',
    title: 'Private Room',
    glyph: '#',
    blurb: 'Play with a friend using a code.',
    detail: 'Create a room and share the six-character code, or join one you were given.',
    badge: { label: 'Friends', tone: 'surf' },
  },
];

export function ModeSelectScreen() {
  const { navigate, back } = useNavigation();
  const { profile } = usePlayer();
  const [selected, setSelected] = useState<GameMode>('online');
  const [joinCode, setJoinCode] = useState('');
  const [hostedCode, setHostedCode] = useState<string | null>(null);
  const [joinError, setJoinError] = useState(false);

  const startMode = (mode: GameMode, roomCode?: string) => {
    navigate('mapSelect', { mode, roomCode });
  };

  const handleJoin = () => {
    if (!isValidRoomCode(joinCode)) {
      setJoinError(true);
      return;
    }
    setJoinError(false);
    // PLACEHOLDER(Block 6): Supabase Realtime channel join happens here.
    startMode('privateRoom', joinCode.trim().toUpperCase());
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <WaterCanvas variant="background" pixelSize={8} fps={20} className="absolute inset-0" />
      <div aria-hidden className="bg-abyss/80 absolute inset-0" />

      <div className="relative h-full">
        <ScreenFrame
          title="Select Mode"
          subtitle="How do you want to get wet?"
          onBack={back}
          aside={<PixelBadge tone="neutral">{profile.elo} ELO</PixelBadge>}
        >
          <div className="grid gap-3 md:grid-cols-3">
            {MODES.map((mode) => {
              const active = selected === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSelected(mode.id)}
                  aria-pressed={active}
                  className={cn(
                    'bg-deep relative flex flex-col gap-2 p-4 text-left',
                    'transition-transform duration-[90ms] ease-[steps(2,jump-none)]',
                    'hover:-translate-y-[2px] focus-visible:outline-2 focus-visible:outline-offset-[7px] focus-visible:outline-foam',
                    active ? 'pixel-border-active' : 'pixel-border',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={cn('text-2xl leading-none', active ? 'text-surf' : 'text-mist/60')}
                    >
                      {mode.glyph}
                    </span>
                    {mode.badge && (
                      <PixelBadge tone={mode.badge.tone}>{mode.badge.label}</PixelBadge>
                    )}
                  </span>
                  <span className="text-sm font-bold tracking-[0.12em] uppercase">
                    {mode.title}
                  </span>
                  <span className="text-mist/70 text-[11px] leading-snug">{mode.blurb}</span>
                  <span className="text-mist/45 text-[10px] leading-snug">{mode.detail}</span>
                </button>
              );
            })}
          </div>

          {/* Mode-specific panel */}
          <div className="mt-4">
            {selected === 'privateRoom' ? (
              <PixelPanel title="Private Room" variant="default">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Host */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] tracking-[0.18em] text-mist/60 uppercase">
                      Host a room
                    </span>
                    {hostedCode ? (
                      <div className="flex flex-col gap-3">
                        <div className="bg-abyss pixel-bevel-inset px-3 py-4 text-center">
                          <span className="text-mist/50 block text-[9px] tracking-[0.2em] uppercase">
                            Room code
                          </span>
                          <span className="text-gold text-3xl tracking-[0.4em]">{hostedCode}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <PixelButton
                            size="sm"
                            variant="secondary"
                            icon="⧉"
                            onClick={() => navigator.clipboard?.writeText(hostedCode)}
                          >
                            Copy code
                          </PixelButton>
                          <PixelButton
                            size="sm"
                            variant="ghost"
                            onClick={() => setHostedCode(null)}
                          >
                            Cancel
                          </PixelButton>
                        </div>
                        <p className="text-mist/50 text-[10px] leading-snug">
                          Waiting for an opponent to join…
                          {/* PLACEHOLDER(Block 6): Supabase presence drives this state. */}
                        </p>
                        <PixelButton
                          size="md"
                          variant="primary"
                          fullWidth
                          onClick={() => startMode('privateRoom', hostedCode)}
                        >
                          Continue
                        </PixelButton>
                      </div>
                    ) : (
                      <>
                        <p className="text-mist/60 text-[11px] leading-snug">
                          Generates a six-character code your friend can type in.
                        </p>
                        <PixelButton
                          size="md"
                          variant="primary"
                          icon="+"
                          onClick={() => setHostedCode(generateRoomCode())}
                        >
                          Create Room
                        </PixelButton>
                      </>
                    )}
                  </div>

                  {/* Join */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] tracking-[0.18em] text-mist/60 uppercase">
                      Join a room
                    </span>
                    <PixelInput
                      value={joinCode}
                      onChange={(value) => {
                        setJoinCode(value);
                        setJoinError(false);
                      }}
                      onSubmit={handleJoin}
                      placeholder="ABC123"
                      maxLength={6}
                      code
                      invalid={joinError}
                      hint={
                        joinError
                          ? 'Codes are 6 characters, letters and numbers.'
                          : 'Ask the host for their code.'
                      }
                    />
                    <PixelButton size="md" variant="secondary" icon="→" onClick={handleJoin}>
                      Join with Code
                    </PixelButton>
                  </div>
                </div>
              </PixelPanel>
            ) : (
              <PixelPanel
                title={selected === 'online' ? 'Competitive Online' : 'Local vs Bots'}
                variant="default"
              >
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-mist/70 max-w-lg text-[11px] leading-snug">
                    {selected === 'online'
                      ? 'You will be matched with a fighter close to your rating. Pick the map you want to queue on next.'
                      : 'Choose a map and fight a bot. Nothing is staked — gold and XP are reduced in practice.'}
                  </p>
                  <PixelButton
                    size="lg"
                    variant="primary"
                    icon="▶"
                    onClick={() => startMode(selected)}
                  >
                    Continue
                  </PixelButton>
                </div>
              </PixelPanel>
            )}
          </div>
        </ScreenFrame>
      </div>
    </div>
  );
}
