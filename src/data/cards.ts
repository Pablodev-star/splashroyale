import type { AbilityCard, AbilitySlot, CardDefinition, CardProgress, Rarity } from '@/types/game';
import { MAX_CARD_LEVEL, copiesForNextLevel } from '@/game/progression/economy';

/**
 * The ability catalogue.
 *
 * Every card is a move you perform, not a passive buff, and every rarity covers
 * all three slots — commons carry the plain versions (a jet of water, a kick),
 * legendaries the spectacle (a hurricane). That symmetry is the balance rule:
 * because you can always field a legendary in every slot, rarity has to pay for
 * itself with a cost, not with exclusivity. Higher rarities hit harder but wait
 * longer, charge slower, or trade reach for damage.
 *
 * Definitions only. Level, copies and ownership are the *player's*, held in the
 * progression store and merged in by `resolveCard`.
 */
export const CARD_CATALOG: CardDefinition[] = [
  /* ---------------------------------------------------------------- common */
  {
    id: 'waterJet',
    name: 'Water Jet',
    slot: 'attack1',
    rarity: 'common',
    description: 'Hold to pressurise, release a straight jet of water.',
    flavour: 'The first thing anyone learns. Nothing fancy, always there.',
    ability: { damage: 14, cooldownS: 0.8, range: 7, chargeS: 0.9, tags: ['Charge'] },
    effect: { kind: 'projectile' },
    stat: { drives: 'damage', label: 'Jet damage', base: 14, perLevel: 2, unit: '' },
  },
  {
    id: 'palmSplash',
    name: 'Palm Splash',
    slot: 'attack1',
    rarity: 'common',
    description: 'A fast close-range slap of water. No charge, no wait.',
    flavour: 'For when the other one is already inside your reach.',
    ability: { damage: 9, cooldownS: 0.35, range: 2.5, chargeS: 0, tags: ['Instant'] },
    effect: { kind: 'melee', arcDeg: 110 },
    stat: { drives: 'damage', label: 'Slap damage', base: 9, perLevel: 1.5, unit: '' },
  },
  {
    id: 'undertowKick',
    name: 'Undertow Kick',
    slot: 'attack2',
    rarity: 'common',
    description: 'A kick that shoves the target back and drags submerged foes up.',
    flavour: 'The pool-fight classic. Cheap, rude, and it always lands.',
    ability: { damage: 11, cooldownS: 2.4, range: 2.2, chargeS: 0, tags: ['Knockback', 'Surfaces'] },
    effect: { kind: 'melee', arcDeg: 90, knockback: 7.5, hitsSubmerged: true },
    stat: { label: 'Kick force', base: 20, perLevel: 5, unit: '%' },
  },
  {
    id: 'splashShove',
    name: 'Splash Shove',
    slot: 'attack2',
    rarity: 'common',
    // A wide, weak cone whose point is displacement — distinct from the kick's
    // narrow, harder single hit. The two used to be the same melee call with
    // different numbers.
    description: 'Heave a wall of water forward, pushing everything in a wide cone.',
    flavour: 'More about where they end up than how much it hurts.',
    ability: { damage: 7, cooldownS: 1.8, range: 3.4, chargeS: 0, tags: ['Cone', 'Knockback'] },
    effect: { kind: 'melee', arcDeg: 170, knockback: 11 },
    stat: { label: 'Push distance', base: 2.5, perLevel: 0.4, unit: 'm' },
  },
  {
    id: 'swell',
    name: 'Swell',
    slot: 'ultimate',
    rarity: 'common',
    description: 'Raise a wave that rolls outward from you and knocks everyone back.',
    flavour: 'Not the biggest wave in the pool. Still enough to end an argument.',
    ability: { damage: 26, cooldownS: 45, range: 6, chargeS: 0, tags: ['Radial', 'Knockback'] },
    effect: { kind: 'burst', knockback: 9 },
    stat: { drives: 'damage', label: 'Wave damage', base: 26, perLevel: 4, unit: '' },
  },
  {
    id: 'bellyFlop',
    name: 'Belly Flop',
    slot: 'ultimate',
    rarity: 'common',
    // Reworked from a second plain radial into the anti-dive ultimate: it is
    // the one common that reaches a submerged opponent, which is what makes
    // picking it over Swell a decision rather than a coin toss.
    description: 'Leap and land flat. The shockwave reaches under the surface too.',
    flavour: 'Technically an ultimate. Emotionally, a decision.',
    ability: { damage: 30, cooldownS: 40, range: 3.5, chargeS: 1.2, tags: ['Leap', 'Anti-dive'] },
    effect: { kind: 'burst', knockback: 5, hitsSubmerged: true },
    stat: { drives: 'damage', label: 'Impact damage', base: 30, perLevel: 5, unit: '' },
  },

  /* ------------------------------------------------------------------ rare */
  {
    id: 'pressureJet',
    name: 'Pressure Jet',
    slot: 'attack1',
    rarity: 'rare',
    description: 'A tight, long-range jet that punches through the first target hit.',
    flavour: 'Thin as a wire and twice as far as it has any right to go.',
    ability: { damage: 19, cooldownS: 1.1, range: 11, chargeS: 1.2, tags: ['Charge', 'Piercing'] },
    effect: { kind: 'projectile', pierce: true, speed: 15 },
    stat: { drives: 'damage', label: 'Jet damage', base: 19, perLevel: 3, unit: '' },
  },
  {
    id: 'skipShot',
    name: 'Skip Shot',
    slot: 'attack1',
    rarity: 'rare',
    description: 'The shot skims off the surface, able to hit again after every bounce.',
    flavour: 'Aim at the water, not at them. It works, somehow.',
    ability: { damage: 13, cooldownS: 0.9, range: 9, chargeS: 0.6, tags: ['Bounces ×2'] },
    effect: { kind: 'projectile', bounces: 2, speed: 10 },
    stat: { label: 'Skim distance', base: 2, perLevel: 0.5, unit: 'm' },
  },
  {
    id: 'bubbleBurst',
    name: 'Bubble Burst',
    slot: 'attack2',
    rarity: 'rare',
    // Genuinely delayed now. The text always promised bubbles that "rise and
    // pop"; the engine used to resolve it instantly on cast.
    description: 'Release bubbles that rise for a moment, then pop under whoever is above.',
    flavour: 'Slow, obvious, and impossible to leave alone.',
    ability: { damage: 16, cooldownS: 3.2, range: 4.5, chargeS: 0, tags: ['Delayed', 'Area'] },
    effect: { kind: 'mine', fuseS: 1.1, radius: 2.6 },
    stat: { label: 'Bubbles', base: 4, perLevel: 1, unit: '' },
  },
  {
    id: 'riptidePull',
    name: 'Riptide Pull',
    slot: 'attack2',
    rarity: 'rare',
    description: 'Drag the nearest fighter to you along the current and hold them briefly.',
    flavour: 'The pool decides where they stand now, not them.',
    ability: { damage: 8, cooldownS: 4, range: 6.5, chargeS: 0.4, tags: ['Pull'] },
    effect: { kind: 'grab', holdS: 0.5, flavour: 'riptide', pullToSelf: true },
    stat: { label: 'Pull distance', base: 3, perLevel: 0.6, unit: 'm' },
  },
  {
    id: 'tidalSurge',
    name: 'Tidal Surge',
    slot: 'ultimate',
    rarity: 'rare',
    description: 'A wave crosses the whole arena in one direction. Dive and it passes over.',
    flavour: 'You do not aim it. You point yourself and let go.',
    ability: { damage: 34, cooldownS: 55, range: 16, chargeS: 0, tags: ['Arena-wide', 'Carries'] },
    effect: { kind: 'wave', speed: 11, width: 3.2, carrySpeed: 7, travel: 18 },
    stat: { drives: 'damage', label: 'Surge damage', base: 34, perLevel: 5, unit: '' },
  },
  {
    id: 'chlorineCloud',
    name: 'Chlorine Cloud',
    slot: 'ultimate',
    rarity: 'rare',
    // Now actually a lingering zone. It used to deal its whole number once, on
    // cast — indistinguishable from Swell despite the card promising otherwise.
    description: 'A cloud of chlorine settles on the water. It burns and slows anyone inside.',
    flavour: 'Nobody wins the fight in there. They just leave.',
    ability: { damage: 28, cooldownS: 50, range: 5, chargeS: 0, tags: ['Zone', 'Over time'] },
    effect: { kind: 'zone', flavour: 'chlorine', durationS: 6, dps: 9, slow: 0.66 },
    stat: { label: 'Cloud duration', base: 6, perLevel: 1, unit: 's' },
  },

  /* ------------------------------------------------------------------ epic */
  {
    id: 'splitStream',
    name: 'Split Stream',
    slot: 'attack1',
    rarity: 'epic',
    description: 'The jet forks into three streams that spread as they travel.',
    flavour: 'One of them will find you. Probably two.',
    ability: { damage: 23, cooldownS: 1.4, range: 8.5, chargeS: 1.4, tags: ['Charge', 'Spread ×3'] },
    effect: { kind: 'projectile', shots: 3, spreadDeg: 26 },
    stat: { label: 'Spread angle', base: 26, perLevel: -1.5, unit: '°' },
  },
  {
    id: 'torrentLance',
    name: 'Torrent Lance',
    slot: 'attack1',
    rarity: 'epic',
    description: 'A sustained beam of high-pressure water that keeps hitting while it lasts.',
    flavour: 'Cut the pool in half and see who is standing on the wrong side.',
    ability: { damage: 30, cooldownS: 3.5, range: 12, chargeS: 1.8, tags: ['Beam', 'Piercing'] },
    effect: { kind: 'beam', durationS: 1.5, tickS: 0.18, width: 0.8 },
    stat: { label: 'Beam duration', base: 1.5, perLevel: 0.25, unit: 's' },
  },
  {
    id: 'whirlKick',
    name: 'Whirl Kick',
    slot: 'attack2',
    rarity: 'epic',
    description: 'Spin once, kicking a ring of water outward in every direction.',
    flavour: 'The kick, but you stopped caring which way they were coming from.',
    ability: { damage: 21, cooldownS: 4.5, range: 3.2, chargeS: 0, tags: ['Radial', 'Knockback'] },
    effect: { kind: 'burst', knockback: 10 },
    stat: { label: 'Ring radius', base: 3.2, perLevel: 0.3, unit: 'm' },
  },
  {
    id: 'depthCharge',
    name: 'Depth Charge',
    slot: 'attack2',
    rarity: 'epic',
    description: 'Sink a charge that detonates after two seconds, hitting hardest underwater.',
    flavour: 'Diving used to be safe.',
    ability: { damage: 27, cooldownS: 6, range: 5, chargeS: 0, tags: ['Delayed', 'Anti-dive'] },
    effect: { kind: 'mine', fuseS: 2, radius: 2.8, hitsSubmerged: true, submergedBonus: 2.2 },
    stat: { label: 'Blast radius', base: 2.8, perLevel: 0.35, unit: 'm' },
  },
  {
    id: 'maelstrom',
    name: 'Maelstrom',
    slot: 'ultimate',
    rarity: 'epic',
    description: 'A whirlpool opens, dragging anyone near it inward and grinding them down.',
    flavour: 'The floor of the pool opens up and politely asks them down.',
    ability: { damage: 38, cooldownS: 65, range: 7, chargeS: 0, tags: ['Pull', 'Drowns'] },
    effect: {
      kind: 'zone',
      flavour: 'whirlpool',
      durationS: 4.5,
      dps: 11,
      pullSpeed: 9,
      slow: 0.75,
      hitsSubmerged: true,
      atSelf: true,
    },
    stat: { label: 'Whirlpool radius', base: 4, perLevel: 0.6, unit: 'm' },
  },
  {
    id: 'geyserField',
    name: 'Geyser Field',
    slot: 'ultimate',
    rarity: 'epic',
    description: 'Six geysers erupt across the arena in sequence, each one telegraphed.',
    flavour: 'You cannot dodge all of them. You can dodge most of them.',
    ability: { damage: 33, cooldownS: 60, range: 16, chargeS: 0, tags: ['Arena-wide', 'Launch'] },
    effect: { kind: 'geysers', count: 6, radius: 2.2, warnS: 0.75, knockback: 9 },
    stat: { label: 'Geysers', base: 6, perLevel: 1, unit: '' },
  },

  /* ------------------------------------------------------------- legendary */
  {
    id: 'leviathanSpout',
    name: 'Leviathan Spout',
    slot: 'attack1',
    rarity: 'legendary',
    description: 'A column erupts under your target and suspends them, helpless, above it.',
    flavour: 'Something below the surface does the aiming for you.',
    ability: { damage: 36, cooldownS: 2.6, range: 10, chargeS: 2, tags: ['Charge', 'Suspends'] },
    effect: { kind: 'grab', holdS: 1.1, flavour: 'spout' },
    stat: { drives: 'damage', label: 'Spout damage', base: 36, perLevel: 6, unit: '' },
  },
  {
    id: 'stormLash',
    name: 'Storm Lash',
    slot: 'attack1',
    rarity: 'legendary',
    description: 'A whip of storm water that curves after the nearest fighter.',
    flavour: 'It has already decided where they are going to be.',
    ability: { damage: 28, cooldownS: 2, range: 9, chargeS: 1.1, tags: ['Homing'] },
    effect: { kind: 'projectile', homing: true, speed: 9 },
    stat: { drives: 'damage', label: 'Lash damage', base: 28, perLevel: 5, unit: '' },
  },
  {
    id: 'tsunamiKick',
    name: 'Tsunami Kick',
    slot: 'attack2',
    rarity: 'legendary',
    // The headline legendary: enormous damage down a wide lane, and entirely
    // avoidable by diving under it. Big and dodgeable, not big and unfair.
    description: 'Kick up a breaking wave that sweeps the arena. Dive under it or be carried.',
    flavour: 'The same kick everyone learns. Just, more of it.',
    ability: { damage: 32, cooldownS: 7, range: 9, chargeS: 0, tags: ['Wave', 'Carries'] },
    effect: { kind: 'wave', speed: 13, width: 4, carrySpeed: 10, travel: 14 },
    stat: { drives: 'range', label: 'Wave reach', base: 9, perLevel: 1, unit: 'm' },
  },
  {
    id: 'abyssalGrasp',
    name: 'Abyssal Grasp',
    slot: 'attack2',
    rarity: 'legendary',
    description: 'A tentacle rises, seizes the nearest fighter and holds them under.',
    flavour: 'Whatever lives at the bottom of this pool is on your side today.',
    ability: { damage: 24, cooldownS: 9, range: 7, chargeS: 0.5, tags: ['Grab', 'Drowns'] },
    effect: { kind: 'grab', holdS: 2, flavour: 'tentacle', drowns: true },
    stat: { label: 'Hold duration', base: 2, perLevel: 0.3, unit: 's' },
  },
  {
    id: 'hurricane',
    name: 'Hurricane',
    slot: 'ultimate',
    rarity: 'legendary',
    // Reworked from "instant arena-wide burst" — which was Swell with a bigger
    // radius — into a storm that stays: a poison-green sea of churn nobody can
    // stand in, and the only zone that reaches under water.
    description: 'The arena turns to storm. Nowhere on the surface is safe while it lasts.',
    flavour: 'The scoreboard stops mattering for about four seconds.',
    ability: { damage: 48, cooldownS: 90, range: 16, chargeS: 0, tags: ['Arena-wide', 'Storm'] },
    effect: {
      kind: 'zone',
      flavour: 'poison',
      durationS: 4,
      dps: 16,
      pullSpeed: 3,
      slow: 0.8,
      hitsSubmerged: true,
      atSelf: true,
    },
    stat: { label: 'Storm duration', base: 4, perLevel: 0.5, unit: 's' },
  },
  {
    id: 'leviathanCall',
    name: 'Leviathan Call',
    slot: 'ultimate',
    rarity: 'legendary',
    description: 'Call the thing below. It surfaces once and takes one fighter down with it.',
    flavour: 'You only get to ask nicely the first time.',
    ability: {
      damage: 55,
      cooldownS: 100,
      range: 8,
      chargeS: 1.5,
      tags: ['Single target', 'Drowns'],
    },
    effect: { kind: 'grab', holdS: 2.4, flavour: 'tentacle', drowns: true },
    stat: { drives: 'damage', label: 'Strike damage', base: 55, perLevel: 8, unit: '' },
  },

  /* ----------------------------------------------------- new: the poisons */
  // The catalogue had no lingering-hazard card below ultimate, so nothing at
  // common or epic taught the "do not stand there" idea the zones are built
  // around. These two do, on their own slots.
  {
    id: 'algaeBloom',
    name: 'Algae Bloom',
    slot: 'attack2',
    rarity: 'rare',
    description: 'Spread a slick of green algae. It stings and clings to whoever wades in.',
    flavour: 'It was already growing. You just encouraged it.',
    ability: { damage: 12, cooldownS: 5.5, range: 4.5, chargeS: 0, tags: ['Zone', 'Over time'] },
    effect: { kind: 'zone', flavour: 'poison', durationS: 4.5, dps: 7, slow: 0.7 },
    stat: { label: 'Slick duration', base: 4.5, perLevel: 0.6, unit: 's' },
  },
  {
    id: 'brineTrap',
    name: 'Brine Trap',
    slot: 'attack1',
    rarity: 'epic',
    description: 'Lob a pocket of scalding brine that bursts into a burning patch of water.',
    flavour: 'Salt does not dissolve so much as wait.',
    ability: { damage: 18, cooldownS: 4, range: 7.5, chargeS: 0.7, tags: ['Zone', 'Over time'] },
    effect: { kind: 'zone', flavour: 'poison', durationS: 3.6, dps: 13 },
    stat: { label: 'Patch damage', base: 13, perLevel: 2, unit: '/s' },
  },
];

export const CARD_DEF_BY_ID: Record<string, CardDefinition> = Object.fromEntries(
  CARD_CATALOG.map((card) => [card.id, card]),
);

/**
 * What a new account starts with: one playable common in every slot, and
 * nothing else.
 *
 * Enough to build a legal deck and get into a match immediately, few enough
 * that opening the first pack is actually a discovery. Everything above this is
 * pulled.
 */
export const STARTER_COLLECTION: Record<string, CardProgress> = {
  waterJet: { level: 1, copies: 0 },
  undertowKick: { level: 1, copies: 0 },
  swell: { level: 1, copies: 0 },
};

/** Merges a definition with one player's progress into a renderable card. */
export function resolveCard(
  definition: CardDefinition,
  progress: CardProgress | undefined,
): AbilityCard {
  const level = progress?.level ?? 1;
  return {
    ...definition,
    level,
    maxLevel: MAX_CARD_LEVEL,
    copies: progress?.copies ?? 0,
    copiesForNextLevel: copiesForNextLevel(definition.rarity, level),
    owned: progress !== undefined,
  };
}

/** The whole catalogue resolved against a player's progress. */
export function resolveCollection(
  progress: Record<string, CardProgress>,
): { cards: AbilityCard[]; byId: Record<string, AbilityCard> } {
  const cards = CARD_CATALOG.map((definition) => resolveCard(definition, progress[definition.id]));
  return { cards, byId: Object.fromEntries(cards.map((card) => [card.id, card])) };
}

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

/** Tailwind token suffix for each rarity, e.g. `text-rarity-epic`. */
export const RARITY_TOKEN: Record<Rarity, string> = {
  common: 'rarity-common',
  rare: 'rarity-rare',
  epic: 'rarity-epic',
  legendary: 'rarity-legendary',
};

/** Deck order, left to right, everywhere a deck is shown. */
export const SLOT_ORDER: AbilitySlot[] = ['attack1', 'attack2', 'ultimate'];

export const SLOT_LABEL: Record<AbilitySlot, string> = {
  attack1: 'Attack 1',
  attack2: 'Attack 2',
  ultimate: 'Ultimate',
};

/** What the slot is *for*, in one line — shown on empty deck slots. */
export const SLOT_HINT: Record<AbilitySlot, string> = {
  attack1: 'Your main attack, used constantly.',
  attack2: 'A second move on its own cooldown.',
  ultimate: 'Fires once the ultimate tank is full.',
};

export const SLOT_GLYPH: Record<AbilitySlot, string> = {
  attack1: '≈',
  attack2: '✦',
  ultimate: '★',
};

export function cardsForSlot(cards: AbilityCard[], slot: AbilitySlot): AbilityCard[] {
  return cards.filter((card) => card.slot === slot);
}

/** Level curve, rounded the way the UI prints it. */
export function statAtLevel(card: AbilityCard, level = card.level): number {
  const raw = card.stat.base + card.stat.perLevel * (level - 1);
  return Number.isInteger(raw) ? raw : Number(raw.toFixed(1));
}

/**
 * The card's combat numbers **at its current level**.
 *
 * `ability` is authored at level 1, and `stat` is the one number that grows.
 * When the growing number *is* an ability field (`stat.drives`), reading
 * `card.ability` directly means reading a stale level-1 value: a level-3 Water
 * Jet showed "Jet damage 18" on its detail page while its card face and every
 * deck total still said 14. Everything that displays or fights with these
 * numbers goes through here, so there is one answer.
 */
export function abilityAtLevel(card: AbilityCard): AbilityCard['ability'] {
  const { drives } = card.stat;
  if (!drives) return card.ability;
  return { ...card.ability, [drives]: statAtLevel(card) };
}

/**
 * Dev-only: a stat that drives an ability field must equal it at level 1.
 *
 * This is the invariant that broke — the two values were authored separately
 * and nothing tied them together. Checking it at import time means the next
 * card added with a mismatched pair fails loudly instead of silently rendering
 * two different damage numbers on two different screens.
 */
export function validateCards(): void {
  for (const card of CARD_CATALOG) {
    const { drives } = card.stat;
    if (!drives) continue;
    if (card.ability[drives] !== card.stat.base) {
      console.error(
        `[cards] ${card.id}: stat "${card.stat.label}" drives ability.${drives}, ` +
          `but base ${card.stat.base} !== ability.${drives} ${card.ability[drives]}`,
      );
    }
  }
}

if (import.meta.env.DEV) validateCards();
