import type { Config } from 'tailwindcss';

/**
 * Colors come from CSS variables (see src/app/theme.css) so a theme switch
 * only changes `data-theme` on <html>. Never hard-code colors in components.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'rgb(var(--pn-page) / <alpha-value>)',
        surface: 'rgb(var(--pn-surface) / <alpha-value>)',
        ink: 'rgb(var(--pn-text) / <alpha-value>)',
        muted: 'rgb(var(--pn-muted) / <alpha-value>)',
        accent: 'rgb(var(--pn-accent) / <alpha-value>)',
        'on-accent': 'rgb(var(--pn-on-accent) / <alpha-value>)',
        line: 'rgb(var(--pn-line) / <alpha-value>)',
      },
      borderRadius: { card: '12px', sheet: '20px' },
      fontFamily: {
        sans: ['var(--pn-font-sans)'],
      },
      spacing: { touch: '44px' },
    },
  },
  plugins: [],
};

export default config;
