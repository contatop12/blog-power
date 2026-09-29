/** @type {import('tailwindcss').Config} */

/** Tokens definidos como canais RGB em globals.css — permite `bg-brand/10` etc. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}', './lib/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.4375rem',
        xl: '0.625rem',
      },
      colors: {
        ink: token('ink'),
        muted: token('muted'),
        subtle: token('subtle'),
        canvas: token('canvas'),
        surface: token('surface'),
        line: {
          DEFAULT: token('line'),
          strong: token('line-strong'),
        },
        night: {
          DEFAULT: token('night'),
          soft: token('night-soft'),
        },
        brand: {
          DEFAULT: token('brand'),
          strong: token('brand-strong'),
          soft: token('brand-soft'),
        },
        /** Tintas de processo — uma por etapa do pipeline */
        process: {
          cyan: token('cyan'),
          magenta: token('magenta'),
          yellow: token('yellow'),
          key: token('key'),
        },
        spot: token('spot'),
      },
      keyframes: {
        'stage-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.8)', opacity: '0' },
        },
        'press-pass': {
          from: { clipPath: 'inset(0 100% 0 0)' },
          to: { clipPath: 'inset(0 0 0 0)' },
        },
      },
      animation: {
        'stage-pulse': 'stage-pulse 1.8s ease-out infinite',
        'press-pass': 'press-pass 0.9s cubic-bezier(0.65, 0, 0.35, 1) 0.15s backwards',
      },
    },
  },
  plugins: [],
}
