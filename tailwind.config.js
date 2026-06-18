/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        // Restrained monochrome system. A near-white canvas, true-neutral grays, and
        // a single accent reserved for active state / focus. Depth comes from 1px
        // hairlines, not shadows. Primary actions are near-black ink, not the accent —
        // the deliberate move that separates this from generic "indigo SaaS" templates.
        canvas: "#f7f8f8",
        surface: {
          DEFAULT: "#ffffff",
          raised: "#ffffff",
          hover: "#f3f4f5",
        },
        line: {
          DEFAULT: "#e6e8ea",
          soft: "#eef0f1",
          strong: "#d6d9dc",
        },
        ink: {
          DEFAULT: "#16181c",
          strong: "#3a3f47",
          muted: "#5c636d",
          faint: "#969ca5",
        },
        // Single accent — a deep, slightly cool blue. Used for selection, active tabs,
        // focus rings and key emphasis only; never as decorative fill.
        brand: {
          DEFAULT: "#2d5be8",
          soft: "#4a73ee",
          dim: "#1f47c2",
        },
        ok: "#059669",
        warn: "#d97706",
        danger: "#dc2626",
        critical: "#e11d48",
        info: "#2563eb",
      },
      boxShadow: {
        // Nearly invisible, highly diffused — depth is implied, never announced.
        drawer: "-24px 0 60px -24px rgba(16,24,40,0.16)",
        card: "0 1px 2px 0 rgba(16,24,40,0.04)",
        cardLg: "0 8px 24px -12px rgba(16,24,40,0.10)",
        pop: "0 16px 48px -16px rgba(16,24,40,0.20)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.18s ease-out",
        "slide-in": "slide-in 0.22s cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [],
};
