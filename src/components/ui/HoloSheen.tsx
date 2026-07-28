import { cn } from '@/lib/cn';

export interface HoloSheenProps {
  /** Legendary and mythic get the multi-hued band. */
  rainbow?: boolean;
  /** 0..1 strength of the whole sweep. */
  opacity?: number;
  className?: string;
}

/**
 * The moving glint on a card face or pack wrapper.
 *
 * One component so cards and packs cannot drift apart, and so the seamless-loop
 * construction lives in exactly one place: a track twice the face wide holds two
 * identical bands one face-width apart and shifts by exactly that distance per
 * cycle. The last frame is therefore pixel-identical to the first, and the next
 * band is always already on its way in — the sweep can never be cut short to
 * start another one.
 */
export function HoloSheen({ rainbow = false, opacity = 0.45, className }: HoloSheenProps) {
  const band = rainbow ? 'holo-band-rainbow' : 'holo-band';
  return (
    <span aria-hidden className={cn('holo-track', className)} style={{ opacity }}>
      <span className="holo-run">
        {/* One at the left edge, one exactly a face-width to its right. */}
        <span className={band} style={{ left: '0%' }} />
        <span className={band} style={{ left: '50%' }} />
      </span>
    </span>
  );
}
