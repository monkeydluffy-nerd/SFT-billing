import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type MotionValue, type Variants } from "framer-motion";
import { BURST_ANGLES, EASE, MANUFACTURE, PLATING, SIGN_IN_SCALE, SPRING, STAGE_MS, scaled } from "./routeTimeline";

/**
 * Brand panel for the login and sign-up screens: "the route of a part".
 *
 * A customer's raw bar comes in, is heated and struck, forged into an eye bolt
 * (SFT-002), dipped in a zinc bath (white or gold), packed in a box and
 * delivered, and the invoice follows. It is one continuous scene: the same
 * part travels from stage to stage, and every stage animates from wherever the
 * previous one left it. The part travels by itself; the stages can be clicked.
 * While someone is signing in, the route is driven by `forcedStep` and the same
 * choreography is fast-forwarded (see useRouteSignIn).
 *
 * Illustration only: it uses no customer names and no prices, because this
 * screen is shown before anyone has signed in. Everything that moves stops under
 * prefers-reduced-motion.
 */

type Finish = "white" | "gold";

const STAGES = [
  { name: "RAW MATERIAL", n: "01", label: "Raw material", text: "Comes in from the customer.", alt: "A raw steel bar arrives from the customer" },
  { name: "MANUFACTURE", n: "02", label: "Manufacture", text: "Made into each part type.", alt: "The bar is heated, struck and forged into an eye bolt, with an eye on one end and a thread on the shank" },
  { name: "PLATING", n: "03", label: "Plating", text: "Zinc plating, in white or gold.", alt: "The eye bolt is dipped in a zinc bath and comes out plated in white or gold" },
  { name: "PACK", n: "04", label: "Pack", text: "Counted and boxed for dispatch.", alt: "The finished eye bolt is packed in a box" },
  { name: "DELIVER", n: "05", label: "Deliver", text: "And the invoice follows.", alt: "The box is delivered and the invoice follows" },
] as const;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/* ── route driven by a real sign-in ───────────────────────────────────── */

export interface RouteSignIn {
  /** null while the part travels by itself */
  forcedStep: number | null;
  /** call when the request starts: the part sets off down the route */
  begin: () => void;
  /** pass to login()/register() as beforeCommit: carries the part to Deliver, then lets the app open */
  deliver: () => Promise<void>;
  /** call if the request fails: the part goes back to travelling by itself */
  reset: () => void;
}

export function useRouteSignIn(): RouteSignIn {
  const [forcedStep, setForcedStep] = useState<number | null>(null);
  const stepRef = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const stop = useCallback(() => {
    if (timer.current !== undefined) {
      window.clearInterval(timer.current);
      timer.current = undefined;
    }
  }, []);
  useEffect(() => stop, [stop]);

  const setStep = useCallback((n: number) => {
    stepRef.current = n;
    setForcedStep(n);
  }, []);

  const begin = useCallback(() => {
    stop();
    setStep(0);
    if (prefersReducedMotion()) return;
    // while the server answers, the part keeps moving but never reaches Deliver on its own
    timer.current = window.setInterval(() => {
      if (stepRef.current < 3) setStep(stepRef.current + 1);
    }, 520);
  }, [setStep, stop]);

  const deliver = useCallback(async () => {
    stop();
    const reduce = prefersReducedMotion();
    while (stepRef.current < 4) {
      setStep(stepRef.current + 1);
      if (!reduce) await sleep(340);
    }
    if (!reduce) await sleep(900);
  }, [setStep, stop]);

  const reset = useCallback(() => {
    stop();
    stepRef.current = 0;
    setForcedStep(null);
  }, [stop]);

  return { forcedStep, begin, deliver, reset };
}

/* ── geometry ─────────────────────────────────────────────────────────── */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * SFT-002 shank as a polygon. `form` runs 0 to 1: the plain bar's left end pulls
 * back to where the eye is forged, and the thread teeth rise one after another
 * from left to right. The point count never changes, so the path is always valid.
 */
function shankAt(form: number): string {
  const left = 50 + 100 * clamp01(form / 0.5);
  const teeth = clamp01((form - 0.25) / 0.75);
  const top: [number, number][] = [[left, 128], [250, 128]];
  const bottom: [number, number][] = [[250, 172], [left, 172]];
  const upper: [number, number][] = [];
  const lower: [number, number][] = [];
  for (let i = 0; i <= 20; i += 1) {
    const x = 262 + i * 11.4;
    const amp = clamp01(teeth * 25 - i);
    const even = i % 2 === 0;
    upper.push([x, 128 + amp * (even ? -5 : 4)]);
    lower.push([x, 172 + amp * (even ? 5 : -4)]);
  }
  const tipAmp = clamp01(teeth * 25 - 21);
  const tip: [number, number][] = [[500, 128 + tipAmp * 8], [500, 172 - tipAmp * 8]];
  const pts = top.concat(upper, tip, lower.reverse(), bottom);
  return `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L")}Z`;
}

const SHANK_BAR = shankAt(0);
const SHANK_FORGED = shankAt(1);

/** A line-drawn gear: 60 teeth, a rim, five tapered spokes and a small toothed hub. */
function buildGear() {
  const C = 200;
  const R = 200;
  const pol = (r: number, a: number): [number, number] => [C + r * Math.cos(a), C + r * Math.sin(a)];
  const f = (p: [number, number]) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  const ring = (n: number, rRoot: number, rTip: number, wRoot: number, wTip: number, start: number) => {
    const pitch = (2 * Math.PI) / n;
    let d = "";
    for (let i = 0; i < n; i += 1) {
      const a = start + i * pitch;
      const p1 = pol(rRoot, a - wRoot * pitch);
      const p2 = pol(rTip, a - wTip * pitch);
      const p3 = pol(rTip, a + wTip * pitch);
      const p4 = pol(rRoot, a + wRoot * pitch);
      d += `${i === 0 ? "M" : "L"}${f(p1)}L${f(p2)}L${f(p3)}L${f(p4)}`;
      d += `A${rRoot.toFixed(2)} ${rRoot.toFixed(2)} 0 0 1 ${f(pol(rRoot, a + pitch - wRoot * pitch))}`;
    }
    return `${d}Z`;
  };
  const hr = 0.66 * R;
  // the opening inside the rim, so the gaps between the spokes are see-through
  const hole = `M${C - hr} ${C}A${hr} ${hr} 0 1 0 ${C + hr} ${C}A${hr} ${hr} 0 1 0 ${C - hr} ${C}Z`;
  let spokes = "";
  let spokeEdges = "";
  for (let k = 0; k < 5; k += 1) {
    const th = -Math.PI / 2 + 0.28 + (k * 2 * Math.PI) / 5;
    const nx = -Math.sin(th);
    const ny = Math.cos(th);
    const at = (r: number, w: number): [number, number] => [C + r * Math.cos(th) + w * nx, C + r * Math.sin(th) + w * ny];
    spokes += `M${f(at(0.22 * R, -0.066 * R))}L${f(at(0.7 * R, -0.05 * R))}L${f(at(0.7 * R, 0.05 * R))}L${f(at(0.22 * R, 0.066 * R))}Z`;
    spokeEdges += `M${f(at(0.24 * R, -0.054 * R))}L${f(at(0.69 * R, -0.04 * R))}`;
  }
  return {
    teeth: ring(60, 0.91 * R, R, 0.32, 0.12, 0) + hole,
    hubTeeth: ring(12, 0.235 * R, 0.3 * R, 0.3, 0.17, Math.PI / 12),
    spokes,
    spokeEdges,
  };
}

const GEAR = buildGear();

/** A fixed scatter of sparks (the same every render, so nothing jumps). */
const SPARKS = (() => {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return Array.from({ length: 18 }, () => ({
    left: `${(rnd() * 100).toFixed(1)}%`,
    size: `${(1.2 + rnd() * 1.4).toFixed(1)}px`,
    dur: `${(9 + rnd() * 9).toFixed(1)}s`,
    delay: `-${(rnd() * 16).toFixed(1)}s`,
    drift: `${((rnd() - 0.5) * 120).toFixed(0)}px`,
  }));
})();

/** Wave along the top of the plating bath (one wavelength is 80 wide, so it can slide forever). */
const WAVE = (() => {
  let d = "M-40 190";
  for (let i = 0; i < 14; i += 1) d += `q20 -5 40 0t40 0`;
  return `${d}V250H-40Z`;
})();

/* ── the scene ────────────────────────────────────────────────────────── */

interface SceneProps {
  step: number;
  finish: Finish;
  /** time scale: 1 normal, small = fast-forward, 0 = jump to the end state */
  k: number;
  /** true on the render where `step` has just changed */
  entering: boolean;
  statik: boolean;
}

function RouteScene({ step, finish, k, entering, statik }: SceneProps) {
  const { d, w } = scaled(k);

  /* forging progress (0 bar, 1 eye bolt): drives the shape of the shank */
  const form = useMotionValue(0);
  const shankD: MotionValue<string> = useTransform(form, shankAt);
  const formAnim = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => {
    formAnim.current?.stop();
    if (step === 1) {
      formAnim.current = animate(form, 1, { duration: d(MANUFACTURE.formFor), delay: w(MANUFACTURE.formAt), ease: EASE.inOut });
    } else {
      form.set(step >= 2 && step <= 3 ? 1 : 0);
    }
    return () => formAnim.current?.stop();
  }, [step, k, form, d, w]);

  const part: Variants = {
    s0: { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, transition: { duration: d(1.3), ease: EASE.out } },
    s1: {
      x: 0, y: 0, opacity: 1,
      // a tiny pull-back, then the strike: squash along the bar, swell across it, and settle
      scaleX: [1, 1, 1.012, 0.972, 1.008, 1],
      scaleY: [1, 1, 0.99, 1.05, 0.99, 1],
      transition: {
        scaleX: { duration: d(4.4), times: [0, 0.34, 0.385, 0.405, 0.45, 0.5], ease: "easeOut" },
        scaleY: { duration: d(4.4), times: [0, 0.34, 0.385, 0.405, 0.45, 0.5], ease: "easeOut" },
        default: { duration: d(0.8), ease: EASE.out },
      },
    },
    s2: {
      x: 0, scaleX: 1, scaleY: 1, opacity: 1,
      // lowered into the bath, held while the finish is applied, then lifted out
      y: [0, 34, 34, 0],
      transition: {
        y: { duration: d(PLATING.dipFor), delay: w(PLATING.dipAt), times: [0, 0.3, 0.64, 1], ease: EASE.inOut },
        default: { duration: d(0.6), ease: EASE.out },
      },
    },
    s3: {
      x: 0, y: 12, scaleX: 0.5, scaleY: 0.5,
      // slides into the box and disappears under the lid
      opacity: [1, 1, 0],
      transition: {
        opacity: { duration: d(1.6), delay: w(0.5), times: [0, 0.7, 1] },
        default: { duration: d(0.9), delay: w(0.5), ease: EASE.inOut },
      },
    },
    s4: { x: -340, y: 0, scaleX: 1, scaleY: 1, opacity: 0, transition: { duration: 0 } },
  };

  const heat: Variants = {
    s0: { x: -470, opacity: 0, transition: { duration: 0 } },
    s1: {
      x: [-470, 40], opacity: [0, 0.95, 0.95, 0],
      transition: {
        x: { duration: d(MANUFACTURE.heatIn), ease: EASE.out },
        opacity: { duration: d(4.4), times: [0, 0.1, 0.62, 0.86] },
      },
    },
    s2: { x: -470, opacity: 0, transition: { duration: 0 } },
    s3: { x: -470, opacity: 0, transition: { duration: 0 } },
    s4: { x: -470, opacity: 0, transition: { duration: 0 } },
  };

  const wipeW = step === 2 || step === 3 ? (finish === "white" ? 560 : 0) : 0;
  const wipeG = step === 2 || step === 3 ? (finish === "gold" ? 560 : 0) : 0;
  const wipeTransition = step === 4 ? { duration: 0 } : entering && step === 2 ? { duration: d(PLATING.wipeFor), delay: w(PLATING.wipeAt), ease: EASE.inOut } : { duration: d(1), ease: EASE.inOut };

  const bath: Variants = {
    off: { opacity: 0, y: 26, transition: { duration: d(0.6), ease: EASE.in } },
    on: { opacity: 1, y: 0, transition: { duration: d(0.9), ease: EASE.out } },
  };
  const bathState = step === 2 ? "on" : "off";

  const box: Variants = {
    s0: { x: 0, opacity: 0, transition: { duration: 0 } },
    s1: { x: 0, opacity: 0, transition: { duration: 0 } },
    s2: { x: 0, opacity: 0, transition: { duration: 0 } },
    s3: { x: 0, opacity: 1, transition: { duration: d(0.3) } },
    s4: { x: [0, 0, 480], opacity: [1, 1, 0], transition: { duration: d(1.7), delay: w(0.4), times: [0, 0.18, 1], ease: EASE.in } },
  };
  const packed = step === 3 || step === 4;
  const resetNow = { duration: 0 };

  const invoiceOn = step === 4;
  const stampDelay = w(2.3);

  const scene = `s${step}`;
  return (
    <svg className="sl-part" viewBox="0 50 560 200" role="img" aria-label={STAGES[step].alt}>
      <defs>
        <linearGradient id="slRaw" gradientUnits="userSpaceOnUse" x1="0" y1="86" x2="0" y2="214">
          <stop offset="0" stopColor="#151D1A" /><stop offset=".35" stopColor="#3B4944" /><stop offset=".5" stopColor="#43524C" /><stop offset=".7" stopColor="#28332F" /><stop offset="1" stopColor="#151D1A" />
        </linearGradient>
        <linearGradient id="slZinc" gradientUnits="userSpaceOnUse" x1="0" y1="86" x2="0" y2="214">
          <stop offset="0" stopColor="#7E8A85" /><stop offset=".22" stopColor="#CBD3CF" /><stop offset=".4" stopColor="#F4F7F5" /><stop offset=".55" stopColor="#E1E7E4" /><stop offset=".78" stopColor="#A9B4AF" /><stop offset="1" stopColor="#76827D" />
        </linearGradient>
        <linearGradient id="slGold" gradientUnits="userSpaceOnUse" x1="0" y1="86" x2="0" y2="214">
          <stop offset="0" stopColor="#8A6A2F" /><stop offset=".22" stopColor="#D9B45A" /><stop offset=".4" stopColor="#F6E3A1" /><stop offset=".55" stopColor="#E6C777" /><stop offset=".78" stopColor="#B08A3E" /><stop offset="1" stopColor="#7A5A22" />
        </linearGradient>
        <linearGradient id="slSheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".8" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="slHeat" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FF9A3C" stopOpacity="0" /><stop offset=".55" stopColor="#FF9A3C" stopOpacity=".55" /><stop offset="1" stopColor="#FFC27A" stopOpacity=".95" />
        </linearGradient>
        <mask id="slHideRing" maskUnits="userSpaceOnUse" x="0" y="0" width="560" height="300">
          <rect x="0" y="0" width="560" height="300" fill="#fff" />
          <motion.circle
            cx="110" cy="150" r="55.4" fill="#000" initial={false}
            animate={{ opacity: step >= 1 && step <= 3 ? 1 : 0 }}
            transition={step === 1 ? { duration: d(0.6), delay: w(MANUFACTURE.formAt + 0.8) } : step === 4 ? { duration: 0 } : { duration: d(0.4) }}
          />
        </mask>
        <mask id="slHideRod" maskUnits="userSpaceOnUse" x="0" y="0" width="560" height="300">
          <rect x="0" y="0" width="560" height="300" fill="#fff" />
          <rect x="120" y="128.65" width="400" height="42.7" fill="#000" />
        </mask>
        <clipPath id="slBarClip"><path d={SHANK_BAR} /></clipPath>
        <clipPath id="slPartClip">
          <path d={SHANK_FORGED} />
          <path d="M54 150A56 56 0 1 0 166 150A56 56 0 1 0 54 150Z M78 150A32 32 0 1 0 142 150A32 32 0 1 0 78 150Z" clipRule="evenodd" />
        </clipPath>
        <clipPath id="slWipeWhite"><motion.rect x={0} y={40} height={220} initial={{ width: 0 }} animate={{ width: wipeW }} transition={wipeTransition} /></clipPath>
        <clipPath id="slWipeGold"><motion.rect x={0} y={40} height={220} initial={{ width: 0 }} animate={{ width: wipeG }} transition={wipeTransition} /></clipPath>
      </defs>

      <motion.path d="M20 150H540" fill="none" stroke="#D8BE8F" strokeOpacity=".3" strokeDasharray="14 3 2 3" initial={false} animate={{ opacity: step <= 2 ? 1 : 0 }} transition={{ duration: d(0.7) }} />

      {/* the plating bath: back wall first, the liquid goes in front of the part */}
      <motion.g variants={bath} initial={statik ? false : "off"} animate={bathState}>
        <rect x="40" y="188" width="480" height="58" rx="8" fill="none" stroke="#D8BE8F" strokeOpacity=".5" strokeWidth="1.2" />
      </motion.g>

      {/* the part: one object that carries the whole route */}
      <motion.g variants={part} initial={statik ? false : { x: -340, opacity: 0 }} animate={scene}>
        {/* raw steel */}
        <motion.path d={shankD} fill="url(#slRaw)" />
        <motion.circle
          cx="110" cy="150" r="44" fill="none" stroke="url(#slRaw)" strokeWidth="24"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: step === 1 || step === 2 || step === 3 ? 1 : 0 }}
          transition={step === 1 ? { duration: d(MANUFACTURE.formFor * 0.7), delay: w(MANUFACTURE.formAt), ease: EASE.inOut } : step === 4 ? resetNow : { duration: d(0.4) }}
          style={{ rotate: -90 }}
        />

        {/* heat sweeps along the bar before the strike */}
        <g clipPath="url(#slBarClip)">
          <motion.rect variants={heat} initial={false} animate={scene} y="100" width="470" height="100" fill="url(#slHeat)" />
        </g>

        {/* the finish is wiped on from left to right while the part is under the liquid */}
        <g clipPath="url(#slWipeWhite)">
          <path d={SHANK_FORGED} fill="url(#slZinc)" />
          <circle cx="110" cy="150" r="44" fill="none" stroke="url(#slZinc)" strokeWidth="24" />
        </g>
        <g clipPath="url(#slWipeGold)">
          <path d={SHANK_FORGED} fill="url(#slGold)" />
          <circle cx="110" cy="150" r="44" fill="none" stroke="url(#slGold)" strokeWidth="24" />
        </g>

        {/* one sheen sweep once the part is lifted out */}
        <g clipPath="url(#slPartClip)">
          <motion.path
            d="M0 60H70L40 240H-30Z" fill="url(#slSheen)" initial={{ x: -120 }}
            animate={{ x: step === 2 ? 700 : -120 }}
            transition={step === 2 ? { duration: d(1.4), delay: entering ? w(PLATING.sheenAt) : 0.1, ease: EASE.inOut } : resetNow}
          />
        </g>

        {/* outlines: dashed while it is bar stock, solid once it is formed */}
        {/* one merged outline: the rod's edge stops at the ring and the ring's edge stops at the rod */}
        <g mask="url(#slHideRing)">
          <motion.path
            d={shankD} fill="none" stroke="#D8BE8F" strokeWidth="1.3" strokeOpacity=".8" strokeLinejoin="round"
            initial={false} animate={{ strokeDasharray: step === 0 ? "4 5" : "1000 0" }} transition={{ duration: d(0.5) }}
          />
        </g>
        <motion.g initial={false} animate={{ opacity: step >= 1 && step <= 3 ? 1 : 0 }} transition={step === 1 ? { duration: d(0.6), delay: w(MANUFACTURE.formAt + 0.8) } : step === 4 ? resetNow : { duration: d(0.4) }}>
          <g mask="url(#slHideRod)">
            <circle cx="110" cy="150" r="56" fill="none" stroke="#D8BE8F" strokeWidth="1.3" strokeOpacity=".8" />
          </g>
          <circle cx="110" cy="150" r="32" fill="none" stroke="#D8BE8F" strokeWidth="1.3" strokeOpacity=".8" />
        </motion.g>
      </motion.g>

      {/* liquid in front of the part, with a slow wave and rising bubbles */}
      <motion.g variants={bath} initial={statik ? false : "off"} animate={bathState} style={{ pointerEvents: "none" }}>
        <motion.path d={WAVE} initial={false} animate={{ fill: finish === "gold" ? "rgba(232,190,90,.20)" : "rgba(235,242,238,.12)" }} transition={{ duration: d(0.6) }} clipPath="inset(0 0 0 0)" />
        <motion.g animate={step === 2 && k > 0 ? { x: [0, -80] } : { x: 0 }} transition={step === 2 && k > 0 ? { duration: 3, repeat: Infinity, ease: "linear" } : { duration: 0 }}>
          <motion.path d="M-40 190q20 -5 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0" fill="none" stroke="#D8BE8F" strokeOpacity=".6" strokeWidth="1.2" />
        </motion.g>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <motion.circle
            key={i} cx={90 + i * 78} cy={232} r={1.8 + (i % 3) * 0.7} fill="none" stroke="#D8BE8F" strokeOpacity=".6"
            animate={step === 2 && k > 0 ? { y: [0, -34], opacity: [0, 0.8, 0] } : { opacity: 0 }}
            transition={step === 2 && k > 0 ? { duration: 2 + (i % 3) * 0.5, repeat: Infinity, delay: i * 0.45, ease: "easeOut" } : { duration: 0 }}
          />
        ))}
      </motion.g>

      {/* the strike: a shockwave ring and a burst of sparks where the eye is formed */}
      <g aria-hidden="true">
        <motion.circle
          cx="110" cy="150" r="20" fill="none" stroke="#FFC27A" initial={{ opacity: 0 }}
          animate={step === 1 ? { r: [20, 96], opacity: [0.6, 0], strokeWidth: [3, 0.5] } : { opacity: 0 }}
          transition={step === 1 ? { duration: d(0.7), delay: w(MANUFACTURE.strikeAt), ease: EASE.out } : resetNow}
        />
        {BURST_ANGLES.map((a, i) => {
          const near = 48;
          const far = 62;
          return (
            <motion.line
              key={i}
              x1={110 + near * Math.cos(a)} y1={150 + near * Math.sin(a)} x2={110 + far * Math.cos(a)} y2={150 + far * Math.sin(a)}
              stroke="#FFC27A" strokeWidth="1.6" strokeLinecap="round" initial={{ opacity: 0 }}
              animate={step === 1 ? { x: [0, 34 * Math.cos(a)], y: [0, 34 * Math.sin(a)], opacity: [0, 1, 0] } : { opacity: 0 }}
              transition={step === 1 ? { duration: d(0.6), delay: w(MANUFACTURE.strikeAt + 0.02), ease: EASE.out } : resetNow}
            />
          );
        })}
      </g>

      {/* 04 packed, 05 delivered */}
      <motion.g variants={box} initial={false} animate={scene} fill="none" stroke="#D8BE8F" strokeWidth="1.3" strokeLinejoin="round">
        <motion.rect
          x="110" y="108" width="340" height="100" rx="4" fill="rgba(216,190,143,.07)"
          initial={{ pathLength: 0 }} animate={{ pathLength: packed ? 1 : 0 }} transition={packed ? { duration: d(0.9), ease: EASE.inOut } : resetNow}
        />
        <motion.rect
          x="104" y="90" width="352" height="32" rx="4" fill="rgba(216,190,143,.12)"
          initial={{ y: -60, opacity: 0 }} animate={{ y: packed ? 0 : -60, opacity: packed ? 1 : 0 }}
          transition={packed ? { ...SPRING, delay: w(1.3), opacity: { duration: d(0.2), delay: w(1.3) } } : resetNow}
        />
        <motion.rect
          x="268" y="90" width="24" height="118" fill="rgba(216,190,143,.22)" stroke="none"
          initial={{ scaleY: 0 }} style={{ transformOrigin: "280px 90px", transformBox: "view-box" } as CSSProperties}
          animate={{ scaleY: packed ? 1 : 0 }} transition={packed ? { duration: d(0.6), delay: w(2.0), ease: EASE.out } : resetNow}
        />
        <motion.text
          x="128" y="196" fill="#D8BE8F" stroke="none" fontFamily="Inter,sans-serif" fontSize="11" letterSpacing=".2em"
          initial={{ opacity: 0 }} animate={{ opacity: packed ? 1 : 0 }} transition={packed ? { duration: d(0.5), delay: w(2.4) } : resetNow}
        >
          SFT
        </motion.text>
        {[0, 1, 2].map((i) => (
          <motion.path
            key={i} d={`M${60 - i * 8} ${134 + i * 17}H${100 - i * 4}`} strokeOpacity=".6"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={step === 4 ? { pathLength: [0, 1], opacity: [0, 0.7, 0] } : { opacity: 0 }}
            transition={step === 4 ? { duration: d(0.6), delay: w(0.5 + i * 0.1) } : resetNow}
          />
        ))}
      </motion.g>

      <motion.g
        initial={{ y: 46, opacity: 0 }} animate={invoiceOn ? { y: 0, opacity: 1 } : { y: 46, opacity: 0 }}
        transition={invoiceOn ? { duration: d(0.9), delay: w(1.5), ease: EASE.out } : resetNow}
        fill="none" stroke="#D8BE8F" strokeWidth="1.3" strokeLinejoin="round"
      >
        <rect x="222" y="78" width="116" height="144" rx="4" fill="rgba(216,190,143,.1)" />
        {[0, 1, 2].map((i) => (
          <motion.path
            key={i} d={`M240 ${140 + i * 18}H${i === 2 ? 300 : 320}`} strokeOpacity=".7"
            initial={{ pathLength: 0 }} animate={{ pathLength: invoiceOn ? 1 : 0 }}
            transition={invoiceOn ? { duration: d(0.5), delay: w(2.0 + i * 0.18), ease: EASE.out } : resetNow}
          />
        ))}
        <motion.text
          x="240" y="106" fill="#D8BE8F" stroke="none" fontFamily="Inter,sans-serif" fontSize="10" letterSpacing=".08em"
          initial={{ opacity: 0, scale: 1.6 }} style={{ transformOrigin: "290px 102px", transformBox: "view-box" } as CSSProperties}
          animate={invoiceOn ? { opacity: [0, 1, 1], scale: [1.6, 0.96, 1] } : { opacity: 0, scale: 1.6 }}
          transition={invoiceOn ? { duration: d(0.55), delay: stampDelay, times: [0, 0.6, 1], ease: "easeOut" } : resetNow}
        >
          001/2026-27
        </motion.text>
      </motion.g>
    </svg>
  );
}

/* ── component ────────────────────────────────────────────────────────── */

interface LoginShowcaseProps {
  /** Set while a sign-in is running; null lets the part travel on its own. */
  forcedStep?: number | null;
}

export default function LoginShowcase({ forcedStep = null }: LoginShowcaseProps) {
  const reduce = useMemo(prefersReducedMotion, []);
  const [autoStep, setAutoStep] = useState(reduce ? 2 : 0);
  const [finish, setFinish] = useState<Finish>("white");
  const [tick, setTick] = useState(0);
  const pausedUntil = useRef(0);

  const step = forcedStep ?? autoStep;
  const stage = STAGES[step];
  const signingIn = forcedStep !== null;

  /* the part moves on after each stage has finished playing */
  useEffect(() => {
    if (reduce || signingIn) return undefined;
    const hold = Math.max(0, pausedUntil.current - Date.now());
    const id = window.setTimeout(() => {
      const next = (autoStep + 1) % 5;
      setAutoStep(next);
      // each time the part reaches plating, the finish alternates between white and gold
      if (next === 2) setFinish((current) => (current === "white" ? "gold" : "white"));
    }, STAGE_MS[autoStep] + hold);
    return () => window.clearTimeout(id);
  }, [autoStep, signingIn, reduce, tick]);

  /* remember which step we came from, to tell "just arrived" from "re-rendered" */
  const lastStep = useRef(step);
  const entering = lastStep.current !== step;
  useEffect(() => {
    lastStep.current = step;
  }, [step]);

  function goTo(i: number) {
    if (signingIn) return;
    pausedUntil.current = Date.now() + 9000;
    setAutoStep(i);
    setTick((t) => t + 1);
  }

  function pickFinish(next: Finish) {
    pausedUntil.current = Date.now() + 9000;
    setFinish(next);
    setTick((t) => t + 1);
  }

  const k = reduce ? 0 : signingIn ? SIGN_IN_SCALE : 1;
  const zincW = step >= 2 && finish === "white" ? 1 : 0;
  const zincG = step >= 2 && finish === "gold" ? 1 : 0;
  const sparkColor = step === 1 ? "#F2C46B" : step === 2 ? (finish === "gold" ? "#F0CF7A" : "#F4F7F5") : "#D8BE8F";
  const sparkPeak = step === 1 ? "0.55" : step === 2 ? "0.4" : "0.25";
  const gearDur = reduce ? "100000s" : signingIn ? "10s" : step === 1 ? "28s" : "60s";
  const pct = (i: number) => `${(i / 4) * 100}%`;

  return (
    <aside className="sl-show" aria-label="SFT Billing by Surfine Technology">
      {/* background: a faint grid, a glow that follows the stage, and sparks that rise */}
      <div className="sl-bg-grid" aria-hidden="true" />
      <div className="sl-bg-glow" aria-hidden="true">
        <div style={{ background: "radial-gradient(closest-side,rgba(236,150,60,.14),rgba(236,150,60,0))", opacity: step === 1 ? 1 : 0 }} />
        <div style={{ background: "radial-gradient(closest-side,rgba(235,242,238,.10),rgba(235,242,238,0))", opacity: zincW }} />
        <div style={{ background: "radial-gradient(closest-side,rgba(232,190,90,.13),rgba(232,190,90,0))", opacity: zincG }} />
      </div>
      <div className="sl-sparks" aria-hidden="true" style={{ "--spark": sparkColor, "--peak": sparkPeak } as CSSProperties}>
        {SPARKS.map((s, i) => (
          <span
            key={i}
            className="sl-spark"
            style={{ left: s.left, width: s.size, height: s.size, animationDuration: s.dur, animationDelay: s.delay, "--drift": s.drift } as CSSProperties}
          />
        ))}
      </div>

      {/* the gear: line drawing, half off the page edge, always turning */}
      <div className="sl-gearwrap" aria-hidden="true">
        <svg className="sl-gear" viewBox="0 0 400 400">
          <g fill="#17372c" stroke="#D8BE8F" strokeLinejoin="round" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur={gearDur} repeatCount="indefinite" />
            <path d={GEAR.teeth} fillRule="evenodd" strokeWidth="1.3" strokeOpacity=".9" />
            <circle cx="200" cy="200" r="174" fill="none" strokeWidth=".8" strokeOpacity=".5" />
            <circle cx="200" cy="200" r="138" fill="none" strokeWidth=".7" strokeOpacity=".35" />
            <circle cx="200" cy="200" r="132" fill="none" strokeWidth="1" strokeOpacity=".6" />
            <path d={GEAR.spokes} strokeWidth="1.2" strokeOpacity=".85" />
            <path d={GEAR.spokeEdges} fill="none" strokeWidth=".8" strokeOpacity=".5" />
            <path d={GEAR.hubTeeth} strokeWidth="1.1" strokeOpacity=".9" />
            <circle cx="200" cy="200" r="44" strokeWidth="1.1" strokeOpacity=".85" />
            <circle cx="200" cy="200" r="30" strokeWidth="1" strokeOpacity=".8" />
            <circle cx="200" cy="200" r="21" fill="none" strokeWidth=".7" strokeOpacity=".5" />
            <circle cx="200" cy="200" r="15" fill="none" strokeWidth="1.2" strokeOpacity=".9" />
            <circle cx="200" cy="200" r="5" fill="#D8BE8F" stroke="none" />
          </g>
        </svg>
      </div>

      <div className="sl-col sl-brandname">SURFINE TECHNOLOGY</div>

      <div className="sl-col sl-stage">
        <RouteScene step={step} finish={finish} k={k} entering={entering} statik={reduce} />
        <div className="sl-partlabel">{step >= 1 ? "SFT-002  ·  EYE BOLT MS 25x90 PITCH  ·  HSN 7318" : "BAR STOCK"}</div>

        {/* the route: choose a stage, or let the part travel by itself */}
        <nav className="sl-route" aria-label="Route of a part">
          <div className="sl-route__track" aria-hidden="true" />
          <motion.div className="sl-route__fill" aria-hidden="true" initial={false} animate={{ width: pct(step) }} transition={{ duration: reduce ? 0 : step === 0 ? 0.4 : 0.9, ease: EASE.inOut }} />
          {STAGES.map((s, i) => {
            const lit = i <= step;
            const active = i === step;
            return (
              <button
                key={s.n}
                type="button"
                className="sl-stop"
                style={{ left: pct(i) }}
                aria-label={`Show stage ${s.n}: ${s.label}`}
                aria-current={active ? "step" : undefined}
                disabled={signingIn}
                onClick={() => goTo(i)}
              >
                {active && !reduce && (
                  <motion.span
                    key={step}
                    className="sl-pulse"
                    initial={{ scale: 1, opacity: 0.7 }}
                    animate={{ scale: 3.2, opacity: 0 }}
                    transition={{ duration: 1.1, ease: EASE.out }}
                  />
                )}
                <span
                  className="sl-node"
                  style={
                    active
                      ? { border: "1.5px solid #D8BE8F", background: "#D8BE8F", boxShadow: "0 0 0 5px rgba(216,190,143,.22)" }
                      : lit
                        ? { border: "1.5px solid #D8BE8F", background: "#D8BE8F" }
                        : i === 0
                          ? { border: "1px dashed rgba(216,190,143,.7)", background: "#17372c" }
                          : { border: "1.5px solid rgba(216,190,143,.5)", background: "#17372c" }
                  }
                />
              </button>
            );
          })}
        </nav>
        <div className="sl-route__labels" aria-hidden="true">
          {STAGES.map((s, i) => (
            <span
              key={s.n}
              style={{ left: pct(i), color: i === step ? "#F7F4EE" : i < step ? "rgba(216,190,143,.9)" : "rgba(216,190,143,.5)" }}
            >
              {s.name}
            </span>
          ))}
        </div>

        <div className="sl-caption" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: reduce ? 0 : 0.35, ease: EASE.out }}
            >
              <div className="sl-caption__n">{stage.n}</div>
              <div className="sl-caption__label">{stage.label}</div>
              <div className="sl-caption__text">{stage.text}</div>
            </motion.div>
          </AnimatePresence>
          {step === 2 && (
            <div className="sl-finish">
              <span className="sl-finish__label">FINISH</span>
              <button type="button" className={`sl-chip${finish === "white" ? " sl-chip--on" : ""}`} aria-pressed={finish === "white"} onClick={() => pickFinish("white")}>
                White
              </button>
              <button type="button" className={`sl-chip sl-chip--gold${finish === "gold" ? " sl-chip--on" : ""}`} aria-pressed={finish === "gold"} onClick={() => pickFinish("gold")}>
                Gold
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sl-col sl-foot">
        <div className="sl-foot__line">Then the invoice, the payment and the report. That part is SFT Billing.</div>
        <div className="sl-foot__tag">FORGING A STRONGER TOMORROW</div>
      </div>
    </aside>
  );
}
