import { NavigationProvider } from '@/state/NavigationContext';
import { SettingsProvider, useSettings } from '@/state/SettingsContext';
import { PlayerProvider } from '@/state/PlayerContext';
import { ScreenRouter } from '@/app/ScreenRouter';
import { cn } from '@/lib/cn';

export function App() {
  return (
    <SettingsProvider>
      <PlayerProvider>
        <NavigationProvider>
          <Stage />
        </NavigationProvider>
      </PlayerProvider>
    </SettingsProvider>
  );
}

/**
 * The game viewport. Sits between the providers and the router so the CRT veil
 * can be toggled from Settings in one place.
 */
function Stage() {
  const { settings } = useSettings();

  return (
    <div
      className={cn(
        'bg-abyss relative h-full w-full overflow-hidden',
        settings.scanlines && 'scanlines',
      )}
    >
      <ScreenRouter />
    </div>
  );
}
