import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { MotionConfig } from 'motion/react'
import '@fontsource-variable/onest'
import './styles.css'
import App from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode><MotionConfig reducedMotion="user"><App /></MotionConfig></StrictMode>,
)
