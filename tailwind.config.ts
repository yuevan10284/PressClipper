import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-open-runde)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        // Custom brand colors
        brand: {
          bg: '#F7F5F6',        // Light gray background
          cream: '#F0EBE5',     // Warm cream/beige
          blue: '#2562D1',      // Primary blue
          white: '#FFFFFF',
          black: '#000000',
        },
        // Override defaults for easy use
        primary: {
          50: '#EEF4FF',
          100: '#DCE8FF',
          200: '#B9D1FF',
          300: '#85B0FF',
          400: '#5088F5',
          500: '#2562D1',      // Main blue
          600: '#1E4FAB',
          700: '#183D85',
          800: '#12305F',
          900: '#0C2139',
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};
export default config;
