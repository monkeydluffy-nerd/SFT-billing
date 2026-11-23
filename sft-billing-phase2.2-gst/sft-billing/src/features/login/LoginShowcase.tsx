import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { animate, motion, useMotionValue, useTransform, type Variants } from "framer-motion";
import { Cog, Hammer, Package, ShieldCheck, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Product catalogue shown on the login screen. Mirrors the seeded product
 * list so the first thing people see is their own catalogue, in motion.
 */
interface ShowcaseProduct {
  code: string;
  name: string;
  price: number;
  unit: string;
  hsn: string;
  kind: "part" | "service";
  icon: LucideIcon;
}

const PRODUCTS: ShowcaseProduct[] = [
  { code: "PIN-1070", name: "Precision pin 10 × 70", price: 42, unit: "pc", hsn: "7318", kind: "part", icon: Wrench },
  { code: "BLT-M10", name: "Hex bolt M10", price: 18.5, unit: "pc", hsn: "7318", kind: "part", icon: Wrench },
  { code: "FLG-150", name: "Forged flange 150 mm", price: 310, unit: "pc", hsn: "7307", kind: "part", icon: Hammer },
  { code: "MCH-SRV", name: "CNC machining service", price: 1200, unit: "hr", hsn: "9988", kind: "service", icon: Cog },
  { code: "GER-BLK", name: "Gear blank EN8", price: 620, unit: "pc", hsn: "8483", kind: "part", icon: Cog },
  { code: "NUT-M10", name: "Hex nut M10", price: 6.5, unit: "pc", hsn: "7318", kind: "part", icon: Wrench },
  { code: "HTT-BAT", name: "Heat treatment batch", price: 2500, unit: "batch", hsn: "9988", kind: "service", icon: ShieldCheck },
  { code: "SHF-RDK", name: "Drive shaft blank", price: 940, unit: "pc", hsn: "7326", kind: "part", icon: Package },
  { code: "RNG-FRG", name: "Forged ring 200 mm", price: 540, unit: "pc", hsn: "7326", kind: "part", icon: Hammer },
  { code: "WSH-SET", name: "Washer set", price: 12, unit: "set", hsn: "7318", kind: "part", icon: Package },
  { code: "CLP-HVY", name: "Heavy duty clamp", price: 185, unit: "pc", hsn: "7326", kind: "part", icon: Wrench },
  { code: "QCI-INS", name: "Quality inspection", price: 800, unit: "lot", hsn: "9983", kind: "service", icon: ShieldCheck },
];

const rupee = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

function ProductCard({ product }: { product: ShowcaseProduct }) {
  const Icon = product.icon;
  return (
    <div className="sl-product">
      <span className={`sl-product__icon sl-product__icon--${product.kind}`}>
        <Icon size={16} strokeWidth={1.6} aria-hidden />
      </span>
      <div className="sl-product__body">
        <p className="sl-product__code">{product.code}</p>
        <p className="sl-product__name">{product.name}</p>
      </div>
      <div className="sl-product__price">
        <span>{rupee.format(product.price)}</span>
        <small>
          / {product.unit} · HSN {product.hsn}
        </small>
      </div>
    </div>
  );
}

function MarqueeColumn({ items, duration, reverse, offset }: { items: ShowcaseProduct[]; duration: number; reverse?: boolean; offset: number }) {
  // Content is repeated twice so the loop is seamless at -50%.
  const doubled = useMemo(() => [...items, ...items], [items]);
  const style = {
    "--sl-duration": `${duration}s`,
    "--sl-offset": `${offset}px`,
    animationDirection: reverse ? "reverse" : "normal",
  } as CSSProperties;
  return (
    <div className="sl-col" aria-hidden="true">
      <div className="sl-col__track" style={style}>
        {doubled.map((product, index) => (
          <ProductCard key={`${product.code}-${index}`} product={product} />
        ))}
      </div>
    </div>
  );
}

function CountUp({ to, prefix = "", suffix = "", decimals = 0, delay = 0.6 }: { to: number; prefix?: string; suffix?: string; decimals?: number; delay?: number }) {
  const value = useMotionValue(0);
  const text = useTransform(value, (v) => `${prefix}${v.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`);
  useEffect(() => {
    const controls = animate(value, to, { duration: 2, delay, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [to, delay, value]);
  return <motion.span>{text}</motion.span>;
}

const SPARK = "M0 58 C 18 54, 26 40, 44 44 S 78 20, 98 26 S 132 46, 152 30 S 188 4, 212 10";

const headline: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.35 } },
};
const word: Variants = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export default function LoginShowcase() {
  const ref = useRef<HTMLDivElement>(null);

  // Cursor-following spotlight (updates CSS variables, no re-render).
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    function onMove(event: PointerEvent) {
      const rect = node!.getBoundingClientRect();
      node!.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      node!.style.setProperty("--my", `${event.clientY - rect.top}px`);
    }
    node.addEventListener("pointermove", onMove);
    return () => node.removeEventListener("pointermove", onMove);
  }, []);

  const colA = PRODUCTS.filter((_, i) => i % 3 === 0);
  const colB = PRODUCTS.filter((_, i) => i % 3 === 1);
  const colC = PRODUCTS.filter((_, i) => i % 3 === 2);

  return (
    <div className="sl-show" ref={ref}>
      <div className="sl-aurora" aria-hidden="true">
        <i className="sl-aurora__a" />
        <i className="sl-aurora__b" />
        <i className="sl-aurora__c" />
      </div>
      <div className="sl-dots" aria-hidden="true" />
      <div className="sl-spot" aria-hidden="true" />

      <div className="sl-stage" aria-hidden="true">
        <div className="sl-tilt">
          <MarqueeColumn items={colA} duration={46} offset={0} />
          <MarqueeColumn items={colB} duration={58} reverse offset={70} />
          <MarqueeColumn items={colC} duration={52} offset={20} />
        </div>
      </div>
      <div className="sl-fade" aria-hidden="true" />

      {/* Floating live widgets */}
      <motion.div
        className="sl-widget sl-widget--revenue"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.9, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="sl-float" style={{ animationDelay: "0s" }}>
          <p className="sl-widget__label">Collected this quarter</p>
          <p className="sl-widget__value">
            <CountUp to={42.68} prefix="₹" suffix="L" decimals={2} delay={1.1} />
          </p>
          <svg viewBox="0 0 212 64" className="sl-spark" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="slSparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8fb0ff" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#8fb0ff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              d={`${SPARK} L212 64 L0 64 Z`}
              fill="url(#slSparkFill)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2, duration: 1 }}
            />
            <motion.path
              d={SPARK}
              stroke="#8fb0ff"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 1.2, duration: 1.6, ease: "easeInOut" }}
            />
            <motion.circle cx="212" cy="10" r="3.5" fill="#fff" initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 2.8 }} />
          </svg>
        </div>
      </motion.div>

      <motion.div
        className="sl-widget sl-widget--ring"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="sl-float" style={{ animationDelay: "-3s" }}>
          <div className="sl-ring">
            <svg viewBox="0 0 44 44" aria-hidden="true">
              <circle cx="22" cy="22" r="18" stroke="rgba(255,255,255,0.12)" strokeWidth="4" fill="none" />
              <motion.circle
                cx="22"
                cy="22"
                r="18"
                stroke="#34d399"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
                transform="rotate(-90 22 22)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 0.94 }}
                transition={{ delay: 1.4, duration: 1.6, ease: "easeOut" }}
              />
            </svg>
            <span>
              <CountUp to={94} suffix="%" delay={1.4} />
            </span>
          </div>
          <div>
            <p className="sl-widget__label">Paid on time</p>
            <p className="sl-widget__sub">Across 126 invoices</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="sl-widget sl-widget--paid"
        initial={{ opacity: 0, scale: 0.6, rotate: -14 }}
        animate={{ opacity: 1, scale: 1, rotate: -6 }}
        transition={{ delay: 2.3, type: "spring", stiffness: 260, damping: 16 }}
      >
        <span className="sl-paid">
          <i /> Invoice 027/2026-27 · Paid
        </span>
      </motion.div>

      {/* Headline */}
      <div className="sl-copy">
        <motion.span className="sl-chip" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
          <i /> SFT Billing · by Surfine Technology
        </motion.span>
        <motion.h2 className="sl-headline" variants={headline} initial="hidden" animate="show">
          {"Every invoice, client and payment — in one calm place.".split(" ").map((w, i) => (
            <motion.span key={i} variants={word} className="sl-word">
              {w}&nbsp;
            </motion.span>
          ))}
        </motion.h2>
        <motion.p className="sl-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.8 }}>
          Your whole product catalogue, GST-ready billing and live collections — built for how a forging shop actually works.
        </motion.p>
      </div>
    </div>
  );
}
