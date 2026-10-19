/** Cores vêm dos tokens CSS (src/renderer/styles/tokens.css), nunca hex soltos. */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: 'var(--accent)',
        label: 'var(--label)',
        'label-secondary': 'var(--secondary-label)',
        'label-tertiary': 'var(--tertiary-label)',
        separator: 'var(--separator)',
        'control-bg': 'var(--control-background)',
        'content-bg': 'var(--content-background)',
        'grouped-bg': 'var(--grouped-background)',
        'window-bg': 'var(--window-background)',
        'fill-quaternary': 'var(--quaternary-fill)',
        'fill-tertiary': 'var(--tertiary-fill)',
        'row-alt': 'var(--alternating-row)',
        expense: 'var(--system-red)',
        income: 'var(--system-green)'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif']
      },
      fontSize: {
        base: ['13px', '16px'],
        sm: ['12px', '15px'],
        xs: ['11px', '14px']
      },
      borderRadius: {
        control: '6px',
        panel: '10px'
      }
    }
  },
  plugins: []
}
