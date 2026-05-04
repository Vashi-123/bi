import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // Path to Tremor module
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dashboard brand palette
        // Dashboard brand palette for Tremor compatibility
        brand1: { 500: "#8F3F48" },
        brand2: { 500: "#638994" },
        brand3: { 500: "#FF843B" },
        brand4: { 500: "#79783F" },
        brand5: { 500: "#A68B7A" },
        brand6: { 500: "#000000" },
        brand: {
          faint: "#eff6ff",
          muted: "#bfdbfe",
          subtle: "#60a5fa",
          DEFAULT: "#3b82f6",
          emphasis: "#1d4ed8",
          inverted: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};
export default config;
