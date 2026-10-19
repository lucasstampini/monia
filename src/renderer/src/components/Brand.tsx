/**
 * Identidade monia: ":" + cursor — a IA calculando e respondendo.
 * Símbolo desenhado em SVG (grade de 96) a partir do arquivo de marca.
 */
export function MoniaMark({ size = 24, variant = 'dark' }: { size?: number; variant?: 'dark' | 'light' }) {
  const background = variant === 'dark' ? 'var(--brand-graphite)' : '#F5F5F7'
  const dots = variant === 'dark' ? 'var(--brand-green)' : 'oklch(0.55 0.17 150)'
  const cursor = variant === 'dark' ? '#F5F5F7' : 'var(--brand-graphite)'
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="monia" className="shrink-0">
      <rect width="96" height="96" rx="24" fill={background} />
      <circle cx="31" cy="34" r="7" fill={dots} />
      <circle cx="31" cy="62" r="7" fill={dots} />
      <rect x="48" y="63" width="24" height="6" fill={cursor} />
    </svg>
  )
}

/** Nome sempre em minúsculas, com o cursor verde piscando (parado se o sistema pede menos movimento). */
export function MoniaWordmark({ size = 17 }: { size?: number }) {
  return (
    <span className="inline-flex items-baseline" style={{ gap: size * 0.06 }}>
      <span className="font-semibold leading-none" style={{ fontSize: size, letterSpacing: '-0.04em' }}>
        monia
      </span>
      <span
        aria-hidden
        className="monia-cursor inline-block bg-brand-green"
        style={{ width: size * 0.36, height: Math.max(2, size * 0.09) }}
      />
    </span>
  )
}
