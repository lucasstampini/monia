import { motion } from 'framer-motion'
import { useId } from 'react'
import { spring } from '../lib/motion'

interface Option<T extends string | number> {
  value: T
  label: string
}

/** Segmented control do macOS: o "pill" selecionado desliza entre as opções. */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel
}: {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}) {
  const layoutId = useId()
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="no-drag inline-flex h-[24px] rounded-control bg-fill-tertiary p-[2px]">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`relative px-3 text-sm font-medium ${selected ? 'text-label' : 'text-label-secondary'}`}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                transition={spring}
                className="absolute inset-0 rounded-[5px] bg-control-bg shadow-[var(--shadow-control)]"
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
