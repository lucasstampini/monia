import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { spring } from '../lib/motion'

/** Popover ancorado no botão que o abre. Fecha com clique fora ou Esc. */
export function Popover({
  trigger,
  children,
  align = 'end'
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: ReactNode
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false)
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="no-drag relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      <AnimatePresence>
        {open && (
          <motion.div
            className={`absolute top-full z-30 mt-2 min-w-[240px] rounded-panel bg-window-bg p-3 shadow-[var(--shadow-panel)] ${align === 'end' ? 'right-0' : 'left-0'}`}
            style={{ transformOrigin: align === 'end' ? 'top right' : 'top left' }}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={spring}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
