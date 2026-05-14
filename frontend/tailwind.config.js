/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:        'var(--bg)',
        'bg-elev': 'var(--bg-elev)',
        'bg-card': 'var(--bg-card)',
        line:      'var(--line)',
        'line-soft': 'var(--line-soft)',
        ink:       'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-mute': 'var(--ink-mute)',
        accent:    'var(--accent)',
        green:     'var(--green)',
        red:       'var(--red)',
        amber:     'var(--amber)',
        blue:      'var(--blue)',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body:    ['Inter Tight', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
