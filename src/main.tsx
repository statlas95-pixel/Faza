import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/golos-text/cyrillic-400.css'
import '@fontsource/golos-text/cyrillic-500.css'
import '@fontsource/golos-text/cyrillic-600.css'
import '@fontsource/golos-text/latin-400.css'
import '@fontsource/golos-text/latin-500.css'
import '@fontsource/golos-text/latin-600.css'
import '@fontsource/playfair-display/cyrillic-500.css'
import '@fontsource/playfair-display/cyrillic-700.css'
import '@fontsource/playfair-display/cyrillic-500-italic.css'
import '@fontsource/playfair-display/latin-500.css'
import '@fontsource/playfair-display/latin-700.css'
import '@fontsource/caveat/cyrillic-500.css'
import '@fontsource/caveat/cyrillic-700.css'
import '@fontsource/caveat/latin-500.css'
import '@fontsource/jetbrains-mono/cyrillic-400.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-600.css'
import 'katex/dist/katex.min.css'
import './styles.css'
import { loadLanguage } from './language'

async function start() {
  await loadLanguage()
  const { default: App } = await import('./App')
  createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
}
void start()
