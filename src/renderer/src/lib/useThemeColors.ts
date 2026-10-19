import { useEffect, useState } from 'react'

const TOKENS = {
  primary: '--chart-primary',
  primaryMuted: '--chart-primary-muted',
  gain: '--chart-gain',
  loss: '--chart-loss',
  series1: '--chart-series-1',
  series2: '--chart-series-2',
  series3: '--chart-series-3',
  series4: '--chart-series-4',
  series5: '--chart-series-5',
  series6: '--chart-series-6',
  red: '--system-red',
  surface: '--control-background',
  grid: '--chart-grid',
  axis: '--chart-axis',
  label: '--label',
  secondaryLabel: '--secondary-label'
} as const

export type ThemeColors = Record<keyof typeof TOKENS, string>

function read(): ThemeColors {
  const style = getComputedStyle(document.documentElement)
  return Object.fromEntries(
    Object.entries(TOKENS).map(([name, token]) => [name, style.getPropertyValue(token).trim()])
  ) as ThemeColors
}

/**
 * Recharts escreve cores como atributos SVG, então resolvemos os tokens CSS
 * para valores concretos e relemos quando o tema claro/escuro muda.
 */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState(read)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setColors(read())
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return colors
}
