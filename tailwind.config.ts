import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cy: {
          navy: "#003c64",
          blue: { 100: "#e2f2fb", 200: "#b3ddf4", 300: "#6ec1e8", 500: "#1f8ed6", 600: "#0071bc", 700: "#005a94", 800: "#00456f" },
          cyan: { 500: "#2fbedf" },
          red: { 100: "#fbe3e2", 300: "#eb7b76", 500: "#cd2026", 600: "#a31a1e" },
          green: { 100: "#e0f3e7", 500: "#009245", 600: "#00753a" },
          amber: { 100: "#fdf0d8", 400: "#e9a123", 500: "#cf8408", 600: "#a06504" },
          gray: { "000": "#ffffff", "025": "#f8f9fa", "050": "#f1f3f5", 100: "#e6e9ec", 200: "#d3d8dd", 300: "#b0b7bf", 400: "#8a929b", 500: "#6c7480", 600: "#595959", 700: "#404040", 800: "#2b2f34", 900: "#1b1f24" },
        },
      },
      borderRadius: { DEFAULT: "3px", card: "5px" },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"], mono: ["var(--font-mono)", "monospace"] },
      boxShadow: { xs: "0 1px 2px rgba(16,19,23,.06)", md: "0 2px 8px rgba(16,19,23,.10)" },
      letterSpacing: { eyebrow: ".14em", label: ".10em" },
      transitionDuration: { fast: "140ms", base: "200ms" },
    },
  },
  plugins: [],
};

export default config;
