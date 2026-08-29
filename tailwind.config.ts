import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0c0a08',
          900: '#14110e',
          800: '#1c1814',
          700: '#2a241e',
          600: '#3d342b',
        },
        ember: {
          50: '#fff7ed',
          100: '#ffedd4',
          300: '#f5b56a',
          400: '#f09a3e',
          500: '#e07a1f',
          600: '#c45f12',
        },
        parchment: {
          50: '#faf6f0',
          100: '#f3ebe0',
          300: '#d4c4ae',
          400: '#b8a48c',
          500: '#8f7d68',
        },
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
        display: ['var(--font-newsreader)', 'Georgia', 'serif'],
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(224, 122, 31, 0.35)',
        card: '0 18px 40px -24px rgba(0, 0, 0, 0.55)',
      },
    },
  },
  plugins: [],
}

export default config
