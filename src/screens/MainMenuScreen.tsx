import { WaterCanvas } from '@/components/water/WaterCanvas';
import { SplashRoyaleLogo } from '@/components/brand/SplashRoyaleLogo';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelPanel } from '@/components/ui/PixelPanel';
import { PixelBadge } from '@/components/ui/PixelBadge';
import { PixelBar } from '@/components/ui/PixelBar';
import { useNavigation } from '@/state/NavigationContext';
import { usePlayer } from '@/state/PlayerContext';
import { formatNumber } from '@/lib/format';

/** Rising bubbles: pure decoration, deterministic so it never re-randomises. */
const BUBBLES = [
  { left: '8%', size: 6, delay: '0s', duration: '4.2s' },
  { left: '21%', size: 4, delay: '1.4s', duration: '5.1s' },
  { left: '37%', size: 8, delay: '0.6s', duration: '3.6s' },
  { left: '58%', size: 5, delay: '2.2s', duration: '4.8s' },
  { left: '73%', size: 7, delay: '0.2s', duration: '4.0s' },
  { left: '88%', size: 4, delay: '1.8s', duration: '5.4s' },
];

export function MainMenuScreen() {
  const { navigate } = useNavigation();
  const { profile } = usePlayer();

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Animated water background (loop of waves, caustics and reflections). */}
      <WaterCanvas variant="background" pixelSize={7} fps={24} className="absolute inset-0" />

      {/* Depth vignette so the UI stays readable over the water. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,rgb(4_18_31_/_0.85)_0%,rgb(4_18_31_/_0.35)_40%,rgb(4_18_31_/_0.8)_100%)]"
      />

      {BUBBLES.map((bubble, index) => (
        <span
          key={index}
          aria-hidden
          className="animate-rise bg-foam/40 pointer-events-none absolute bottom-0"
          style={{
            left: bubble.left,
            width: bubble.size,
            height: bubble.size,
            animationDelay: bubble.delay,
            animationDuration: bubble.duration,
          }}
        />
      ))}

      <div className="relative flex h-full flex-col">
        {/* Top bar: currency and rank. */}
        <div className="stage flex items-start justify-between gap-2">
          <PixelPanel variant="raised" className="hidden sm:block" flush>
            <div className="flex items-center gap-3 px-3 py-2">
              <PixelBadge tone="surf">Lv {profile.level}</PixelBadge>
              <span className="text-[10px] tracking-[0.14em] uppercase">{profile.name}</span>
            </div>
          </PixelPanel>
          <div className="ml-auto flex items-center gap-2">
            <PixelBadge tone="gold" icon="◆" shimmer>
              {formatNumber(profile.gold)}
            </PixelBadge>
            <PixelBadge tone="neutral" icon="▲">
              {profile.elo} ELO
            </PixelBadge>
          </div>
        </div>

        {/* Centre: logo + primary actions. */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-4">
          <SplashRoyaleLogo size="lg" />

          <p className="text-mist/70 max-w-md text-center text-[10px] leading-relaxed tracking-[0.08em] sm:text-xs">
            Charge your water. Dive to survive. Collect the cards.
          </p>

          <nav className="flex w-full max-w-[320px] flex-col gap-2.5">
            <PixelButton
              size="lg"
              variant="primary"
              icon="▶"
              emphasis
              fullWidth
              onClick={() => navigate('modeSelect')}
            >
              Play
            </PixelButton>
            <PixelButton
              size="md"
              variant="secondary"
              icon="◈"
              fullWidth
              onClick={() => navigate('mapSelect', { mode: 'localBots' })}
            >
              Quick match vs bots
            </PixelButton>
            <PixelButton
              size="md"
              variant="secondary"
              icon="≈"
              fullWidth
              onClick={() => navigate('deckSelect', { next: null })}
            >
              Battle Deck
            </PixelButton>
            <PixelButton
              size="md"
              variant="gold"
              icon="▣"
              fullWidth
              onClick={() => navigate('shop')}
            >
              Card Packs
            </PixelButton>
            <PixelButton
              size="md"
              variant="secondary"
              icon="✦"
              fullWidth
              onClick={() => navigate('collection')}
            >
              Card Collection
            </PixelButton>
            <PixelButton
              size="sm"
              variant="ghost"
              icon="⚙"
              fullWidth
              onClick={() => navigate('settings')}
            >
              Settings
            </PixelButton>
          </nav>
        </div>

        {/* Bottom: profile progress. */}
        <div className="stage flex items-end justify-between gap-3">
          <PixelPanel variant="default" className="w-full max-w-[300px]" flush>
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] tracking-[0.16em] uppercase">Season progress</span>
                <span className="text-gold text-[10px] tabular-nums">
                  {profile.xpIntoLevel}/{profile.xpPerLevel} XP
                </span>
              </div>
              <PixelBar
                value={profile.xpIntoLevel / profile.xpPerLevel}
                tone="gold"
                segments={24}
                height="sm"
              />
            </div>
          </PixelPanel>
          <span className="text-mist/40 hidden text-[9px] tracking-[0.14em] uppercase sm:block">
            v0.1.0 · Block 1 UI
          </span>
        </div>
      </div>
    </div>
  );
}
