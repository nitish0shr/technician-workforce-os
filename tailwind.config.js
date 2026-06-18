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
        // Light, soft-neutral premium SaaS palette. Cards are white and pop off a
        // gentle gray canvas via subtle shadows + hairline borders.
        canvas: "#f6f7f9",
        surface: {
          DEFAULT: "#ffffff",
          raised: "#ffffff",
          hover: "#f1f3f6",
        },
        line: {
          DEFAULT: "#e4e7ec",
          soft: "#eef1f4",
        },
        ink: {
          DEFAULT: "#15181f",
          strong: "#3f4654",
          muted: "#5a6473",
          faint: "#98a0ad",
        },
        brand: {
          DEFAULT: "#4f46e5",
          soft: "#6366f1",
          dim: "#4f46e5",
        },
        ok: "#059669",
        warn: "#d97706",
        danger: "#dc2626",
        critical: "#e11d48",
        info: "#2563eb",
      },
      boxShadow: {
        drawer: "-24px 0 60px -20px rgba(16,24,40,0.18)",
        card: "0 1px 2px 0 rgba(16,24,40,0.04), 0 1px 3px 0 rgba(16,24,40,0.06)",
        cardLg: "0 4px 12px -2px rgba(16,24,40,0.10), 0 2px 6px -2px rgba(16,24,40,0.06)",
        pop: "0 12px 40px -12px rgba(16,24,40,0.22)",
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
