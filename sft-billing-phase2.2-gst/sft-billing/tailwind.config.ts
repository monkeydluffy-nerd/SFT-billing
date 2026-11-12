import type { Config } from "tailwindcss";

// Every color, radius, shadow, and duration below reads from the CSS
// variables defined in src/styles/tokens.css — nothing here is a raw hex
// value. That's what lets the light/dark themes and any future rebrand
// happen in one file instead of hunting through components.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        header: "rgb(var(--color-header) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-raised": "rgb(var(--color-surface-raised) / <alpha-value>)",
        sidebar: "rgb(var(--color-sidebar) / <alpha-value>)",
        "sidebar-ink": "rgb(var(--color-sidebar-ink) / <alpha-value>)",
        "sidebar-muted": "rgb(var(--color-sidebar-muted) / <alpha-value>)",
        "sidebar-border": "rgb(var(--color-sidebar-border) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        "ink-muted": "rgb(var(--color-ink-muted) / <alpha-value>)",
        "ink-faint": "rgb(var(--color-ink-faint) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        "border-strong": "rgb(var(--color-border-strong) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "accent-ink": "rgb(var(--color-accent-ink) / <alpha-value>)",
        premium: "rgb(var(--color-premium) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        "success-bg": "rgb(var(--color-success-bg) / <alpha-value>)",
        caution: "rgb(var(--color-caution) / <alpha-value>)",
        "caution-bg": "rgb(var(--color-caution-bg) / <alpha-value>)",
        overdue: "rgb(var(--color-overdue) / <alpha-value>)",
        "overdue-bg": "rgb(var(--color-overdue-bg) / <alpha-value>)",
        "overdue-strong": "rgb(var(--color-overdue-strong) / <alpha-value>)",
        "overdue-strong-bg": "rgb(var(--color-overdue-strong-bg) / <alpha-value>)",
        neutral: "rgb(var(--color-neutral) / <alpha-value>)",
        "neutral-bg": "rgb(var(--color-neutral-bg) / <alpha-value>)",
        pending: "rgb(var(--color-pending) / <alpha-value>)",
        "pending-bg": "rgb(var(--color-pending-bg) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "12px",
        lg: "var(--radius-md)",
        xl: "var(--radius-lg)",
        "2xl": "var(--radius-lg)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
        "float-lg": "var(--shadow-float-lg)",
      },
      transitionDuration: {
        micro: "var(--duration-micro)",
        panel: "var(--duration-panel)",
      },
      spacing: {
        18: "4.5rem",
      },
      fontSize: {
        // A restrained scale — see blueprint §2.2. Numbers throughout the
        // app use `tabular-nums` (applied via the `.font-tabular` utility
        // in tokens.css) rather than a separate numeric font size scale.
        xs: ["0.75rem", { lineHeight: "1.4" }],
        sm: ["0.8125rem", { lineHeight: "1.5" }],
        base: ["0.9375rem", { lineHeight: "1.6" }],
        lg: ["1.125rem", { lineHeight: "1.5" }],
        xl: ["1.375rem", { lineHeight: "1.35" }],
        "2xl": ["1.75rem", { lineHeight: "1.25" }],
        hero: ["2rem", { lineHeight: "1.15", letterSpacing: "-0.025em" }],
        "hero-lg": ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.03em" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
