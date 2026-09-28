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
      },
      keyframes: {
        'stage-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'stage-pulse': 'stage-pulse 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
}
