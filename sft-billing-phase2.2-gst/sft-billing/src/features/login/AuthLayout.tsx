import { useReducedMotion, motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SAMPLE } from "./sampleData";

interface AuthLayoutProps {
  logoSrc: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  isLoginPage?: boolean;
}

function Entrance({
  index,
  children,
  className,
  ariaHidden = false,
}: {
  index: number;
  children: ReactNode;
  className?: string;
  ariaHidden?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      aria-hidden={ariaHidden}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.5,
        ease: [0.22, 1, 0.36, 1],
        delay: index * 0.06,
      }}
    >
      {children}
    </motion.div>
  );
}

function FloatingPaths({ position }: { position: 1 | -1 }) {
  const reduceMotion = useReducedMotion();
  return (
    <svg
      className="auth-floating-paths"
      viewBox="0 0 696 316"
      fill="none"
      aria-hidden="true"
    >
      {Array.from({ length: 24 }, (_, i) => {
        const d = `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`;
        const width = 0.5 + i * 0.03;
        const strokeOpacity = 0.12 + i * 0.03;
        const duration = 20 + ((Math.sin(i + 1) * 10000) % 1 + 1) % 1 * 10;

        return reduceMotion ? (
          <path
            key={`${position}-${i}`}
            d={d}
            stroke="white"
            strokeWidth={width}
            strokeOpacity={strokeOpacity}
            pathLength={1}
          />
        ) : (
          <motion.path
            key={`${position}-${i}`}
            d={d}
            stroke="white"
            strokeWidth={width}
            strokeOpacity={strokeOpacity}
            initial={{ pathLength: 0.3 }}
            animate={{ pathLength: 1, pathOffset: [0, 1, 0] }}
            transition={{ duration, repeat: Infinity, ease: "linear" }}
          />
        );
      })}
    </svg>
  );
}

function FloatingPathsBackground() {
  return (
    <div className="auth-floating-background" aria-hidden="true">
      <div className="auth-floating-paths-layer">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>
    </div>
  );
}

export default function AuthLayout({
  logoSrc,
  title,
  subtitle,
  children,
  footer,
  isLoginPage = false,
}: AuthLayoutProps) {
  return (
    <section
      className={cn(
        "sft-login auth-layout relative min-h-svh overflow-hidden lg:grid",
        isLoginPage ? "lg:grid-cols-[13fr_7fr] auth-layout--login" : "lg:grid-cols-[3fr_2fr]",
      )}
    >
      <aside className="auth-aside">
        <FloatingPathsBackground />
        <div className="auth-quote-wash" aria-hidden="true" />
        <Entrance index={0} className="auth-logo-wrap">
          <img className="auth-logo" src={logoSrc} alt="Surfine Technology" />
        </Entrance>
        <div className="auth-glimpse-space">
          <div className="auth-glimpse-slot">
            <div className="auth-glimpse-stage">
              <div className="auth-glimpse-block">
                <Entrance
                  index={2}
                  className="auth-glimpse-position auth-glimpse-position--sales"
                  ariaHidden
                >
                  <div className="auth-glimpse-card auth-glimpse-sales">
                    <div className="auth-sales-heading">
                      <span className="auth-glimpse-label">{SAMPLE.sales.label}</span>
                      <span className="auth-sales-delta">{SAMPLE.sales.delta}</span>
                    </div>
                    <div className="auth-sales-amount">{SAMPLE.sales.amount}</div>
                    <div className="auth-sales-chart">
                      {SAMPLE.sales.bars.map((bar, index) => (
                        <span
                          key={index}
                          className="auth-sales-bar"
                          style={{ height: `${bar}%` }}
                        />
                      ))}
                    </div>
                    <div className="auth-sales-baseline" />
                  </div>
                </Entrance>
                <Entrance
                  index={3}
                  className="auth-glimpse-position auth-glimpse-position--invoice"
                  ariaHidden
                >
                  <div className="auth-glimpse-card auth-glimpse-invoice">
                    <div className="auth-invoice-heading">
                      <div className="auth-invoice-number">
                        <span className="auth-glimpse-label">INVOICE</span>
                        <span className="auth-invoice-number-value">{SAMPLE.invoice.number}</span>
                      </div>
                      <span className="auth-invoice-status">
                        <span className="auth-invoice-status-dot" />
                        {SAMPLE.invoice.status}
                      </span>
                    </div>
                    <div className="auth-invoice-client">{SAMPLE.invoice.client}</div>
                    <div className="auth-invoice-date">{SAMPLE.invoice.date}</div>
                    <div className="auth-invoice-divider" />
                    <div className="auth-invoice-row">
                      <span>{SAMPLE.invoice.item}</span>
                      <span>{SAMPLE.invoice.amount}</span>
                    </div>
                    <div className="auth-invoice-row">
                      <span>{SAMPLE.invoice.taxLabel}</span>
                      <span>{SAMPLE.invoice.tax}</span>
                    </div>
                    <div className="auth-invoice-divider auth-invoice-divider--total" />
                    <div className="auth-invoice-total">
                      <span>Total</span>
                      <span>{SAMPLE.invoice.total}</span>
                    </div>
                  </div>
                </Entrance>
              </div>
            </div>
          </div>
        </div>
        <Entrance index={4} className="auth-quote">
          <figure>
            <blockquote>
              Built by people who forge things for a living.{" "}
              <em>Billing as solid as the parts we make.</em>
            </blockquote>
            <figcaption>SURFINE TECHNOLOGY | FORGING A STRONGER TOMORROW</figcaption>
          </figure>
        </Entrance>
      </aside>

      <main className="auth-main">
        <div className="auth-radial-wash" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="auth-content">
          <div className="auth-primary">
            <Entrance index={0} className="auth-mobile-logo-wrap">
              <img className="auth-logo" src={logoSrc} alt="Surfine Technology" />
            </Entrance>
            <div className="auth-heading-group">
              <Entrance index={1}>
                <h1 className="sl-title">{title}</h1>
              </Entrance>
              <Entrance index={2}>
                <p className="sl-subtitle">{subtitle}</p>
              </Entrance>
            </div>
            <div className="auth-submit-group">
              <Entrance index={3}>{children}</Entrance>
              <Entrance index={4} className="auth-footer">
                <p className="sl-footer">{footer}</p>
              </Entrance>
            </div>
          </div>
        </div>
      </main>
    </section>
  );
}
