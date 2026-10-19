import type { Transition } from 'framer-motion'

/** Springs curtos e amortecidos, como as animações do sistema. */
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 38, mass: 0.8 }
export const softSpring: Transition = { type: 'spring', stiffness: 300, damping: 34 }
