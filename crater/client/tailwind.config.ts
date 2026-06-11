import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        space: {
          DEFAULT: 'rgb(var(--color-space) / <alpha-value>)',
          card: 'rgb(var(--color-space-card) / <alpha-value>)',
          elevated: 'rgb(var(--color-space-elevated) / <alpha-value>)',
          border: 'rgb(var(--color-space-border) / <alpha-value>)',
        },
        slate: {
          50: 'rgb(var(--color-slate-50) / <alpha-value>)',
          100: 'rgb(var(--color-slate-100) / <alpha-value>)',
          200: 'rgb(var(--color-slate-200) / <alpha-value>)',
          300: 'rgb(var(--color-slate-300) / <alpha-value>)',
          400: 'rgb(var(--color-slate-400) / <alpha-value>)',
          500: 'rgb(var(--color-slate-500) / <alpha-value>)',
          600: 'rgb(var(--color-slate-600) / <alpha-value>)',
          700: 'rgb(var(--color-slate-700) / <alpha-value>)',
          800: 'rgb(var(--color-slate-800) / <alpha-value>)',
          900: 'rgb(var(--color-slate-900) / <alpha-value>)',
          950: 'rgb(var(--color-slate-950) / <alpha-value>)',
        },
        cyan: { neon: 'rgb(var(--color-cyan-neon) / <alpha-value>)' },
        purple: { electric: 'rgb(var(--color-purple-electric) / <alpha-value>)' },
        green: { matrix: 'rgb(var(--color-green-matrix) / <alpha-value>)' },
        red: { alert: 'rgb(var(--color-red-alert) / <alpha-value>)' },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgba(0, 245, 255, 0.1)',
        'glow-cyan-md': '0 0 20px rgba(0, 245, 255, 0.2)',
        'glow-purple': '0 0 15px rgba(112, 0, 255, 0.15)',
      },
    },
  },
  plugins: [],
}

export default config
