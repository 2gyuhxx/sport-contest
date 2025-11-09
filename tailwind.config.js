/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#2563eb',
          secondary: '#1d4ed8',
          accent: '#f97316',
        },
        surface: {
          DEFAULT: '#f8fafc',
          emphasis: '#0f172a',
          subtle: '#e2e8f0',
        },
        region: {
          highlight: '#22c55e',
          focus: '#16a34a',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans KR"', 'system-ui', 'sans-serif'],
        display: ['"Pretendard Variable"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        elevate: '0 20px 45px rgba(15, 23, 42, 0.12)',
      },
      maxWidth: {
        content: '1440px',
      },
    },
  },
  plugins: [],
}
