/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Identical to scorva-v1 — uses the same CSS variable palette
        scorva: {
          bg:             'rgb(var(--scorva-bg) / <alpha-value>)',
          surface:        'rgb(var(--scorva-surface) / <alpha-value>)',
          card:           'rgb(var(--scorva-card) / <alpha-value>)',
          border:         'rgb(var(--scorva-border) / <alpha-value>)',
          hover:          'rgb(var(--scorva-hover) / <alpha-value>)',
          accent:         'rgb(var(--scorva-accent) / <alpha-value>)',
          'accent-light': 'rgb(var(--scorva-accent-light) / <alpha-value>)',
          'accent-dark':  'rgb(var(--scorva-accent-dark) / <alpha-value>)',
          cyan:           'rgb(var(--scorva-cyan) / <alpha-value>)',
          gold:           'rgb(var(--scorva-gold) / <alpha-value>)',
          text:           'rgb(var(--scorva-text) / <alpha-value>)',
          muted:          'rgb(var(--scorva-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink':      'blink 1.2s step-end infinite',
        'float':      'float 6s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};
