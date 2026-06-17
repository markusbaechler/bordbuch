import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: Service Worker registrieren (nur im Production-Build, base-pfad-bewusst).
// Im Dev-Server bewusst deaktiviert, um Caching-Überraschungen zu vermeiden.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      /* Registrierung fehlgeschlagen – App läuft trotzdem ohne Offline-Support. */
    })
  })
}
