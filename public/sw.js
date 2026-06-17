// public/sw.js — Service Worker für die Bordbuch-PWA.
//
// Strategie:
//  - Navigationen (HTML): network-first, Fallback auf gecachte App-Shell
//    (so startet die App auch offline; online ist immer der frische Stand da).
//  - Statische Assets (JS/CSS/Icons, same-origin): stale-while-revalidate.
//  - Fremd-Origin (Google Apps Script, Open-Meteo, existenz.ch, Fonts):
//    NICHT abfangen → direkt ans Netz. Live-Daten sollen nie veralten und der
//    SW soll sich nicht in CORS-Aufrufe einmischen.
//
// Cache-Version bei Bedarf erhöhen, um alte Einträge zu verwerfen.

const CACHE = 'bordbuch-v1'
const SCOPE = self.registration.scope // z. B. https://…/bordbuch/
const SHELL = [SCOPE, SCOPE + 'index.html', SCOPE + 'manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Live-Daten/Fonts: direkt ans Netz

  // Navigationen: network-first mit Offline-Fallback auf die App-Shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req).then((m) => m || caches.match(SCOPE + 'index.html'))),
    )
    return
  }

  // Statische Assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
