import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050d1a',
          900: '#0a1628',
          800: '#112240',
          700: '#1a2f52',
          600: '#1e3a5f',
          500: '#2a4f7a',
        },
        teal: {
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
