import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import { App } from './App'
import './styles/tokens.css'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* "user" respeita prefers-reduced-motion do sistema em todas as animações. */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>
)
