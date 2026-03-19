import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "var(--radius)",
        sm: "var(--radius)",
      },
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: "hsl(var(--card) / <alpha-value>)",
        "card-foreground": "hsl(var(--card-foreground) / <alpha-value>)",
        overlay: "hsl(var(--overlay) / <alpha-value>)",
        panel: "hsl(var(--panel) / <alpha-value>)",
        "panel-raised": "hsl(var(--panel-raised) / <alpha-value>)",
        "panel-inset": "hsl(var(--panel-inset) / <alpha-value>)",
        "panel-active": "hsl(var(--panel-active) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        secondary: "hsl(var(--secondary) / <alpha-value>)",
        "muted-foreground": "hsl(var(--muted-foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        "accent-hover": "hsl(var(--accent-hover) / <alpha-value>)",
        "accent-foreground": "hsl(var(--accent-foreground) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)",
        info: "hsl(var(--info) / <alpha-value>)",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', '"Segoe UI"', "ui-sans-serif", "sans-serif"],
        display: ['"IBM Plex Sans"', '"Segoe UI"', "ui-sans-serif", "sans-serif"],
        mono: ['"IBM Plex Mono"', '"SFMono-Regular"', "Menlo", "Monaco", "ui-monospace", "monospace"],
      },
    },
  },
};

export default config;
