import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0f",
        surface: "#12121a",
        "surface-2": "#1a1a26",
        "surface-3": "#222233",
        border: "#1e1e2e",
        "border-2": "#2a2a3e",
        primary: {
          DEFAULT: "#0066ff",
          hover: "#0052cc",
          light: "#3385ff",
          glow: "rgba(0, 102, 255, 0.3)",
        },
        secondary: {
          DEFAULT: "#00d4ff",
          hover: "#00aacc",
          light: "#33ddff",
          glow: "rgba(0, 212, 255, 0.3)",
        },
        accent: {
          orange: "#ff6b00",
          green: "#00ff88",
          red: "#ff3366",
          yellow: "#ffd700",
          purple: "#9933ff",
        },
        text: {
          primary: "#e8e8f0",
          secondary: "#9898b0",
          muted: "#5a5a78",
          disabled: "#3a3a55",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        "glow-blue": "0 0 20px rgba(0, 102, 255, 0.4)",
        "glow-cyan": "0 0 20px rgba(0, 212, 255, 0.4)",
        "glow-sm": "0 0 10px rgba(0, 102, 255, 0.2)",
        "inner-dark": "inset 0 2px 8px rgba(0, 0, 0, 0.4)",
        panel: "0 4px 24px rgba(0, 0, 0, 0.6)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "grid-pattern":
          "linear-gradient(rgba(30,30,46,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(30,30,46,0.5) 1px, transparent 1px)",
        "gradient-surface":
          "linear-gradient(135deg, #12121a 0%, #1a1a26 100%)",
      },
      backgroundSize: {
        grid: "40px 40px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 3s linear infinite",
        "scan-line": "scanLine 2s linear infinite",
        shimmer: "shimmer 2s linear infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "slide-in-left": "slideInLeft 0.3s ease-out",
      },
      keyframes: {
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
