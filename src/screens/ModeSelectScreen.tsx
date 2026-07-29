import { useState, type ReactNode } from 'react';
import { WaterCanvas } from '@/components/water/WaterCanvas';
import { ScreenFrame } from '@/components/ui/ScreenFrame';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { PixelInput } from '@/components/ui/PixelInput';
import type { BotDifficulty } from '@/types/game';
import {
  BOT_DIFFICULTY_ORDER,
  BOT_PROFILES,
  botProfile,
} from '@/game/engine/difficulty';
import { useNavigation } from '@/state/NavigationContext';
import { usePlayer } from '@/state/PlayerContext';
import { useSettings } from '@/state/SettingsContext';
import { generateRoomCode, isValidRoomCode, normaliseRoomCode } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * Mode picker. Each mode carries its own action, so there is no hidden
 * "selected" state to reason about — you press what you want and you are in it.
 */
export function ModeSelectScreen() {
  const { navigate, back } = useNavigation();
  const { profile } = usePlayer();
  const { settings, update } = useSettings();
  const bot = botProfile(settings.botDifficulty);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState(false);

  const handleJoin = () => {
    if (!isValidRoomCode(joinCode)) {
      setJoinError(true);
      return;
    }
    // PLACEHOLDER(Block 6): Supabase Realtime channel join happens here.
    navigate('roomLobby', { roomCode: normaliseRoomCode(joinCode), isHost: false });
  };

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <WaterCanvas variant="background" pixelSize={9} fps={20} className="absolute inset-0" />
      <div aria-hidden className="bg-abyss/85 absolute inset-0" />

      <div className="relative h-full">
        <ScreenFrame
          title="Play"
          subtitle="Pick how you want to get wet"
          onBack={back}
          aside={
            <PixelBadge tone="neutral" icon="▲">
              {profile.elo} ELO
            </PixelBadge>
          }
        >
          <div className="grid gap-4 pb-6 lg:grid-cols-3">
            <ModeCard
              title="Local vs Bots"
              glyph="▶"
              accent="surf"
              badge={{ label: 'Offline', tone: 'neutral' }}
              blurb="Practice against the AI. Nothing is staked."
              detail={bot.blurb}
              delayMs={0}
              art={<BotArt />}
              extra={
                <DifficultyPicker
                  value={settings.botDifficulty}
                  onChange={(value) => update('botDifficulty', value)}
                />
              }
              action={
                <PixelButton
                  variant="primary"
                  size="lg"
                  icon="▶"
                  fullWidth
                  onClick={() =>
                    navigate('mapSelect', {
                      mode: 'localBots',
                      difficulty: settings.botDifficulty,
                    })
                  }
                >
                  Play now
                </PixelButton>
              }
            />

            <ModeCard
              title="Competitive"
              glyph="◈"
              accent="gold"
              badge={{ label: 'Ranked', tone: 'gold' }}
              blurb="Matched against a fighter near your rating."
              detail="Wins pay gold up to the daily cap and move your ELO. Losses cost rating, not gold."
              delayMs={80}
              art={<RankedArt elo={profile.elo} />}
              action={
                <PixelButton
                  variant="gold"
                  size="lg"
                  icon="◈"
                  fullWidth
                  emphasis
                  onClick={() => navigate('mapSelect', { mode: 'online' })}
                >
                  Find match
                </PixelButton>
              }
            />

            <ModeCard
              title="Private Room"
              glyph="#"
              accent="epic"
              badge={{ label: 'Friends', tone: 'epic' }}
              blurb="Play with someone you know, using a code."
              detail="Host a room and share the six-character code, or type the one you were given."
              delayMs={160}
              art={<RoomArt />}
              action={
                <div className="flex flex-col gap-2">
                  <PixelButton
                    variant="secondary"
                    size="md"
                    icon="+"
                    fullWidth
                    onClick={() =>
                      navigate('roomLobby', { roomCode: generateRoomCode(), isHost: true })
                    }
                  >
                    Create room
                  </PixelButton>

                  <div className="flex items-start gap-2">
                    <PixelInput
                      value={joinCode}
                      onChange={(value) => {
                        setJoinCode(normaliseRoomCode(value));
                        setJoinError(false);
                      }}
                      onSubmit={handleJoin}
                      placeholder="ABC123"
                      maxLength={6}
                      code
                      invalid={joinError}
                      className="flex-1"
                      hint={joinError ? 'Six characters. No I, O, 0 or 1.' : undefined}
                    />
                    <PixelButton
                      variant="primary"
                      size="md"
                      icon="→"
                      ariaLabel="Join room with code"
                      onClick={handleJoin}
                    >
                      Join
                    </PixelButton>
                  </div>
                </div>
              }
            />
          </div>
        </ScreenFrame>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const ACCENT_FRAME = {
  surf: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-surf)]',
  gold: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-gold)]',
  epic: 'shadow-[0_0_0_2px_var(--color-abyss),0_0_0_5px_var(--color-rarity-epic)]',
} as const;

function ModeCard({
  title,
  glyph,
  accent,
  badge,
  blurb,
  detail,
  art,
  extra,
  action,
  delayMs,
}: {
  title: string;
  glyph: string;
  accent: keyof typeof ACCENT_FRAME;
  badge: { label: string; tone: 'neutral' | 'gold' | 'epic' };
  blurb: string;
  detail: string;
  art: ReactNode;
  /** Optional controls between the copy and the action, e.g. a difficulty picker. */
  extra?: ReactNode;
  action: ReactNode;
  delayMs: number;
}) {
  return (
    <section
      className={cn(
        'bg-deep animate-rise-in group flex flex-col overflow-hidden',
        ACCENT_FRAME[accent],
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {/* Animated illustration well. */}
      <div className="bg-abyss pixel-bevel-inset relative flex h-32 items-center justify-center overflow-hidden">
        {art}
        <span className="absolute top-1.5 right-1.5">
          <PixelBadge tone={badge.tone}>{badge.label}</PixelBadge>
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-[0.12em] uppercase">
          <span className="text-surf text-lg leading-none transition-transform duration-200 group-hover:scale-125">
            {glyph}
          </span>
          {title}
        </h2>
        <p className="text-mist/75 text-[11px] leading-snug">{blurb}</p>
        <p className="text-mist/45 text-[10px] leading-snug">{detail}</p>
        {extra}
        <div className="mt-auto pt-2">{action}</div>
      </div>
    </section>
  );
}

/**
 * The difficulty picker.
 *
 * Each option lists what actually changes rather than a vague adjective,
 * because these are behaviour differences and the player has no other way to
 * know that a Veteran will walk out of their poison while a Rookie stands in
 * it. "Hard" tells you nothing; "dodges hazards" tells you what to expect.
 */
function DifficultyPicker({
  value,
  onChange,
}: {
  value: BotDifficulty;
  onChange: (value: BotDifficulty) => void;
}) {
  const active = botProfile(value);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-mist/40 text-[9px] tracking-[0.16em] uppercase">Difficulty</span>
      <div className="grid grid-cols-4 gap-1">
        {BOT_DIFFICULTY_ORDER.map((id) => {
          const selected = id === value;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(id)}
              className={cn(
                'pixel-border-thin px-1 py-1 text-[9px] font-bold tracking-[0.08em] uppercase',
                'transition-transform duration-[90ms] ease-[steps(2,jump-none)] active:translate-y-[1px]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foam',
                selected ? 'bg-surf text-abyss' : 'bg-ocean/60 text-mist/70 hover:text-mist',
              )}
            >
              {BOT_PROFILES[id].label}
            </button>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-1">
        {active.tells.map((tell) => (
          <li
            key={tell}
            className="bg-abyss/60 text-mist/55 px-1.5 py-0.5 text-[9px] tracking-[0.06em]"
          >
            {tell}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Small animated illustrations — pure CSS, no assets. */

function BotArt() {
  return (
    <div aria-hidden className="relative flex items-end gap-6">
      {[0, 1].map((index) => (
        <span
          key={index}
          className="animate-bob relative block"
          style={{ animationDelay: `${index * 0.6}s` }}
        >
          <span className="mx-auto block h-4 w-4 bg-[#f2c9a0]" />
          <span
            className="block h-5 w-7"
            style={{ background: index === 0 ? '#34b6d8' : '#ff4d5e' }}
          />
          <span className="bg-foam mt-[2px] block h-[2px] w-9 -translate-x-1" />
        </span>
      ))}
    </div>
  );
}

function RankedArt({ elo }: { elo: number }) {
  return (
    <div aria-hidden className="relative flex flex-col items-center gap-1.5">
      <span className="animate-levitate text-gold text-4xl leading-none">◈</span>
      <span className="text-gold/80 text-[11px] tabular-nums">{elo}</span>
      <span className="flex gap-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className={cn('h-1.5 w-4', index < 3 ? 'bg-gold' : 'bg-ocean')} />
        ))}
      </span>
    </div>
  );
}

function RoomArt() {
  return (
    <div aria-hidden className="relative flex items-center gap-2">
      {['A', '?', '#'].map((char, index) => (
        <span
          key={index}
          className="bg-ocean text-rarity-epic pixel-border-thin animate-bob flex h-9 w-8 items-center justify-center text-sm font-bold"
          style={{ animationDelay: `${index * 0.25}s` }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}
