/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0E14',
        surface: '#141826',
        border: '#242B3D',
        text: '#E8EAF0',
        muted: '#8B93A7',
        accent: '#C9824A',
        teal: '#4FA398',
        danger: '#E5484D',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
