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
        magma: {
          500: '#FF5500',
          400: '#FF6B1A',
          300: '#FF8040',
          600: '#CC4400',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      backdropBlur: {
        glass: '12px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.25s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'pulse-glow-fast': 'pulseGlow 1.2s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'readiness-fill': 'readinessFill 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
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
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(255, 85, 0, 0)',
            borderColor: 'rgba(255, 85, 0, 0.4)',
          },
          '50%': {
            boxShadow: '0 0 16px 4px rgba(255, 85, 0, 0.25)',
            borderColor: 'rgba(255, 85, 0, 0.9)',
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        readinessFill: {
          '0%': { strokeDashoffset: '440' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
