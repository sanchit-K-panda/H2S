import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Inter Variable'", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono Variable'", "monospace"],
      },
      colors: {
        skybg: "#F8FAFC",
        surface: "#FFFFFF",
        skyborder: "#E2E8F0",
        navy: "#0F172A",
        skytext: "#0F172A",
        skymuted: "#64748B",
        skyaccent: "#1D4ED8",
        status: {
          ontime: "#15803D",
          "ontime-bg": "#F0FDF4",
          "ontime-border": "#BBF7D0",
          minor: "#B45309",
          "minor-bg": "#FFFBEB",
          "minor-border": "#FDE68A",
          severe: "#DC2626",
          "severe-bg": "#FEF2F2",
          "severe-border": "#FECACA",
          cancelled: "#475569",
          "cancelled-bg": "#F8FAFC",
          "cancelled-border": "#E2E8F0",
          spare: "#0E7490",
          "spare-bg": "#ECFEFF",
          "spare-border": "#A5F3FC",
        },
      },
      borderRadius: {
        card: "12px",
        control: "8px",
        badge: "4px",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgb(15 23 42 / 0.05)",
        card: "0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
