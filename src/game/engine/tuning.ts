/**
 * Every number the match is balanced with, in one place (Block 3C).
 *
 * Units are metres and seconds throughout, matching the card `ability` fields —
 * a card that says `range: 7` reaches seven metres, and the arena is sixteen
 * across. Positions only become normalised 0..1 at the boundary where the scene
 * and the HUD read them.
 */

/** Arena width and depth in metres. Mirrors `ARENA_SIZE` in the 3D scene. */
export const ARENA = 16;

/** Metres from the wall a fighter can get. Keeps sprites off the pool edge. */
export const ARENA_MARGIN = 1.1;

/* --- Movement -------------------------------------------------------------- */

export const MOVE_SPEED = 4.4;
/** Slower under water — you swim, you don't sprint. */
export const SUBMERGED_SPEED = 3.1;
/** Charging plants you: committing to a big shot has to cost mobility. */
export const CHARGING_SPEED_FACTOR = 0.42;
export const ACCELERATION = 26;
/** Water drag. High enough that releasing the stick stops you in ~0.2s. */
export const DRAG = 11;
/** Fighters cannot overlap; they push apart at this radius. */
export const BODY_RADIUS = 0.6;

/* --- Combat ---------------------------------------------------------------- */

/** How close a projectile must pass to a fighter to count as a hit. */
export const HIT_RADIUS = 0.85;
export const PROJECTILE_SPEED = 12;
/**
 * At or below this range an ability resolves instantly in a cone in front of
 * the user instead of spawning a projectile — a kick has no travel time.
 */
export const MELEE_RANGE = 3.5;
/** Half-angle of that cone. */
export const MELEE_ARC = Math.PI / 3;
/** Knockback impulse in m/s, for abilities tagged Knockback / Launch. */
export const KNOCKBACK_SPEED = 7.5;
/** Pull impulse for abilities tagged Pull / Carries. */
export const PULL_SPEED = 6;
/** Seconds of hit reaction. Movement still works — this is a flinch, not a stun. */
export const HIT_REACTION_S = 0.26;
/**
 * Card damage is authored on a 0..100 scale against a full health bar, which is
 * 0..1 here. One conversion, in one place.
 */
export const DAMAGE_SCALE = 1 / 100;
/** Damage taken while submerged, as a share of normal. Diving is a real out. */
export const SUBMERGED_DAMAGE_FACTOR = 0.35;

/* --- Lingering effects ------------------------------------------------------ */

/**
 * How often a zone or beam may hurt the same fighter, in seconds.
 *
 * Damage-over-time is applied per tick rather than per frame: at 60fps a raw
 * per-frame application would land sixty flinches a second, so the sprite never
 * left its hit pose and the health bar fell as a smooth slide with no readable
 * events. Ticking it means standing in poison reads as a series of hits you can
 * count — and can decide to walk out of.
 */
export const DOT_TICK_S = 0.4;

/** Radius, in metres, a fighter must be within to count as inside a zone. */
export const ZONE_BODY_MARGIN = 0.3;

/**
 * Seconds a wave's crest keeps its hitbox after passing a fighter.
 *
 * Zero would mean the wall only connects on the exact frame its centre line
 * crosses you, which at 12 m/s and 60fps is a 20cm window — a wave that looks
 * like it hit you and did not. This gives the crest thickness in time as well
 * as space.
 */
export const WAVE_HIT_GRACE_S = 0.12;

/** Metres a skipping shot covers between bounces. */
export const BOUNCE_INTERVAL_M = 2.6;

/** Speed multiplier applied while a fighter is held by a grab (i.e. none). */
export const HELD_SPEED = 0;

/* --- Breath ---------------------------------------------------------------- */

export const OXYGEN_DRAIN_PER_S = 0.13;
export const OXYGEN_REGEN_PER_S = 0.32;
/** Health cost of running the lungs dry. Charged once, when they empty. */
export const OUT_OF_AIR_PENALTY = 0.09;
/**
 * Oxygen needed before you may dive again after running out.
 *
 * Without a recovery floor, a fighter holding the dive button at zero oxygen
 * surfaces for one frame, regenerates a sliver, dives on the next frame and
 * empties again — the sprite flickers between the dive and idle poses every
 * frame and the HUD strobes. The floor turns that into one surfacing.
 */
export const WINDED_RECOVERY = 0.3;

/* --- Ultimate -------------------------------------------------------------- */

/**
 * The tank also fills from fighting, not only from waiting: `cooldownS` on the
 * ultimate card sets the passive fill time, and landing hits adds this much per
 * point of damage dealt. Otherwise an aggressive player and a passive one reach
 * their ultimate at exactly the same moment.
 */
export const ULTIMATE_PER_DAMAGE = 0.006;

/* --- Match structure -------------------------------------------------------- */

export const ROUNDS_TOTAL = 3;
/** First to this many round wins takes the match. */
export const ROUNDS_TO_WIN = 2;
/** Seconds the arena holds after a knockout before the next round starts. */
export const ROUND_BREAK_S = 1.8;
/** Seconds of invulnerability when a round begins, so nobody spawn-camps. */
export const ROUND_GRACE_S = 1;

/* --- Bot ------------------------------------------------------------------- */

/** Metres the bot tries to keep between itself and its target. */
export const BOT_PREFERRED_RANGE = 5.5;
/** Below this health the bot starts diving to break line of sight. */
export const BOT_PANIC_HEALTH = 0.35;
/** Seconds between bot decisions. Re-deciding every frame reads as twitching. */
export const BOT_THINK_S = 0.35;
/**
 * Bot aim error, in **metres of lateral miss at the target** — not radians.
 *
 * A fixed angular error means the bot is deadly up close and useless far away,
 * and whether a shot connects stops being a property you can reason about: at
 * 5.5m, 0.16rad put the shot 0.88m wide against a 0.85m hit radius, so the bot
 * missed roughly half its shots and, with the wrong phase, could miss every one
 * for twenty-five seconds. Expressed as a distance it stays comparable to
 * `HIT_RADIUS` at any range: a little wider than the hit box, so most shots land
 * and some do not.
 */
export const BOT_AIM_ERROR = 1.2;
