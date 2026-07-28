import type { AbilityCard } from '@/types/game';
import { CARD_IDS } from '@/data/cards';
import { cn } from '@/lib/cn';

/**
 * The picture on a card face (Block 8A).
 *
 * Every card used to show `SLOT_GLYPH[card.slot]` — one of three characters,
 * `≈` `✦` `★`, shared by every card in that slot. Twenty-six cards, three
 * pictures: the art told you which button the card sat on and nothing about
 * what pressing it would do, so the only way to tell Depth Charge from Bubble
 * Burst was to read the name.
 *
 * These are drawn as SVG rather than emoji or a font glyph for three reasons:
 * a glyph's shape is the font's choice and varies by platform, emoji are
 * full-colour and fight the rarity palette, and neither can be built *from*
 * what the ability does. Here the drawing is derived from the card's own
 * effect — a zone card draws a puddle, a mine draws a fused charge under a
 * countdown ring, a wave draws a breaking wall — so the image and the
 * behaviour cannot drift apart the way the description and the engine had.
 *
 * `currentColor` throughout, so the rarity colour the card already applies to
 * its frame and name carries into the art with no per-rarity variants.
 */

export interface CardArtProps {
  card: AbilityCard;
  className?: string;
}

/**
 * The 24x24 viewBox is deliberate: at the sizes cards render (a 40px well on a
 * small card), a coarse grid keeps strokes landing on whole pixels instead of
 * blurring across them, which is the same reason the rest of the game is
 * authored at low resolution and upscaled.
 */
const VIEW = 24;

/** One drawing per card id. Keyed by id, not by effect kind: two cards can */
/** share a shape and still need to look different. */
const ART: Record<string, () => React.ReactNode> = {
  /* --- attack 1: jets and shots --------------------------------------- */

  // A nozzle with a tightening cone of water. The plainest possible shot.
  waterJet: () => (
    <>
      <rect x="2" y="10" width="4" height="4" />
      <rect x="7" y="10" width="3" height="4" />
      <rect x="11" y="11" width="3" height="2" />
      <rect x="15" y="11" width="2" height="2" />
      <rect x="18" y="11" width="2" height="2" />
    </>
  ),

  // An open palm, fingers spread, with impact ticks — close range, no travel.
  palmSplash: () => (
    <>
      <rect x="8" y="9" width="7" height="8" />
      <rect x="8" y="6" width="2" height="4" />
      <rect x="11" y="5" width="2" height="5" />
      <rect x="14" y="6" width="2" height="4" />
      <rect x="17" y="8" width="2" height="2" />
      <rect x="19" y="11" width="2" height="2" />
      <rect x="17" y="14" width="2" height="2" />
    </>
  ),

  // One long unbroken lance: same nozzle, but the stream never breaks up.
  pressureJet: () => (
    <>
      <rect x="2" y="9" width="4" height="6" />
      <rect x="7" y="11" width="15" height="2" />
      <rect x="19" y="10" width="2" height="4" />
    </>
  ),

  // A shot skipping off a surface line — the bounces are the card.
  skipShot: () => (
    <>
      <rect x="1" y="17" width="22" height="1" />
      <rect x="2" y="13" width="2" height="2" />
      <rect x="6" y="15" width="2" height="2" />
      <rect x="9" y="11" width="2" height="2" />
      <rect x="13" y="15" width="2" height="2" />
      <rect x="16" y="9" width="2" height="2" />
      <rect x="20" y="13" width="2" height="2" />
    </>
  ),

  // One stream forking into three that spread as they go.
  splitStream: () => (
    <>
      <rect x="2" y="11" width="5" height="2" />
      <rect x="8" y="11" width="2" height="2" />
      <rect x="11" y="7" width="2" height="2" />
      <rect x="14" y="5" width="3" height="2" />
      <rect x="18" y="3" width="3" height="2" />
      <rect x="11" y="11" width="2" height="2" />
      <rect x="14" y="11" width="3" height="2" />
      <rect x="18" y="11" width="3" height="2" />
      <rect x="11" y="15" width="2" height="2" />
      <rect x="14" y="17" width="3" height="2" />
      <rect x="18" y="19" width="3" height="2" />
    </>
  ),

  // A thick beam with a bright core, emitter braced at the left.
  torrentLance: () => (
    <>
      <rect x="1" y="8" width="3" height="8" />
      <rect x="5" y="9" width="17" height="6" />
      <rect x="5" y="11" width="17" height="2" fill="#04121f" />
    </>
  ),

  // A lobbed pocket of brine bursting into a patch: arc, then puddle.
  brineTrap: () => (
    <>
      <rect x="2" y="14" width="2" height="2" />
      <rect x="5" y="10" width="2" height="2" />
      <rect x="8" y="7" width="2" height="2" />
      <rect x="11" y="6" width="2" height="2" />
      <rect x="14" y="8" width="2" height="2" />
      <rect x="6" y="17" width="14" height="2" />
      <rect x="8" y="15" width="10" height="2" />
      <rect x="11" y="13" width="4" height="2" />
    </>
  ),

  // A column erupting under a suspended figure — the target is held above it.
  leviathanSpout: () => (
    <>
      <rect x="10" y="1" width="4" height="3" />
      <rect x="9" y="5" width="6" height="2" />
      <rect x="10" y="8" width="4" height="12" />
      <rect x="7" y="12" width="3" height="8" />
      <rect x="14" y="12" width="3" height="8" />
      <rect x="4" y="20" width="16" height="2" />
    </>
  ),

  // A curling whip that bends back on itself — it does not travel straight.
  stormLash: () => (
    <>
      <rect x="2" y="4" width="2" height="2" />
      <rect x="4" y="6" width="2" height="2" />
      <rect x="6" y="8" width="4" height="2" />
      <rect x="10" y="10" width="4" height="2" />
      <rect x="14" y="12" width="2" height="2" />
      <rect x="16" y="14" width="2" height="3" />
      <rect x="13" y="17" width="3" height="2" />
      <rect x="10" y="15" width="3" height="2" />
      <rect x="8" y="17" width="2" height="2" />
    </>
  ),

  /* --- attack 2: kicks, traps and grabs -------------------------------- */

  // A boot and the shove it throws: narrow, hard, one direction.
  undertowKick: () => (
    <>
      <rect x="2" y="8" width="3" height="8" />
      <rect x="5" y="12" width="5" height="4" />
      <rect x="12" y="7" width="2" height="10" />
      <rect x="15" y="5" width="2" height="14" />
      <rect x="18" y="8" width="2" height="8" />
    </>
  ),

  // A wide fan of water: the same idea, but spread and pushing.
  splashShove: () => (
    <>
      <rect x="2" y="10" width="4" height="4" />
      <rect x="8" y="4" width="2" height="3" />
      <rect x="8" y="10" width="2" height="4" />
      <rect x="8" y="17" width="2" height="3" />
      <rect x="12" y="2" width="3" height="3" />
      <rect x="12" y="10" width="3" height="4" />
      <rect x="12" y="19" width="3" height="3" />
      <rect x="17" y="4" width="4" height="3" />
      <rect x="17" y="10" width="4" height="4" />
      <rect x="17" y="17" width="4" height="3" />
    </>
  ),

  // A cluster of bubbles rising toward a burst mark.
  bubbleBurst: () => (
    <>
      <rect x="10" y="2" width="4" height="2" />
      <rect x="8" y="4" width="2" height="2" />
      <rect x="14" y="4" width="2" height="2" />
      <rect x="4" y="9" width="4" height="4" />
      <rect x="10" y="11" width="5" height="5" />
      <rect x="16" y="8" width="3" height="3" />
      <rect x="6" y="17" width="3" height="3" />
      <rect x="17" y="16" width="4" height="4" />
    </>
  ),

  // A spiral current pulling inward — the arrows point at the centre.
  riptidePull: () => (
    <>
      <rect x="10" y="10" width="4" height="4" />
      <rect x="2" y="11" width="5" height="2" />
      <rect x="4" y="9" width="2" height="2" />
      <rect x="4" y="13" width="2" height="2" />
      <rect x="17" y="11" width="5" height="2" />
      <rect x="18" y="9" width="2" height="2" />
      <rect x="18" y="13" width="2" height="2" />
      <rect x="11" y="2" width="2" height="5" />
      <rect x="11" y="17" width="2" height="5" />
    </>
  ),

  // A green slick with weed fronds: the only card art that is a *place*.
  algaeBloom: () => (
    <>
      <rect x="3" y="14" width="18" height="6" />
      <rect x="5" y="12" width="14" height="2" />
      <rect x="6" y="7" width="2" height="5" />
      <rect x="10" y="5" width="2" height="7" />
      <rect x="15" y="8" width="2" height="4" />
      <rect x="8" y="9" width="2" height="2" />
      <rect x="13" y="7" width="2" height="2" />
    </>
  ),

  // A sinking charge with a fuse and its blast ring below.
  depthCharge: () => (
    <>
      <rect x="9" y="2" width="2" height="3" />
      <rect x="11" y="4" width="2" height="2" />
      <rect x="8" y="6" width="8" height="7" />
      <rect x="10" y="8" width="4" height="3" fill="#04121f" />
      <rect x="2" y="17" width="4" height="2" />
      <rect x="7" y="19" width="10" height="2" />
      <rect x="18" y="17" width="4" height="2" />
    </>
  ),

  // A ring of water thrown outward from a spinning centre.
  whirlKick: () => (
    <>
      <rect x="10" y="10" width="4" height="4" />
      <rect x="9" y="4" width="6" height="2" />
      <rect x="9" y="18" width="6" height="2" />
      <rect x="4" y="9" width="2" height="6" />
      <rect x="18" y="9" width="2" height="6" />
      <rect x="6" y="6" width="2" height="2" />
      <rect x="16" y="6" width="2" height="2" />
      <rect x="6" y="16" width="2" height="2" />
      <rect x="16" y="16" width="2" height="2" />
    </>
  ),

  // A breaking wall with a curling lip — unmistakably the big one.
  tsunamiKick: () => (
    <>
      <rect x="2" y="16" width="20" height="6" />
      <rect x="4" y="12" width="18" height="4" />
      <rect x="8" y="8" width="14" height="4" />
      <rect x="12" y="4" width="10" height="4" />
      <rect x="10" y="2" width="6" height="2" />
      <rect x="7" y="4" width="4" height="2" />
      <rect x="5" y="7" width="3" height="2" />
    </>
  ),

  // A tentacle coming up out of the dark, curling over.
  abyssalGrasp: () => (
    <>
      <rect x="9" y="18" width="6" height="4" />
      <rect x="10" y="12" width="4" height="6" />
      <rect x="10" y="8" width="4" height="4" />
      <rect x="12" y="5" width="5" height="3" />
      <rect x="16" y="7" width="3" height="4" />
      <rect x="6" y="14" width="3" height="2" />
      <rect x="4" y="10" width="2" height="4" />
      <rect x="15" y="14" width="3" height="2" />
      <rect x="18" y="15" width="2" height="4" />
    </>
  ),

  /* --- ultimates -------------------------------------------------------- */

  // Concentric rings rolling outward from a centre.
  swell: () => (
    <>
      <rect x="10" y="10" width="4" height="4" />
      <rect x="6" y="6" width="12" height="2" />
      <rect x="6" y="16" width="12" height="2" />
      <rect x="6" y="8" width="2" height="8" />
      <rect x="16" y="8" width="2" height="8" />
      <rect x="2" y="2" width="20" height="2" />
      <rect x="2" y="20" width="20" height="2" />
      <rect x="2" y="4" width="2" height="16" />
      <rect x="20" y="4" width="2" height="16" />
    </>
  ),

  // A figure flat out over an impact splash.
  bellyFlop: () => (
    <>
      <rect x="7" y="3" width="10" height="4" />
      <rect x="5" y="5" width="2" height="2" />
      <rect x="17" y="5" width="2" height="2" />
      <rect x="2" y="16" width="4" height="3" />
      <rect x="7" y="14" width="4" height="5" />
      <rect x="13" y="14" width="4" height="5" />
      <rect x="18" y="16" width="4" height="3" />
      <rect x="2" y="20" width="20" height="2" />
    </>
  ),

  // A single wall sweeping right, with speed lines behind it.
  tidalSurge: () => (
    <>
      <rect x="12" y="4" width="6" height="18" />
      <rect x="18" y="2" width="4" height="20" />
      <rect x="12" y="2" width="6" height="2" />
      <rect x="2" y="7" width="8" height="2" />
      <rect x="4" y="12" width="6" height="2" />
      <rect x="2" y="17" width="8" height="2" />
    </>
  ),

  // A cloud sitting on a waterline, with drips falling out of it.
  chlorineCloud: () => (
    <>
      <rect x="5" y="6" width="14" height="6" />
      <rect x="3" y="8" width="2" height="4" />
      <rect x="19" y="8" width="2" height="4" />
      <rect x="8" y="4" width="8" height="2" />
      <rect x="6" y="14" width="2" height="3" />
      <rect x="11" y="14" width="2" height="4" />
      <rect x="16" y="14" width="2" height="3" />
      <rect x="2" y="20" width="20" height="2" />
    </>
  ),

  // A funnel: wide at the top, narrowing to a hole.
  maelstrom: () => (
    <>
      <rect x="2" y="3" width="20" height="3" />
      <rect x="4" y="7" width="16" height="3" />
      <rect x="6" y="11" width="12" height="3" />
      <rect x="8" y="15" width="8" height="3" />
      <rect x="10" y="19" width="4" height="3" />
      <rect x="13" y="7" width="4" height="3" fill="#04121f" />
      <rect x="9" y="11" width="4" height="3" fill="#04121f" />
    </>
  ),

  // Three columns of different heights erupting off a floor line.
  geyserField: () => (
    <>
      <rect x="2" y="20" width="20" height="2" />
      <rect x="3" y="10" width="4" height="10" />
      <rect x="2" y="7" width="6" height="3" />
      <rect x="10" y="4" width="4" height="16" />
      <rect x="9" y="1" width="6" height="3" />
      <rect x="17" y="13" width="4" height="7" />
      <rect x="16" y="10" width="6" height="3" />
    </>
  ),

  // A spiral of storm bands around a clear eye.
  hurricane: () => (
    <>
      <rect x="10" y="10" width="4" height="4" />
      <rect x="4" y="4" width="8" height="2" />
      <rect x="4" y="6" width="2" height="5" />
      <rect x="12" y="18" width="8" height="2" />
      <rect x="18" y="13" width="2" height="5" />
      <rect x="15" y="6" width="5" height="2" />
      <rect x="18" y="8" width="2" height="3" />
      <rect x="4" y="16" width="5" height="2" />
      <rect x="4" y="13" width="2" height="3" />
    </>
  ),

  // Eyes and teeth surfacing out of the dark. The only face in the set.
  leviathanCall: () => (
    <>
      <rect x="4" y="18" width="16" height="4" />
      <rect x="6" y="14" width="12" height="4" />
      <rect x="7" y="15" width="3" height="3" fill="#04121f" />
      <rect x="14" y="15" width="3" height="3" fill="#04121f" />
      <rect x="6" y="12" width="2" height="2" />
      <rect x="11" y="10" width="2" height="4" />
      <rect x="16" y="12" width="2" height="2" />
      <rect x="8" y="19" width="2" height="2" fill="#04121f" />
      <rect x="12" y="19" width="2" height="2" fill="#04121f" />
      <rect x="16" y="19" width="2" height="2" fill="#04121f" />
    </>
  ),
};

/**
 * Fallback for a card with no drawing yet: the effect's shape rather than the
 * slot's, so a new card is at least categorised correctly before someone
 * draws it. Never reached today — `validateCardArt` fails the build's dev
 * check if any card is missing.
 */
const BY_KIND: Record<string, () => React.ReactNode> = {
  projectile: ART.waterJet,
  melee: ART.undertowKick,
  burst: ART.swell,
  zone: ART.algaeBloom,
  wave: ART.tidalSurge,
  beam: ART.torrentLance,
  mine: ART.depthCharge,
  geysers: ART.geyserField,
  grab: ART.abyssalGrasp,
};

export function CardArt({ card, className }: CardArtProps) {
  const draw = ART[card.id] ?? BY_KIND[card.effect.kind] ?? ART.waterJet;
  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className={cn('h-full w-full', className)}
      fill="currentColor"
      // Nearest-neighbour upscaling, so the deliberately coarse grid stays
      // crisp instead of being smoothed into the vector art it technically is.
      style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
      aria-hidden
    >
      {draw()}
    </svg>
  );
}

/**
 * Dev-only: every card in the catalogue must have its own drawing.
 *
 * The whole point of this module is that a card is identifiable by its
 * picture, which a silent fallback would quietly undo — two cards sharing the
 * `BY_KIND` drawing look identical again, and nothing would say so.
 */
export function validateCardArt(ids: string[]): void {
  const missing = ids.filter((id) => !ART[id]);
  if (missing.length > 0) {
    console.error(
      `[card art] ${missing.length} card(s) fall back to a generic drawing: ${missing.join(', ')}`,
    );
  }
}

if (import.meta.env.DEV) validateCardArt(CARD_IDS);
