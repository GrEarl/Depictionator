/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
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
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      colors: {
        ink: 'var(--ink)',
        'ink-secondary': 'var(--ink-secondary)',
        muted: 'var(--muted)',
        bg: 'var(--bg)',
        'bg-elevated': 'var(--bg-elevated)',
        panel: 'var(--panel)',
        'panel-accent': 'var(--panel-accent)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          secondary: 'var(--accent-secondary)',
        },
        border: {
          DEFAULT: 'var(--border)',
          accent: 'var(--border-accent)',
        },
        ring: 'var(--ring)',
      },
      backgroundColor: {
        'accent/10': 'rgba(255, 0, 51, 0.1)',
        'accent/30': 'rgba(255, 0, 51, 0.3)',
      },
      borderColor: {
        'accent/30': 'rgba(255, 0, 51, 0.3)',
      },
      ringColor: {
        'accent/20': 'rgba(255, 0, 51, 0.2)',
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "fade-in": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}