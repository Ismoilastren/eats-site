/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './stores/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF4ED',
          100: '#FFE6D5',
          200: '#FECCAA',
          300: '#FDAB74',
          400: '#FB8C3C',
          500: '#FF6B35',
          600: '#E04D16',
          700: '#B93A10',
          800: '#943114',
          900: '#782B14',
        },
      },
    },
  },
  plugins: [],
};
