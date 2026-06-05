import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        diamond: {
          900: '#0b1437',
          800: '#12204d',
          700: '#1b2c66',
          500: '#3a52a8',
          300: '#8aa0e8',
        },
        success: '#16a34a',
        warning: '#eab308',
        danger: '#dc2626',
      },
    },
  },
  plugins: [],
};

export default config;
