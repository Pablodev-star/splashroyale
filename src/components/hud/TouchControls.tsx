import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export interface TouchControlsProps {
  /** Normalised stick vector, -1..1 on both axes. (0,0) when released. */
  onMove?: (x: number, y: number) => void;
  onAttackDown?: () => void;
  onAttackUp?: () => void;
  onKick?: () => void;
  onDiveToggle?: () => void;
  /** Equipped attack-1 name (Block 3B). Falls back to the generic label. */
  attackLabel?: string;
  /** Equipped attack-2 name — the pad the deck's second attack sits on. */
  kickLabel?: string;
  submerged?: boolean;
  /** Mirrors the layout for left-handed players (Settings). */
  mirrored?: boolean;
  className?: string;
}

/**
 * Touch layer for phones: pixel joystick plus three action pads.
 *
 * This is the input *surface* only — it reports intent through callbacks. Block 3
 * owns what those intents do.
 */
export function TouchControls({
  onMove,
  onAttackDown,
  onAttackUp,
  onKick,
  onDiveToggle,
  attackLabel = 'Attack',
  kickLabel = 'Kick',
  submerged = false,
  mirrored = false,
  className,
}: TouchControlsProps) {
  const stickRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const element = stickRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const half = rect.width / 2;
      const dx = Math.max(-1, Math.min(1, (clientX - (rect.left + half)) / half));
      const dy = Math.max(-1, Math.min(1, (clientY - (rect.top + half)) / half));
      setKnob({ x: dx, y: dy });
      onMove?.(dx, dy);
    },
    [onMove],
  );

  const release = useCallback(() => {
    setKnob({ x: 0, y: 0 });
    onMove?.(0, 0);
  }, [onMove]);

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-3',
        mirrored && 'flex-row-reverse',
        className,
      )}
    >
      {/* Joystick */}
      <div
        ref={stickRef}
        role="application"
        aria-label="Movement stick"
        className="bg-abyss/70 pixel-border-thin pointer-events-auto relative h-28 w-28 touch-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromPointer(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            updateFromPointer(event.clientX, event.clientY);
          }
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span aria-hidden className="bg-ocean absolute inset-x-0 top-1/2 h-[2px]" />
        <span aria-hidden className="bg-ocean absolute inset-y-0 left-1/2 w-[2px]" />
        <span
          aria-hidden
          className="bg-surf pixel-bevel absolute h-10 w-10"
          style={{
            left: `calc(50% + ${knob.x * 32}px)`,
            top: `calc(50% + ${knob.y * 32}px)`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      {/* Action pads. Fixed width so an equipped ability with a long name
          relabels the pad without moving the pads under the player's thumb. */}
      <div className="pointer-events-auto grid w-[176px] shrink-0 grid-cols-2 gap-2">
        <ActionPad label={kickLabel} glyph="✦" onPress={onKick} tone="secondary" />
        <ActionPad
          label={submerged ? 'Surface' : 'Dive'}
          glyph={submerged ? '^' : 'v'}
          onPress={onDiveToggle}
          tone={submerged ? 'oxygen' : 'secondary'}
        />
        <ActionPad
          label={attackLabel}
          glyph="≈"
          onPressStart={onAttackDown}
          onPressEnd={onAttackUp}
          tone="primary"
          className="col-span-2"
        />
      </div>
    </div>
  );
}

interface ActionPadProps {
  label: string;
  glyph: string;
  tone: 'primary' | 'secondary' | 'oxygen';
  onPress?: () => void;
  onPressStart?: () => void;
  onPressEnd?: () => void;
  className?: string;
}

const PAD_TONE = {
  primary: 'bg-surf text-abyss',
  secondary: 'bg-ocean text-mist',
  oxygen: 'bg-oxygen text-abyss',
} as const;

function ActionPad({
  label,
  glyph,
  tone,
  onPress,
  onPressStart,
  onPressEnd,
  className,
}: ActionPadProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={onPressStart}
      onPointerUp={onPressEnd}
      onPointerCancel={onPressEnd}
      onClick={onPress}
      className={cn(
        'pixel-border-thin flex h-14 min-w-0 touch-none flex-col items-center justify-center',
        'transition-transform duration-[90ms] ease-[steps(2,jump-none)] active:translate-y-[2px]',
        PAD_TONE[tone],
        className,
      )}
    >
      <span className="text-base leading-none font-bold">{glyph}</span>
      <span className="max-w-full truncate px-1 text-[8px] tracking-[0.14em] uppercase">
        {label}
      </span>
    </button>
  );
}
