/**
 * Timing and easing for the login "route of a part" scene.
 * Everything is in seconds unless it says "Ms". `k` is the time scale: 1 is the
 * normal pace, a small value fast-forwards the same choreography (used while
 * someone is signing in), and 0 jumps straight to the end state (reduced motion).
 */

/** How long each stage stays on screen before the part moves on (ms). */
export const STAGE_MS = [2400, 4400, 4200, 3200, 3600] as const;

/** Time scale used while a real sign-in is running. */
export const SIGN_IN_SCALE = 0.14;

export const EASE = {
  /** slides and arrivals: fast, then a long soft settle */
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** bends and wipes: eases in and out */
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
  /** exits: slow start, quick finish */
  in: [0.7, 0, 0.84, 0] as [number, number, number, number],
} as const;

/** A small spring with a little overshoot (the box lid, the stamp). */
export const SPRING = { type: "spring", stiffness: 260, damping: 15, mass: 0.8 } as const;

/** Scales a duration or delay; never returns an exact 0 duration. */
export function scaled(k: number) {
  return {
    /** a duration */
    d: (seconds: number) => Math.max(seconds * k, 0.001),
    /** a delay */
    w: (seconds: number) => seconds * k,
  };
}

/** The beats inside Manufacture (seconds from the moment the stage starts). */
export const MANUFACTURE = {
  heatIn: 1.1,
  strikeAt: 1.7,
  formAt: 1.8,
  formFor: 1.3,
  coolAt: 3.0,
} as const;

/** The beats inside Plating. */
export const PLATING = {
  dipAt: 0.25,
  dipFor: 3.6,
  wipeAt: 1.2,
  wipeFor: 1.3,
  sheenAt: 3.0,
} as const;

/** Burst directions for the forging strike (radians). */
export const BURST_ANGLES = Array.from({ length: 12 }, (_, i) => (i * 2 * Math.PI) / 12 + 0.2);
