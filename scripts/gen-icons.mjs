// scripts/gen-icons.mjs
// Erzeugt die PWA-Icons (echte PNGs) ohne externe Abhängigkeit – nur node:zlib.
// Motiv: maritimer Kompass (Ring + Nadel) auf marineblauem Grund, passend zu
// den App-Tokens. Neu erzeugen mit:  node scripts/gen-icons.mjs
//
// Ausgabe nach public/: icon-192.png, icon-512.png, maskable-512.png,
// apple-touch-icon.png, favicon-32.png.

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(OUT, { recursive: true })

// Farben (RGB) – marineblau / weiss / teal, abgeleitet aus den Theme-Tokens.
const BG = [16, 42, 67] // #102A43 tiefes Marineblau
const WHITE = [255, 255, 255]
const TEAL = [31, 166, 166] // südliche Nadelhälfte

// --- PNG-Encoder (RGBA, 8 bit) --------------------------------------------
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // 10..12 = compression/filter/interlace = 0
  // Rohdaten mit Filter-Byte 0 pro Zeile
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// --- Geometrie-Helfer (Koordinaten normiert auf [0,1]) --------------------
function inRoundRect(x, y, rr) {
  const ax = Math.abs(x - 0.5)
  const ay = Math.abs(y - 0.5)
  const inner = 0.5 - rr
  if (ax <= inner || ay <= inner) return ax <= 0.5 && ay <= 0.5
  const dx = ax - inner
  const dy = ay - inner
  return dx * dx + dy * dy <= rr * rr
}
function inAnnulus(x, y, rOut, rIn) {
  const d = Math.hypot(x - 0.5, y - 0.5)
  return d <= rOut && d >= rIn
}
function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return !(neg && pos)
}

// Komponiert die Farbe eines (Sub-)Punkts. `scale` schrumpft den Kompass für
// die maskable-Variante (Safe-Zone). `rounded` steuert die Eckenrundung.
function sample(x, y, scale, rounded) {
  // Hintergrund
  const bg = rounded ? inRoundRect(x, y, 0.22) : inRoundRect(x, y, 0)
  if (!bg) return null // transparent ausserhalb (nur bei runden Ecken relevant)

  // Kompass um die Mitte skalieren
  const cx = 0.5 + (x - 0.5) / scale
  const cy = 0.5 + (y - 0.5) / scale

  // Mittel-Hub
  if (Math.hypot(cx - 0.5, cy - 0.5) <= 0.035) return WHITE

  // Nadel (Nord = weiss, Süd = teal)
  const top = [0.5, 0.5 - 0.3]
  const bot = [0.5, 0.5 + 0.3]
  const left = [0.5 - 0.085, 0.5]
  const right = [0.5 + 0.085, 0.5]
  if (inTriangle(cx, cy, top[0], top[1], left[0], left[1], right[0], right[1])) return WHITE
  if (inTriangle(cx, cy, bot[0], bot[1], left[0], left[1], right[0], right[1])) return TEAL

  // Ring
  if (inAnnulus(cx, cy, 0.4, 0.345)) return WHITE

  return BG
}

function render(size, { scale = 1, rounded = true } = {}) {
  const S = 3 // Supersampling für glatte Kanten
  const rgba = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const nx = (x + (sx + 0.5) / S) / size
          const ny = (y + (sy + 0.5) / S) / size
          const c = sample(nx, ny, scale, rounded)
          if (c) {
            r += c[0]
            g += c[1]
            b += c[2]
            a += 255
          }
        }
      }
      const n = S * S
      const i = (y * size + x) * 4
      // Über transparentem Grund: Farbe nur dort, wo Deckung > 0.
      const cov = a / (n * 255)
      rgba[i] = cov > 0 ? Math.round(r / (a / 255)) : 0
      rgba[i + 1] = cov > 0 ? Math.round(g / (a / 255)) : 0
      rgba[i + 2] = cov > 0 ? Math.round(b / (a / 255)) : 0
      rgba[i + 3] = Math.round(cov * 255)
    }
  }
  return encodePng(size, size, rgba)
}

const files = [
  ['icon-192.png', render(192, { rounded: true })],
  ['icon-512.png', render(512, { rounded: true })],
  ['maskable-512.png', render(512, { scale: 0.72, rounded: false })],
  ['apple-touch-icon.png', render(180, { scale: 0.82, rounded: false })],
  ['favicon-32.png', render(32, { rounded: true })],
]
for (const [name, buf] of files) {
  writeFileSync(join(OUT, name), buf)
  console.log(`✓ ${name} (${buf.length} B)`)
}
