// src/lib/zones.ts
// See-Regeln & Sicherheitszonen für den Lago Maggiore – das, was eine Seekarte
// gegenüber Google Maps auszeichnet. Bewusst klein und ehrlich gehalten:
//
// WICHTIG: Geometrien sind Annäherungen (Bolle-Grenze aus OSM gezogen). Für die
// rechtsverbindlichen Grenzen/Regeln sind die offiziellen Schifffahrtskarten und
// die kantonalen Vorschriften massgeblich. Darum trägt jede Zone einen
// „ca."-Hinweis und die Regeln stehen unter Vorbehalt.

export interface Zone {
  name: string
  note: string
  polygon: [number, number][] // [lat, lon]
}

// Naturschutzgebiet Bolle di Magadino (Verzasca-/Ticino-Delta, Gambarogno).
// Polygon aus OpenStreetMap (way 160197486 „Riserva Bolle di Magadino").
export const ZONES: Zone[] = [
  {
    name: 'Bolle di Magadino',
    note: 'Naturschutzgebiet im Delta – Schifffahrt eingeschränkt/verboten. Grenze ca.; offizielle Karte massgeblich.',
    polygon: [
      [46.15575, 8.87026],
      [46.15097, 8.87043],
      [46.15036, 8.85648],
      [46.15528, 8.85469],
      [46.15611, 8.85434],
      [46.15789, 8.85374],
      [46.16098, 8.85275],
      [46.16395, 8.85172],
      [46.16461, 8.85353],
      [46.16574, 8.85554],
      [46.16663, 8.85696],
      [46.16734, 8.85726],
      [46.16737, 8.86404],
      [46.16642, 8.86408],
      [46.16529, 8.86413],
      [46.1647, 8.86426],
      [46.16411, 8.86437],
      [46.16342, 8.8645],
      [46.16161, 8.86534],
      [46.1613, 8.86537],
      [46.16045, 8.86499],
      [46.15916, 8.86469],
      [46.15771, 8.86531],
      [46.15706, 8.86611],
      [46.15744, 8.86858],
      [46.15745, 8.86996],
      [46.15646, 8.87018],
      [46.15575, 8.87026],
    ],
  },
]

// Kurz-Regeln für die Legende (ohne Gewähr).
export const LAKE_RULES: string[] = [
  'Uferzone 300 m: langsame Fahrt, kein Wasserski/Wakeboard.',
  'Bolle di Magadino: Naturschutz – Fahrverbot bzw. Einschränkung.',
  'Angaben ohne Gewähr – offizielle Schifffahrtskarten massgeblich.',
]
