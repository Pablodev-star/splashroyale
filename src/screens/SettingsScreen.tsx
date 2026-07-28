import { useState } from 'react';
import { ScreenFrame } from '@/components/ui/ScreenFrame';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelInput } from '@/components/ui/PixelInput';
import { PixelSlider } from '@/components/ui/PixelSlider';
import { PixelToggle } from '@/components/ui/PixelToggle';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { WaterCanvas } from '@/components/water/WaterCanvas';
import { KeyCap } from '@/components/ui/KeyCap';
import { KEYBINDS } from '@/game/input/keybinds';
import { useDetectedInputMode } from '@/hooks/useInputMode';
import { useNavigation } from '@/state/NavigationContext';
import { useSettings } from '@/state/SettingsContext';
import { usePlayer } from '@/state/PlayerContext';
import { cn } from '@/lib/cn';

type TabId = 'profile' | 'audio' | 'video' | 'gameplay';

const TABS: { id: TabId; label: string; glyph: string; blurb: string }[] = [
  { id: 'profile', label: 'Profile', glyph: '☺', blurb: 'Name and identity' },
  { id: 'audio', label: 'Audio', glyph: '♪', blurb: 'Volume mix' },
  { id: 'video', label: 'Video', glyph: '▢', blurb: 'Look and feel' },
  { id: 'gameplay', label: 'Gameplay', glyph: '✦', blurb: 'HUD and controls' },
];

/**
 * Settings, grouped into tabs so each screen holds one decision at a time
 * instead of a wall of four panels. The preview panel reacts live, so video
 * options can be judged without leaving the screen.
 */
export function SettingsScreen() {
  const { back } = useNavigation();
  const { settings, update, reset } = useSettings();
  // The raw detection, not the resolved mode: this screen shows the player what
  // their device reports so "Auto" is an informed choice rather than a guess.
  const detected = useDetectedInputMode();
  const { profile, resetProgress } = usePlayer();
  const [tab, setTab] = useState<TabId>('profile');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <ScreenFrame
        title="Settings"
        subtitle="Stored on this device"
        onBack={back}
        footer={
          <>
            <PixelButton variant="ghost" size="md" onClick={() => setConfirmWipe(true)}>
              Wipe progress
            </PixelButton>
            <PixelButton variant="ghost" size="md" onClick={() => setConfirmReset(true)}>
              Reset defaults
            </PixelButton>
            <PixelButton variant="primary" size="md" icon="✓" onClick={back}>
              Done
            </PixelButton>
          </>
        }
      >
        <div className="grid gap-4 pb-6 md:grid-cols-[190px_1fr]">
          {/* Tab rail: vertical on desktop, horizontal scroller on mobile. */}
          <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
            {TABS.map((entry, index) => {
              const active = tab === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setTab(entry.id)}
                  aria-pressed={active}
                  className={cn(
                    'animate-rise-in flex shrink-0 items-center gap-2.5 px-3 py-2.5 text-left',
                    'transition-transform duration-[110ms] ease-[steps(3,jump-none)]',
                    'hover:translate-x-[2px] focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-foam',
                    'md:w-full',
                    active
                      ? 'bg-surf text-abyss pixel-border-active'
                      : 'bg-deep text-mist/70 pixel-border-thin',
                  )}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <span className="text-base leading-none">{entry.glyph}</span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold tracking-[0.12em] uppercase">
                      {entry.label}
                    </span>
                    <span
                      className={cn(
                        'hidden text-[9px] md:block',
                        active ? 'text-abyss/70' : 'text-mist/40',
                      )}
                    >
                      {entry.blurb}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Panel — keyed so switching tabs replays the entry animation. */}
          <div key={tab} className="animate-rise-in flex flex-col gap-3">
            {tab === 'profile' && (
              <>
                <PixelPanel title="Identity" variant="default">
                  <PixelInput
                    value={settings.playerName}
                    onChange={(value) => update('playerName', value.slice(0, 16))}
                    label="Display name"
                    placeholder="Rookie"
                    maxLength={16}
                    hint="Shown on your nameplate in every match."
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PixelBadge tone="surf">Level {profile.level}</PixelBadge>
                    <PixelBadge tone="gold" icon="◆">
                      {profile.gold}
                    </PixelBadge>
                    <PixelBadge tone="neutral">{profile.elo} ELO</PixelBadge>
                  </div>
                </PixelPanel>

                <PixelPanel title="Nameplate preview" variant="sunken">
                  <div className="bg-deep/85 pixel-border-thin max-w-[260px] p-2">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="truncate text-[11px] font-bold tracking-[0.14em] uppercase">
                        {settings.playerName || 'Rookie'}
                      </span>
                      <PixelBadge tone="surf">You</PixelBadge>
                    </div>
                    <div className="bg-abyss pixel-border-thin flex h-3 w-full gap-[2px] p-[2px]">
                      {Array.from({ length: 16 }, (_, index) => (
                        <span
                          key={index}
                          className={cn('h-full flex-1', index < 13 ? 'bg-hp' : 'bg-ocean/60')}
                        />
                      ))}
                    </div>
                  </div>
                </PixelPanel>
              </>
            )}

            {tab === 'audio' && (
              <PixelPanel title="Volume" variant="default">
                <div className="flex flex-col gap-5">
                  <PixelSlider
                    value={settings.masterVolume}
                    onChange={(value) => update('masterVolume', value)}
                    label="Master"
                    tone="gold"
                  />
                  <PixelSlider
                    value={settings.musicVolume}
                    onChange={(value) => update('musicVolume', value)}
                    label="Music"
                  />
                  <PixelSlider
                    value={settings.sfxVolume}
                    onChange={(value) => update('sfxVolume', value)}
                    label="Effects"
                  />
                </div>

                {/* Level meter reacting to the mix. */}
                <div className="border-lagoon mt-4 border-t-2 pt-3">
                  <span className="text-mist/50 text-[9px] tracking-[0.16em] uppercase">
                    Output level
                  </span>
                  <div className="mt-1.5 flex h-8 items-end gap-[3px]">
                    {Array.from({ length: 28 }, (_, index) => {
                      const wave = Math.abs(Math.sin(index * 0.7)) * 0.7 + 0.3;
                      const height = wave * (settings.masterVolume / 100) * 100;
                      return (
                        <span
                          key={index}
                          className={cn(
                            'flex-1 transition-all duration-300',
                            height > 70 ? 'bg-danger' : height > 40 ? 'bg-charge' : 'bg-hp',
                          )}
                          style={{ height: `${Math.max(6, height)}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
              </PixelPanel>
            )}

            {tab === 'video' && (
              <>
                <PixelPanel title="Presentation" variant="default">
                  <div className="divide-lagoon/40 flex flex-col divide-y-2">
                    <PixelToggle
                      value={settings.scanlines}
                      onChange={(value) => update('scanlines', value)}
                      label="Scanlines"
                      hint="CRT veil over the whole screen."
                    />
                    <PixelToggle
                      value={settings.screenShake}
                      onChange={(value) => update('screenShake', value)}
                      label="Screen shake"
                      hint="Camera kick on heavy splashes."
                    />
                  </div>
                </PixelPanel>

                {/* Live preview so the toggles are judged in place. */}
                <PixelPanel title="Preview" variant="sunken" flush>
                  <div
                    className={cn(
                      'relative mx-auto h-40 w-full max-w-[420px] overflow-hidden',
                      settings.scanlines && 'scanlines',
                      settings.screenShake && 'animate-shake',
                    )}
                  >
                    <WaterCanvas
                      variant="arena"
                      pixelSize={4}
                      fps={20}
                      className="absolute inset-0"
                    />
                    <span className="text-mist/80 text-pixel-shadow-sm absolute bottom-2 left-2 text-[9px] tracking-[0.14em] uppercase">
                      {settings.scanlines ? 'Scanlines on' : 'Scanlines off'}
                      {settings.screenShake ? ' · shake on' : ''}
                    </span>
                  </div>
                </PixelPanel>
              </>
            )}

            {tab === 'gameplay' && (
              <>
                <PixelPanel title="HUD & controls" variant="default">
                  <div className="divide-lagoon/40 flex flex-col divide-y-2">
                    <PixelToggle
                      value={settings.showMinimap}
                      onChange={(value) => update('showMinimap', value)}
                      label="Minimap"
                      hint="Tactical overlay in the corner of the HUD."
                    />
                    <PixelToggle
                      value={settings.leftHandedControls}
                      onChange={(value) => update('leftHandedControls', value)}
                      label="Left-handed touch controls"
                      hint="Mirrors the stick and the action pads."
                    />
                  </div>
                </PixelPanel>

                {/* Control scheme. `auto` reads the device and is right nearly
                    always; the override exists for the cases it cannot see —
                    a tablet with a keyboard case, a touchscreen desktop. */}
                <PixelPanel title="Control scheme" variant="default">
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ['auto', 'Auto', 'Detect'],
                        ['touch', 'Touch', 'On-screen'],
                        ['keyboard', 'Keyboard', 'WASD'],
                      ] as const
                    ).map(([value, label, hint]) => (
                      <PixelButton
                        key={value}
                        size="sm"
                        variant={settings.controlScheme === value ? 'primary' : 'secondary'}
                        onClick={() => update('controlScheme', value)}
                      >
                        <span className="block leading-tight">
                          {label}
                          <span className="block text-[8px] opacity-70">{hint}</span>
                        </span>
                      </PixelButton>
                    ))}
                  </div>
                  <p className="text-mist/45 mt-2 text-[10px] leading-snug">
                    Detected on this device:{' '}
                    <span className="text-surf">
                      {detected === 'touch' ? 'touch controls' : 'keyboard'}
                    </span>
                    . Auto follows this.
                  </p>
                </PixelPanel>

                {settings.controlScheme === 'touch' ||
                (settings.controlScheme === 'auto' && detected === 'touch') ? (
                  <PixelPanel title="Touch layout" variant="sunken">
                    <div
                      className={cn(
                        'bg-abyss pixel-bevel-inset flex h-24 items-end justify-between p-2',
                        settings.leftHandedControls && 'flex-row-reverse',
                      )}
                    >
                      <span className="bg-ocean pixel-border-thin flex h-14 w-14 items-center justify-center text-[9px] tracking-[0.12em] uppercase">
                        Stick
                      </span>
                      <span className="flex gap-1.5">
                        <span className="bg-ocean pixel-border-thin flex h-9 w-9 items-center justify-center text-[9px]">
                          K
                        </span>
                        <span className="bg-surf text-abyss pixel-border-thin flex h-9 w-9 items-center justify-center text-[9px]">
                          *
                        </span>
                      </span>
                    </div>
                  </PixelPanel>
                ) : (
                  /* Keys are listed from `KEYBINDS`, never retyped. The line
                     that used to sit here said "S to dive" — S is the *down*
                     movement key, and dive has always been Shift. */
                  <PixelPanel title="Keyboard" variant="sunken">
                    <ul className="flex flex-col gap-1.5">
                      {(
                        [
                          ['WASD', 'Move'],
                          ['Drag', 'Turn the camera'],
                          [KEYBINDS.attack1.cap, 'Attack 1 — hold to charge'],
                          [KEYBINDS.attack2.cap, 'Attack 2'],
                          [KEYBINDS.ultimate.cap, 'Ultimate'],
                          [KEYBINDS.dive.cap, 'Dive / surface'],
                          [KEYBINDS.pause.cap, 'Pause'],
                        ] as const
                      ).map(([cap, label]) => (
                        <li key={label} className="flex items-center gap-2">
                          <KeyCap>{cap}</KeyCap>
                          <span className="text-mist/60 text-[10px]">{label}</span>
                        </li>
                      ))}
                    </ul>
                  </PixelPanel>
                )}
              </>
            )}
          </div>
        </div>
      </ScreenFrame>

      {/* Wiping progress is separate from resetting settings, and far louder:
          one restores a volume slider, the other deletes a collection. */}
      {confirmWipe && (
        <div className="bg-abyss/85 absolute inset-0 z-30 flex items-center justify-center p-4">
          <PixelPanel
            title="Wipe progress"
            variant="danger"
            className="animate-pop-in w-full max-w-xs"
          >
            <p className="text-[11px] leading-snug">
              Delete your collection and start over? Every card, every level and{' '}
              <span className="text-gold tabular-nums">◆ {profile.gold}</span> gold go back to a new
              account. This cannot be undone.
            </p>
            <div className="mt-3 flex gap-2">
              <PixelButton variant="ghost" size="md" fullWidth onClick={() => setConfirmWipe(false)}>
                Cancel
              </PixelButton>
              <PixelButton
                variant="danger"
                size="md"
                fullWidth
                onClick={() => {
                  resetProgress();
                  setConfirmWipe(false);
                }}
              >
                Wipe
              </PixelButton>
            </div>
          </PixelPanel>
        </div>
      )}

      {confirmReset && (
        <div className="bg-abyss/85 absolute inset-0 z-30 flex items-center justify-center p-4">
          <PixelPanel
            title="Reset settings"
            variant="danger"
            className="animate-pop-in w-full max-w-xs"
          >
            <p className="text-[11px] leading-snug">
              Restore every option to its default? Your name, volumes and toggles all go back.
            </p>
            <div className="mt-3 flex gap-2">
              <PixelButton
                variant="ghost"
                size="md"
                fullWidth
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </PixelButton>
              <PixelButton
                variant="danger"
                size="md"
                fullWidth
                onClick={() => {
                  reset();
                  setConfirmReset(false);
                }}
              >
                Reset
              </PixelButton>
            </div>
          </PixelPanel>
        </div>
      )}
    </div>
  );
}
