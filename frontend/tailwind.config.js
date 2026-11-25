/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"SFMono-Regular"', 'Consolas', 'monospace'],
      },
      colors: {
        canvas: '#090c12',
        panel: '#10151e',
        line: '#202936',
        muted: '#8591a3',
        accent: '#a3e635',
      },
    },
  },
  plugins: [],
}
