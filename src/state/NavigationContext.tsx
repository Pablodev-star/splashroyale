import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Route, RouteParams, ScreenId, TransitionKind } from '@/types/game';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Exit runs before the incoming screen mounts (STYLEGUIDE §5). */
export const EXIT_MS = 180;
export const ENTER_MS = 260;

/**
 * `navigate('mainMenu')` for param-less screens, `navigate('match', { ... })`
 * where params are required — enforced by the compiler.
 */
type NavigateArgs<K extends ScreenId> = RouteParams[K] extends undefined
  ? [params?: undefined, transition?: TransitionKind]
  : [params: RouteParams[K], transition?: TransitionKind];

interface NavigationValue {
  route: Route;
  /** Which animation the current screen should play. */
  transition: TransitionKind;
  phase: 'idle' | 'exiting';
  /** Increments on every committed navigation; used as the screen React key. */
  routeKey: number;
  canGoBack: boolean;
  navigate: <K extends ScreenId>(screen: K, ...args: NavigateArgs<K>) => void;
  /** Replaces the top of the stack instead of pushing. */
  replace: <K extends ScreenId>(screen: K, ...args: NavigateArgs<K>) => void;
  back: () => void;
  /** Clears the stack back to the main menu. */
  home: () => void;
}

const NavigationContext = createContext<NavigationValue | null>(null);

const INITIAL_ROUTE: Route = { screen: 'mainMenu', params: undefined };

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([INITIAL_ROUTE]);
  const [transition, setTransition] = useState<TransitionKind>('fade');
  const [phase, setPhase] = useState<'idle' | 'exiting'>('idle');
  const [routeKey, setRouteKey] = useState(0);
  const timerRef = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  /** Plays the exit animation, then commits the stack change. */
  const run = useCallback(
    (kind: TransitionKind, commit: (stack: Route[]) => Route[]) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setTransition(kind);
      setPhase('exiting');
      const delay = reducedMotion ? 0 : EXIT_MS;
      timerRef.current = window.setTimeout(() => {
        setStack(commit);
        setRouteKey((key) => key + 1);
        setPhase('idle');
        timerRef.current = null;
      }, delay);
    },
    [reducedMotion],
  );

  const navigate = useCallback(
    <K extends ScreenId>(screen: K, ...args: NavigateArgs<K>) => {
      const [params, kind] = args as [RouteParams[K], TransitionKind | undefined];
      run(kind ?? 'slideForward', (current) => [...current, { screen, params } as Route]);
    },
    [run],
  );

  const replace = useCallback(
    <K extends ScreenId>(screen: K, ...args: NavigateArgs<K>) => {
      const [params, kind] = args as [RouteParams[K], TransitionKind | undefined];
      run(kind ?? 'fade', (current) => [...current.slice(0, -1), { screen, params } as Route]);
    },
    [run],
  );

  const back = useCallback(() => {
    run('slideBack', (current) => (current.length > 1 ? current.slice(0, -1) : current));
  }, [run]);

  const home = useCallback(() => {
    run('fade', () => [INITIAL_ROUTE]);
  }, [run]);

  const value = useMemo<NavigationValue>(
    () => ({
      route: stack[stack.length - 1],
      transition,
      phase,
      routeKey,
      canGoBack: stack.length > 1,
      navigate,
      replace,
      back,
      home,
    }),
    [stack, transition, phase, routeKey, navigate, replace, back, home],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationValue {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('useNavigation must be used inside <NavigationProvider>');
  return context;
}
