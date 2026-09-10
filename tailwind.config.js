/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // 터치 기기에서 탭한 뒤 hover 색이 남는 문제를 막는다.
  // 모든 hover: 유틸을 @media (hover: hover)로 감싸 마우스가 있는 기기에서만 적용된다.
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      screens: {
        sm: '900px',
      },
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        border: 'var(--border)',
        ink: 'var(--text)',
        dim: 'var(--text-dim)',
        accent: 'var(--accent)',
        accenthover: 'var(--accent-hover)',
        accentsoft: 'var(--accent-soft)',
        danger: 'var(--danger)',
        dangersoft: 'var(--danger-soft)',
        ok: 'var(--ok)',
        highlight: 'var(--highlight)',
      },
      fontFamily: {
        sans: ['"Noto Sans KR"', 'sans-serif'],
        mono: ['"Source Code Pro"', 'monospace'],
        serif: ['Ridibatang', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--shadow)',
      },
    },
  },
  plugins: [],
}
