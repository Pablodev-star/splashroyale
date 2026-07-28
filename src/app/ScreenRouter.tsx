import { ScreenTransition } from '@/components/ui/ScreenTransition';
import { useNavigation } from '@/state/NavigationContext';
import { MainMenuScreen } from '@/screens/MainMenuScreen';
import { ModeSelectScreen } from '@/screens/ModeSelectScreen';
import { MapSelectScreen } from '@/screens/MapSelectScreen';
import { DeckScreen } from '@/screens/DeckScreen';
import { MatchmakingScreen } from '@/screens/MatchmakingScreen';
import { RoomLobbyScreen } from '@/screens/RoomLobbyScreen';
import { MatchScreen } from '@/screens/MatchScreen';
import { ResultScreen } from '@/screens/ResultScreen';
import { ShopScreen } from '@/screens/ShopScreen';
import { PackPreviewScreen } from '@/screens/PackPreviewScreen';
import { CollectionScreen } from '@/screens/CollectionScreen';
import { CardDetailScreen } from '@/screens/CardDetailScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import type { Route } from '@/types/game';

/**
 * Single place that maps a route to a screen. Screens never import each other;
 * they navigate through `useNavigation()` (ARCHITECTURE.md §4.2).
 */
export function ScreenRouter() {
  const { route, transition, phase, routeKey } = useNavigation();

  return (
    <ScreenTransition key={routeKey} kind={transition} phase={phase}>
      {renderScreen(route)}
    </ScreenTransition>
  );
}

function renderScreen(route: Route) {
  switch (route.screen) {
    case 'mainMenu':
      return <MainMenuScreen />;
    case 'modeSelect':
      return <ModeSelectScreen />;
    case 'mapSelect':
      return <MapSelectScreen mode={route.params.mode} roomCode={route.params.roomCode} />;
    case 'deckSelect':
      return <DeckScreen next={route.params.next} />;
    case 'matchmaking':
      return <MatchmakingScreen mapId={route.params.mapId} />;
    case 'roomLobby':
      return <RoomLobbyScreen roomCode={route.params.roomCode} isHost={route.params.isHost} />;
    case 'match':
      return (
        <MatchScreen
          mode={route.params.mode}
          mapId={route.params.mapId}
          roomCode={route.params.roomCode}
        />
      );
    case 'result':
      return (
        <ResultScreen
          mode={route.params.mode}
          mapId={route.params.mapId}
          outcome={route.params.outcome}
          roomCode={route.params.roomCode}
        />
      );
    case 'shop':
      return <ShopScreen />;
    case 'packPreview':
      return <PackPreviewScreen packId={route.params.packId} />;
    case 'collection':
      return <CollectionScreen />;
    case 'cardDetail':
      return <CardDetailScreen cardId={route.params.cardId} />;
    case 'settings':
      return <SettingsScreen />;
    default: {
      // Exhaustiveness guard: adding a ScreenId without a case fails the build.
      const never: never = route;
      return never;
    }
  }
}
