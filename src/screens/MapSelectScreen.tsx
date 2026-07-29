import { useState } from 'react';
import type { BotDifficulty, GameMode, MapId } from '@/types/game';
import { MAPS } from '@/data/maps';
import { MapPreview3D } from '@/game/scene';
import { ScreenFrame } from '@/components/ui/ScreenFrame';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { useNavigation } from '@/state/NavigationContext';
import { cn } from '@/lib/cn';

export interface MapSelectScreenProps {
  mode: GameMode;
  roomCode?: string;
  /** Chosen on the mode screen; carried through to the match unchanged. */
  difficulty?: BotDifficulty;
}

const MODE_LABEL: Record<GameMode, string> = {
  localBots: 'Local vs Bots',
  online: 'Competitive Online',
  privateRoom: 'Private Room',
};

export function MapSelectScreen({ mode, roomCode, difficulty }: MapSelectScreenProps) {
  const { navigate, back } = useNavigation();
  const [selected, setSelected] = useState<MapId>(MAPS[0].id);

  const selectedMap = MAPS.find((map) => map.id === selected) ?? MAPS[0];

  return (
    <div className="bg-abyss relative h-full w-full overflow-hidden">
      <ScreenFrame
        title="Select Map"
        subtitle={roomCode ? `${MODE_LABEL[mode]} · Room ${roomCode}` : MODE_LABEL[mode]}
        onBack={back}
        aside={<PixelBadge tone="surf">{MODE_LABEL[mode]}</PixelBadge>}
        footer={
          <>
            <span className="text-mist/50 mr-auto text-[10px] tracking-[0.12em] uppercase">
              {selectedMap.name} · {selectedMap.size.width}×{selectedMap.size.depth}
            </span>
            <PixelButton variant="ghost" size="md" onClick={back}>
              Back
            </PixelButton>
            {/* Deck first, match second. The deck screen owns the actual launch
                so the loadout is always confirmed against the map it plays on. */}
            <PixelButton
              variant="primary"
              size="lg"
              icon="▶"
              emphasis
              onClick={() =>
                navigate('deckSelect', { next: { mode, mapId: selected, roomCode, difficulty } })
              }
            >
              Choose Deck
            </PixelButton>
          </>
        }
      >
        <div className="grid gap-3 pb-4 md:grid-cols-3">
          {MAPS.map((map) => {
            const active = map.id === selected;
            return (
              <button
                key={map.id}
                type="button"
                onClick={() => setSelected(map.id)}
                aria-pressed={active}
                disabled={!map.unlocked}
                className={cn(
                  'bg-deep group relative flex flex-col overflow-hidden text-left',
                  'transition-transform duration-[90ms] ease-[steps(2,jump-none)]',
                  'hover:-translate-y-[2px] focus-visible:outline-2 focus-visible:outline-offset-[7px] focus-visible:outline-foam',
                  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
                  active ? 'pixel-border-active' : 'pixel-border',
                )}
              >
                {/* The preview *is* the map: the same 3D scene the match runs,
                    on a slow orbit. A flat water swatch made three different
                    places look like three shades of the same rectangle. */}
                <span className="relative block aspect-video w-full overflow-hidden">
                  <MapPreview3D map={map} className="absolute inset-0" />
                  {active && (
                    <span
                      aria-hidden
                      className="animate-pulse-glow absolute inset-0 shadow-[inset_0_0_0_3px_var(--color-surf)]"
                    />
                  )}
                  <span className="absolute top-1 left-1">
                    <PixelBadge tone={active ? 'surf' : 'neutral'}>
                      {active ? 'Selected' : 'Preview'}
                    </PixelBadge>
                  </span>
                </span>

                <span className="flex flex-1 flex-col gap-1 p-3">
                  <span className="text-sm font-bold tracking-[0.12em] uppercase">{map.name}</span>
                  <span className="text-surf text-[10px] tracking-[0.1em]">{map.tagline}</span>
                  <span className="text-mist/60 text-[10px] leading-snug">{map.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </ScreenFrame>
    </div>
  );
}
