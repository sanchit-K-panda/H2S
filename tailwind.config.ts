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
        skybg: "#F5F7FA",
        surface: "#FFFFFF",
        skyborder: "#E4E8EE",
        navy: "#0B1B3A",
        skytext: "#0B1220",
        skymuted: "#5B6577",
        skyaccent: "#2563EB",
        status: {
          ontime: "#0E9F6E",
          "ontime-bg": "#E7F6EF",
          minor: "#B45309",
          "minor-bg": "#FEF3E2",
          severe: "#DC2626",
          "severe-bg": "#FDECEC",
          cancelled: "#64748B",
          "cancelled-bg": "#F1F5F9",
          spare: "#7C3AED",
          "spare-bg": "#F1EAFE",
        },
      },
      borderRadius: {
        card: "14px",
        control: "10px",
        chip: "999px",
      },
      boxShadow: {
        subtle: "0 1px 2px rgb(16 24 40 / 0.06)",
        card: "0 1px 3px rgb(16 24 40 / 0.08), 0 1px 2px rgb(16 24 40 / 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
