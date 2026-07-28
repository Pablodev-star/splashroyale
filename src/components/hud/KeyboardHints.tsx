import type { AbilityCard, AbilitySlot } from '@/types/game';
import { KEYBINDS } from '@/game/input/keybinds';
import { KeyCap } from '@/components/ui/KeyCap';
import { cn } from '@/lib/cn';

export interface KeyboardHintsProps {
  abilities: Partial<Record<AbilitySlot, AbilityCard>>;
  className?: string;
}

/**
 * The keyboard legend along the bottom of a desktop match.
 *
 * This replaces a single run-on line of text ("WASD move · drag to turn ·
 * Space Water Jet · E …") where every key was prose. Prose does not survive a
 * glance mid-fight: the eye has to parse a sentence to find one binding. Drawn
 * as caps, each binding is a shape next to its name, and the ability names come
 * from the equipped deck so the legend says *Tsunami Kick*, not "attack 2".
 *
 * The two ability rows here are deliberately the same bindings the rail shows
 * on the left — both read `KEYBINDS`, so they cannot disagree.
 */
export function KeyboardHints({ abilities, className }: KeyboardHintsProps) {
  const hints: Array<{ cap: string; label: string }> = [
    { cap: 'WASD', label: 'Move' },
    { cap: 'Drag', label: 'Turn' },
    { cap: KEYBINDS.attack1.cap, label: abilities.attack1?.name ?? 'Attack 1' },
    { cap: KEYBINDS.attack2.cap, label: abilities.attack2?.name ?? 'Attack 2' },
    { cap: KEYBINDS.ultimate.cap, label: abilities.ultimate?.name ?? 'Ultimate' },
    { cap: KEYBINDS.dive.cap, label: 'Dive' },
    { cap: KEYBINDS.pause.cap, label: 'Pause' },
  ];

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-2 z-10 flex flex-wrap',
        'items-center justify-center gap-x-3 gap-y-1 px-3',
        className,
      )}
    >
      {hints.map((hint) => (
        <span key={hint.label} className="flex items-center gap-1">
          <KeyCap>{hint.cap}</KeyCap>
          <span className="text-mist/55 text-[9px] tracking-[0.12em] uppercase">{hint.label}</span>
        </span>
      ))}
    </div>
  );
}
