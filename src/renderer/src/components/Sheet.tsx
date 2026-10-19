import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'
import { spring } from '../lib/motion'

/** Sheet do macOS: modal que desce da toolbar. Esc fecha. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  width = 460
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="no-drag fixed inset-0 z-40 flex justify-center bg-[var(--sheet-backdrop)] pt-[52px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            style={{ width, transformOrigin: 'top center' }}
            className="h-fit overflow-hidden rounded-b-panel bg-window-bg shadow-[var(--shadow-panel)]"
            initial={{ y: -24, opacity: 0, scaleY: 0.96 }}
            animate={{ y: 0, opacity: 1, scaleY: 1 }}
            exit={{ y: -16, opacity: 0, scaleY: 0.98 }}
            transition={spring}
          >
            <div className="p-5">
              <h2 className="mb-3 text-base font-semibold">{title}</h2>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
