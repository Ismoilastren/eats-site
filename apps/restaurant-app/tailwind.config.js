/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#f59e0b', // amber-500
          dark: '#d97706', // amber-600
          light: '#fcd34d', // amber-300
        },
        secondary: {
          DEFAULT: '#ea580c', // orange-600
        }
      }
    },
  },
  plugins: [],
};
