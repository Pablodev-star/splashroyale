import { useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';

/**
 * Which control surface a match should show.
 *
 * `touch` means on-screen stick and pads, `keyboard` means WASD and keycap
 * hints. This is a capability question, not a size question — and getting that
 * wrong is what made the game unplayable on tablets.
 *
 * The match screen used to gate the touch layer behind Tailwind's `md:hidden`,
 * i.e. "narrower than 768px". A tablet in landscape is wider than that, so it
 * was served the desktop layout: no joystick, no pads, and no keyboard to fall
 * back on. The player could turn the camera and nothing else.
 *
 * Width never answered the right question. What matters is whether the device
 * can point precisely (a mouse or trackpad) and whether a physical keyboard is
 * there to press. `(pointer: coarse)` is exactly the first question, and it is
 * true for phones and tablets and false for desktops and laptops, whatever
 * their resolution. `(any-pointer: fine)` catches the mixed cases — a tablet
 * with a trackpad case, a touchscreen laptop — where a precise pointer exists
 * alongside the touchscreen.
 */
export type InputMode = 'touch' | 'keyboard';

/**
 * Coarse pointer *and* no fine pointer anywhere: a device driven by fingers
 * only. A touchscreen laptop reports `any-pointer: fine` too (its trackpad),
 * so it correctly stays on the keyboard layout while still accepting taps.
 */
const TOUCH_QUERY = '(pointer: coarse) and (not (any-pointer: fine))';

function detect(): InputMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'keyboard';
  return window.matchMedia(TOUCH_QUERY).matches ? 'touch' : 'keyboard';
}

/**
 * The detected control surface, kept live.
 *
 * It re-evaluates on change because the answer genuinely changes at runtime:
 * attaching a keyboard case to an iPad, or docking a laptop, flips it without
 * a reload.
 */
export function useDetectedInputMode(): InputMode {
  const [mode, setMode] = useState<InputMode>(detect);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(TOUCH_QUERY);
    const onChange = () => setMode(detect());
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return mode;
}

/**
 * The control surface to actually use: the player's choice when they made one,
 * the detected answer otherwise.
 *
 * Note this returns one mode rather than two booleans. Both surfaces being
 * shown at once was never wanted, and both being hidden is the bug this
 * replaces — a single value cannot express either.
 */
export function useInputMode(): InputMode {
  const { settings } = useSettings();
  const detected = useDetectedInputMode();
  return settings.controlScheme === 'auto' ? detected : settings.controlScheme;
}
