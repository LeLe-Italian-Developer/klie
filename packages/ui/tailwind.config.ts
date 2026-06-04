import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  darkMode: "class",
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: [
    "../../apps/web/**/*.{ts,tsx,js,jsx,mdx}",
    "../../apps/desktop/**/*.{ts,tsx,js,jsx,mdx}",
    "../../packages/ui/**/*.{ts,tsx,js,jsx,mdx}",
    "../../packages/shared-types/**/*.{ts,tsx,js,jsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "Inter", "system-ui", "sans-serif"],
        body: ["'Manrope'", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        surface: {
          900: "hsl(var(--surface-900) / <alpha-value>)",
          800: "hsl(var(--surface-800) / <alpha-value>)",
          700: "hsl(var(--surface-700) / <alpha-value>)",
          100: "hsl(var(--surface-100) / <alpha-value>)",
          glass: "hsl(var(--surface-glass) / <alpha-value>)",
        },
        primary: {
          500: "hsl(var(--primary-500) / <alpha-value>)",
          400: "hsl(var(--primary-400) / <alpha-value>)",
          300: "hsl(var(--primary-300) / <alpha-value>)",
        },
        text: {
          high: "hsl(var(--text-high) / <alpha-value>)",
          muted: "hsl(var(--text-muted) / <alpha-value>)",
          subtle: "hsl(var(--text-subtle) / <alpha-value>)",
          onOverlay: "hsl(var(--text-on-overlay) / <alpha-value>)",
        },
        border: {
          subtle: "hsl(var(--border-subtle) / <alpha-value>)",
        },
        overlay: {
          bg: "var(--overlay-bg)",
          "bg-hover": "var(--overlay-bg-hover)",
        },
      },
      boxShadow: {
        glass: "0 20px 60px -30px rgba(0,0,0,0.55)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem",
        pill: "999px",
      },
      backdropBlur: {
        xs: "2px",
        sm: "6px",
        md: "10px",
      },
      backgroundImage: {
        "glass-gradient":
          "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 60%, rgba(255,255,255,0.00) 100%)",
      },
    },
  },
  plugins: [
    plugin(({ addComponents, theme }) => {
      addComponents({
        ".glass-card": {
          backgroundColor: theme("colors.surface.glass"),
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: `${theme("boxShadow.glass")}, ${theme("boxShadow.inset")}`,
          border: `1px solid ${theme("colors.border.subtle")}`,
        },
        ".glass-pill": {
          backgroundColor: theme("colors.surface.glass"),
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderRadius: theme("borderRadius.pill"),
          boxShadow: theme("boxShadow.inset"),
          border: `1px solid ${theme("colors.border.subtle")}`,
        },
      });
    }),
  ],
};

export default config;
