import { ScreenFrame } from '@/components/ui/ScreenFrame';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelInput } from '@/components/ui/PixelInput';
import { PixelSlider } from '@/components/ui/PixelSlider';
import { PixelToggle } from '@/components/ui/PixelToggle';
import { useNavigation } from '@/state/NavigationContext';
import { useSettings } from '@/state/SettingsContext';

export function SettingsScreen() {
  const { back } = useNavigation();
  const { settings, update, reset } = useSettings();

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <ScreenFrame
        title="Settings"
        subtitle="Stored on this device"
        onBack={back}
        footer={
          <>
            <PixelButton variant="ghost" size="md" onClick={reset}>
              Reset to defaults
            </PixelButton>
            <PixelButton variant="primary" size="md" onClick={back}>
              Done
            </PixelButton>
          </>
        }
      >
        <div className="grid gap-3 pb-4 md:grid-cols-2">
          <PixelPanel title="Profile" variant="default">
            <PixelInput
              value={settings.playerName}
              onChange={(value) => update('playerName', value.slice(0, 16))}
              label="Display name"
              placeholder="Rookie"
              maxLength={16}
              hint="Shown on your nameplate in matches."
            />
          </PixelPanel>

          <PixelPanel title="Audio" variant="default">
            <div className="flex flex-col gap-4">
              <PixelSlider
                value={settings.masterVolume}
                onChange={(value) => update('masterVolume', value)}
                label="Master"
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
          </PixelPanel>

          <PixelPanel title="Video" variant="default">
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

          <PixelPanel title="Gameplay" variant="default">
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
                hint="Mirrors the stick and action pads."
              />
            </div>
          </PixelPanel>
        </div>
      </ScreenFrame>
    </div>
  );
}
