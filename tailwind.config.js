/** Cores vêm dos tokens CSS (src/renderer/styles/tokens.css), nunca hex soltos. */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: 'var(--accent)',
        primary: 'var(--primary)',
        'on-primary': 'var(--on-primary)',
        'brand-green': 'var(--brand-green)',
        'brand-graphite': 'var(--brand-graphite)',
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
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)']
      },
      fontSize: {
        base: ['13px', '16px'],
        sm: ['12px', '15px'],
        xs: ['11px', '14px']
      },
      // Sombras pelos tokens. (`shadow-[var(--x)]` não serve: o Tailwind lê var() como cor de sombra.)
      boxShadow: {
        control: 'var(--shadow-control)',
        panel: 'var(--shadow-panel)',
        field: 'var(--shadow-field)'
      },
      borderRadius: {
        // Marca monia: cantos um pouco mais generosos que o padrão do sistema.
        control: '8px',
        panel: '14px'
      }
    }
  },
  plugins: []
}
