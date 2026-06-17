// src/screens/MapScreen.tsx
// Interaktive Seekarte für den Lago Maggiore (Locarno/Ascona):
//  - OSM-Basiskacheln + halbtransparentes OpenSeaMap-Seezeichen-Overlay
//  - Live-POIs aus OpenStreetMap (Overpass), nach Kategorie filterbar
//  - aktuelle GPS-Position als Marker + Tacho (km/h und Knoten)
// Leaflet ist eine bewusste Ausnahme von „keine neuen Deps".

import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { usePois } from '../hooks/usePois'
import { useGeoPosition, speedReadout } from '../hooks/useGeoPosition'
import { CATEGORIES, CATEGORY_BY_KEY, type Category, type CategoryKey, type Poi } from '../lib/mapData'

// Karten-Startansicht: Überblick über den nördlichen Lago Maggiore.
const CENTER: L.LatLngTuple = [46.16, 8.8]
const START_ZOOM = 13

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

// DivIcons je Kategorie nur einmal bauen (Leaflet teilt sie über alle Marker).
const iconCache = new Map<CategoryKey, L.DivIcon>()
function iconFor(cat: Category): L.DivIcon {
  let icon = iconCache.get(cat.key)
  if (!icon) {
    icon = L.divIcon({
      className: '', // ohne Leaflet-Default-Weißkasten
      html: `<div class="poi-pin" style="background:${cat.color}">${cat.emoji}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    })
    iconCache.set(cat.key, icon)
  }
  return icon
}

const gpsIcon = L.divIcon({
  className: '',
  html: '<div class="gps-dot"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

export function MapScreen() {
  const elRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const poiLayerRef = useRef<L.LayerGroup | null>(null)
  const meMarkerRef = useRef<L.Marker | null>(null)
  const meCircleRef = useRef<L.Circle | null>(null)
  const [ready, setReady] = useState(false)
  const [follow, setFollow] = useState(false)

  const { pois, loading, error } = usePois()
  const geo = useGeoPosition()

  // Aktive Kategorien (anfangs alle). Set für günstiges Togglen.
  const [active, setActive] = useState<Set<CategoryKey>>(
    () => new Set(CATEGORIES.map((c) => c.key)),
  )

  // --- Karte initialisieren (einmalig; StrictMode-fest über Cleanup) ---------
  useEffect(() => {
    if (mapRef.current || !elRef.current) return

    const map = L.map(elRef.current, {
      center: CENTER,
      zoom: START_ZOOM,
      zoomControl: false, // mobil: Pinch/Scroll; spart Platz für Overlays
      attributionControl: true,
    })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)

    // Nautisches Overlay (Seezeichen/Tonnen/Untiefen), halbtransparent darüber.
    L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      maxZoom: 18,
      opacity: 0.85,
      attribution: '© OpenSeaMap',
    }).addTo(map)

    poiLayerRef.current = L.layerGroup().addTo(map)

    // Nutzergeste beendet das automatische Folgen.
    map.on('dragstart', () => setFollow(false))

    // Container-Größe kann sich (mobile URL-Leiste) ändern → neu vermessen.
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(elRef.current)
    // Direkt nach dem Layout einmal vermessen (Flex-Container).
    requestAnimationFrame(() => map.invalidateSize())

    setReady(true)
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      poiLayerRef.current = null
      meMarkerRef.current = null
      meCircleRef.current = null
      setReady(false)
    }
  }, [])

  // --- POI-Marker rendern (bei Daten- oder Filterwechsel) --------------------
  useEffect(() => {
    const layer = poiLayerRef.current
    if (!ready || !layer) return
    layer.clearLayers()
    for (const poi of pois) {
      if (!active.has(poi.category)) continue
      const cat = CATEGORY_BY_KEY[poi.category]
      const m = L.marker([poi.lat, poi.lon], { icon: iconFor(cat), title: poi.name })
      m.bindPopup(popupHtml(poi, cat))
      m.addTo(layer)
    }
  }, [ready, pois, active])

  // --- GPS-Marker + Genauigkeitskreis aktualisieren --------------------------
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || geo.lat == null || geo.lon == null) return
    const pos: L.LatLngTuple = [geo.lat, geo.lon]

    if (!meMarkerRef.current) {
      meMarkerRef.current = L.marker(pos, { icon: gpsIcon, zIndexOffset: 1000 }).addTo(map)
    } else {
      meMarkerRef.current.setLatLng(pos)
    }

    if (geo.accuracyM != null) {
      if (!meCircleRef.current) {
        meCircleRef.current = L.circle(pos, {
          radius: geo.accuracyM,
          color: '#1C5C8C',
          weight: 1,
          fillColor: '#1C5C8C',
          fillOpacity: 0.12,
        }).addTo(map)
      } else {
        meCircleRef.current.setLatLng(pos).setRadius(geo.accuracyM)
      }
    }

    if (follow) map.panTo(pos, { animate: true })
  }, [ready, geo.lat, geo.lon, geo.accuracyM, follow])

  function toggle(key: CategoryKey) {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // „Mich zentrieren": Folgen einschalten und sofort hinspringen.
  function locate() {
    const map = mapRef.current
    if (!map) return
    setFollow(true)
    if (geo.lat != null && geo.lon != null) {
      map.setView([geo.lat, geo.lon], Math.max(map.getZoom(), 15), { animate: true })
    }
  }

  const speed = useMemo(() => speedReadout(geo.speedMs), [geo.speedMs])

  return (
    <div className="relative h-full w-full">
      {/* Leaflet-Container */}
      <div ref={elRef} className="absolute inset-0 z-0 bg-surface-2" />

      {/* Kategorie-Filter (oben, horizontal scrollbar) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-2">
        <div className="pointer-events-auto flex gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const on = active.has(cat.key)
            return (
              <button
                key={cat.key}
                onClick={() => toggle(cat.key)}
                aria-pressed={on}
                className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-[var(--shadow)] transition-opacity ${
                  on ? 'border-transparent text-white' : 'border-line bg-surface text-ink-3'
                }`}
                style={on ? { background: cat.color } : undefined}
              >
                <span aria-hidden>{cat.emoji}</span>
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tacho (oben links, unter den Chips) */}
      <div className="absolute left-2 top-14 z-[1000] rounded-2xl border border-line bg-surface/95 px-3 py-2 shadow-[var(--shadow)] backdrop-blur-sm">
        <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-2">Tempo</div>
        <div className="flex items-baseline gap-1">
          <span className="tabnum font-mono text-[28px] font-bold leading-none text-ink">
            {speed.kmh}
          </span>
          <span className="text-[11px] font-medium text-ink-2">km/h</span>
        </div>
        <div className="tabnum mt-0.5 font-mono text-[12px] leading-none text-teal">
          {speed.kn} <span className="font-sans text-[10px] font-medium text-ink-2">kn</span>
        </div>
        {geo.error ? (
          <div className="mt-1 max-w-[120px] text-[9px] leading-tight text-danger">{geo.error}</div>
        ) : geo.lat == null ? (
          <div className="mt-1 text-[9px] text-ink-3">GPS sucht…</div>
        ) : null}
      </div>

      {/* POI-Ladezustand (oben rechts, dezent) */}
      {(loading || error) && (
        <div className="absolute right-2 top-14 z-[1000] rounded-lg border border-line bg-surface/95 px-2 py-1 text-[10px] text-ink-2 shadow-[var(--shadow)]">
          {loading ? 'POIs laden…' : 'POIs offline'}
        </div>
      )}

      {/* Mich-zentrieren-Button (unten rechts, über der Attribution) */}
      <button
        onClick={locate}
        aria-label="Auf meine Position zentrieren"
        className={`absolute bottom-9 right-3 z-[1000] flex h-12 w-12 items-center justify-center rounded-full border shadow-[var(--shadow)] ${
          follow ? 'border-transparent bg-accent text-white' : 'border-line bg-surface text-accent'
        }`}
      >
        <LocateIcon />
      </button>
    </div>
  )
}

function popupHtml(poi: Poi, cat: Category): string {
  const parts = [`<strong>${esc(poi.name)}</strong>`]
  if (poi.detail) parts.push(`<span class="poi-popup-sub">${esc(poi.detail)}</span>`)
  parts.push(`<span class="poi-popup-cat">${cat.emoji} ${cat.label}</span>`)

  const links: string[] = []
  if (poi.website)
    links.push(
      `<a href="${esc(poi.website)}" target="_blank" rel="noopener noreferrer">🌐 Website</a>`,
    )
  if (poi.phone)
    links.push(`<a href="tel:${esc(poi.phone.replace(/\s+/g, ''))}">☎ ${esc(poi.phone)}</a>`)
  if (links.length) parts.push(`<span class="poi-popup-links">${links.join(' · ')}</span>`)

  return `<div class="poi-popup">${parts.join('<br>')}</div>`
}

function LocateIcon() {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
