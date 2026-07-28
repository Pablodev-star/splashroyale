import type { Pack } from '@/types/game';

/**
 * Wrapper illustrations for the pack faces (Block 8B).
 *
 * A pack face used to be a flat colour, three concentric rings and one
 * character — `≈`, `✦`, `◈` or `★` — at 72px. Four packs that differed only in
 * hue and glyph, which is a swatch rather than a wrapper: nothing about the
 * Reef Pack said reef, and the tier you were buying was carried entirely by
 * the price.
 *
 * Each pack now gets a scene built from its own three-colour palette, so the
 * art stays keyed to the pack's identity without needing per-pack colour
 * decisions. Rects only, `crispEdges`, drawn on a coarse grid: these are
 * upscaled a long way on the hero pack and any curve would turn to mush.
 *
 * The viewBox is 100x130 — the wrapper's proportions — so the illustration is
 * composed for the shape it actually appears in rather than being a square
 * dropped into a tall box.
 */

export interface PackArtProps {
  pack: Pack;
  className?: string;
}

const VIEW = { w: 100, h: 130 };

/** Palette shorthand: base is the wrapper, so art uses shade/accent + neutrals. */
interface Palette {
  shade: string;
  accent: string;
  ink: string;
  paper: string;
}

const SCENES: Record<string, (p: Palette) => React.ReactNode> = {
  /* A lane of open water seen from the side: three wave bands, a diver going
     in, and the spray they throw. The plainest pack, so the plainest scene. */
  splashPack: (p) => (
    <>
      {/* Sky/water divide, so the diver has somewhere to enter. */}
      <rect x="0" y="62" width="100" height="68" fill={p.shade} />

      {/* Diver: a compact figure mid-entry, arms first. */}
      <rect x="46" y="18" width="10" height="12" fill={p.paper} />
      <rect x="44" y="30" width="14" height="18" fill={p.accent} />
      <rect x="38" y="34" width="8" height="5" fill={p.paper} />
      <rect x="56" y="34" width="8" height="5" fill={p.paper} />
      <rect x="46" y="48" width="4" height="12" fill={p.paper} />
      <rect x="52" y="48" width="4" height="12" fill={p.paper} />

      {/* Entry splash: a crown of droplets around the impact point. */}
      <rect x="34" y="56" width="6" height="4" fill={p.paper} />
      <rect x="62" y="56" width="6" height="4" fill={p.paper} />
      <rect x="26" y="50" width="4" height="4" fill={p.accent} />
      <rect x="72" y="50" width="4" height="4" fill={p.accent} />
      <rect x="18" y="58" width="4" height="4" fill={p.accent} />
      <rect x="80" y="58" width="4" height="4" fill={p.accent} />

      {/* Wave bands, offset so they read as separate crests. */}
      <rect x="0" y="66" width="34" height="5" fill={p.accent} />
      <rect x="42" y="66" width="58" height="5" fill={p.accent} />
      <rect x="12" y="80" width="76" height="5" fill={p.accent} />
      <rect x="0" y="94" width="46" height="5" fill={p.accent} />
      <rect x="56" y="94" width="44" height="5" fill={p.accent} />
      <rect x="20" y="108" width="60" height="5" fill={p.accent} />
    </>
  ),

  /* The lifeguard's chair, a ring buoy and a whistle — the pack that promises
     a rare is the one with someone watching the pool. */
  lifeguardPack: (p) => (
    <>
      <rect x="0" y="86" width="100" height="44" fill={p.shade} />

      {/* Tower: platform, legs, and the flag above it. */}
      <rect x="34" y="34" width="32" height="8" fill={p.ink} />
      <rect x="36" y="20" width="6" height="14" fill={p.ink} />
      <rect x="42" y="14" width="18" height="7" fill={p.accent} />
      <rect x="30" y="42" width="7" height="46" fill={p.ink} />
      <rect x="63" y="42" width="7" height="46" fill={p.ink} />
      <rect x="37" y="60" width="26" height="5" fill={p.ink} />

      {/* Ring buoy leaning against the tower — quartered like a real one. */}
      <rect x="8" y="60" width="20" height="20" fill={p.paper} />
      <rect x="12" y="64" width="12" height="12" fill={p.shade} />
      <rect x="8" y="60" width="10" height="10" fill={p.ink} />
      <rect x="18" y="70" width="10" height="10" fill={p.ink} />
      <rect x="12" y="64" width="12" height="12" fill={p.shade} />

      {/* Whistle on its cord. */}
      <rect x="76" y="52" width="14" height="9" fill={p.paper} />
      <rect x="72" y="55" width="4" height="4" fill={p.paper} />
      <rect x="82" y="44" width="3" height="9" fill={p.ink} />

      <rect x="0" y="96" width="40" height="4" fill={p.accent} />
      <rect x="52" y="96" width="48" height="4" fill={p.accent} />
      <rect x="14" y="112" width="72" height="4" fill={p.accent} />
    </>
  ),

  /* Coral fans and a fish, on a dark reef floor. Busier than the two below it
     in price, because an epic-odds pack should look like more. */
  reefPack: (p) => (
    <>
      <rect x="0" y="72" width="100" height="58" fill={p.shade} />

      {/* Branching coral, left. */}
      <rect x="14" y="46" width="8" height="42" fill={p.accent} />
      <rect x="6" y="54" width="8" height="8" fill={p.accent} />
      <rect x="2" y="62" width="6" height="20" fill={p.accent} />
      <rect x="22" y="38" width="7" height="10" fill={p.accent} />
      <rect x="27" y="46" width="6" height="26" fill={p.accent} />

      {/* Fan coral, right. */}
      <rect x="74" y="52" width="8" height="36" fill={p.paper} />
      <rect x="66" y="44" width="7" height="12" fill={p.paper} />
      <rect x="82" y="44" width="7" height="12" fill={p.paper} />
      <rect x="70" y="36" width="17" height="7" fill={p.paper} />

      {/* Fish crossing the middle. */}
      <rect x="40" y="54" width="20" height="11" fill={p.paper} />
      <rect x="34" y="57" width="6" height="6" fill={p.paper} />
      <rect x="60" y="50" width="7" height="19" fill={p.accent} />
      <rect x="44" y="57" width="4" height="4" fill={p.ink} />

      {/* Bubbles rising off the coral. */}
      <rect x="20" y="24" width="5" height="5" fill={p.paper} />
      <rect x="30" y="14" width="4" height="4" fill={p.paper} />
      <rect x="78" y="22" width="4" height="4" fill={p.paper} />
      <rect x="86" y="12" width="3" height="3" fill={p.paper} />

      <rect x="0" y="84" width="100" height="4" fill={p.ink} />
    </>
  ),

  /* Something very large surfacing: one eye, a mouth of teeth, and tentacles
     reaching past the edges of the wrapper. The top pack looks like a threat. */
  leviathanPack: (p) => (
    <>
      <rect x="0" y="78" width="100" height="52" fill={p.shade} />

      {/* Tentacles, deliberately running off both sides so the creature reads
          as bigger than the wrapper can hold. */}
      <rect x="0" y="58" width="14" height="9" fill={p.ink} />
      <rect x="12" y="50" width="10" height="9" fill={p.ink} />
      <rect x="20" y="42" width="9" height="9" fill={p.ink} />
      <rect x="26" y="34" width="8" height="9" fill={p.ink} />
      <rect x="86" y="58" width="14" height="9" fill={p.ink} />
      <rect x="78" y="50" width="10" height="9" fill={p.ink} />
      <rect x="71" y="42" width="9" height="9" fill={p.ink} />
      <rect x="66" y="34" width="8" height="9" fill={p.ink} />

      {/* Head breaking the surface. */}
      <rect x="30" y="46" width="40" height="34" fill={p.ink} />
      <rect x="26" y="56" width="4" height="24" fill={p.ink} />
      <rect x="70" y="56" width="4" height="24" fill={p.ink} />

      {/* One enormous eye. */}
      <rect x="38" y="54" width="24" height="14" fill={p.accent} />
      <rect x="46" y="56" width="9" height="10" fill={p.ink} />

      {/* Teeth along the jaw. */}
      <rect x="34" y="72" width="5" height="7" fill={p.paper} />
      <rect x="43" y="72" width="5" height="9" fill={p.paper} />
      <rect x="52" y="72" width="5" height="9" fill={p.paper} />
      <rect x="61" y="72" width="5" height="7" fill={p.paper} />

      {/* Churned water at the waterline. */}
      <rect x="0" y="88" width="30" height="5" fill={p.accent} />
      <rect x="38" y="88" width="26" height="5" fill={p.accent} />
      <rect x="72" y="88" width="28" height="5" fill={p.accent} />
      <rect x="10" y="102" width="80" height="5" fill={p.accent} />
      <rect x="0" y="116" width="44" height="5" fill={p.accent} />
      <rect x="54" y="116" width="46" height="5" fill={p.accent} />
    </>
  ),
};

/**
 * Starburst rays behind the illustration.
 *
 * Cheap depth that a flat colour cannot give: eight wedges radiating from
 * behind the subject, in the accent at low opacity. Drawn as triangles rather
 * than rects — the one place a diagonal is allowed here, because a "ray" made
 * of axis-aligned blocks reads as a staircase.
 */
function Rays({ colour }: { colour: string }) {
  const cx = VIEW.w / 2;
  const cy = 62;
  return (
    <g opacity="0.16" fill={colour}>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const spread = 0.16;
        const r = 150;
        const x1 = cx + Math.cos(a - spread) * r;
        const y1 = cy + Math.sin(a - spread) * r;
        const x2 = cx + Math.cos(a + spread) * r;
        const y2 = cy + Math.sin(a + spread) * r;
        return <polygon key={i} points={`${cx},${cy} ${x1},${y1} ${x2},${y2}`} />;
      })}
    </g>
  );
}

export function PackArt({ pack, className }: PackArtProps) {
  const palette: Palette = {
    shade: pack.art.shade,
    accent: pack.art.accent,
    ink: '#04121f',
    paper: '#ffffff',
  };
  const scene = SCENES[pack.id] ?? SCENES.splashPack;

  return (
    <svg
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      className={className}
      preserveAspectRatio="xMidYMid slice"
      style={{ shapeRendering: 'crispEdges' }}
      aria-hidden
    >
      {/* Rays sit behind everything, including the water, so they read as light
          through the wrapper rather than as objects in the scene. */}
      <Rays colour={pack.art.accent} />
      {scene(palette)}
    </svg>
  );
}

/** Dev-only: a pack without its own scene falls back and looks like another. */
export function validatePackArt(ids: string[]): void {
  const missing = ids.filter((id) => !SCENES[id]);
  if (missing.length > 0) {
    console.error(`[pack art] no scene for: ${missing.join(', ')}`);
  }
}
