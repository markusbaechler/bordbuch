import { describe, it, expect } from 'vitest'
import type { Entry } from './types'
import {
  BOAT_PROFILE,
  tankRange,
  maintenanceReport,
  maintenanceSummary,
} from './boat'

function entry(p: Partial<Entry> & { id: string; date: string }): Entry {
  return {
    createdAt: '',
    updatedAt: '',
    harborFrom: 'Ascona',
    harborTo: '',
    engineHours: null,
    fuelLiters: null,
    fuelCostChf: null,
    paidBy: '',
    notes: '',
    weatherTempC: null,
    weatherWindKn: null,
    weatherWindDir: null,
    weatherDesc: '',
    ...p,
  }
}

describe('tankRange – statisch', () => {
  it('290 l ÷ Ø l/h = Motorlaufzeit pro Tankfüllung', () => {
    const r = tankRange([], 10) // 10 l/h
    expect(r.fullTankHours).toBeCloseTo(29) // 290 / 10
    expect(r.fullTankNm).toBeCloseTo(29 * BOAT_PROFILE.cruiseKn)
    expect(r.hasCurrent).toBe(false) // ohne Tankstopp keine aktuelle Schätzung
  })

  it('ohne Ø-Verbrauch keine Reichweite', () => {
    const r = tankRange([], null)
    expect(r.fullTankHours).toBeNull()
    expect(r.hasCurrent).toBe(false)
  })
})

describe('tankRange – aktuell (seit letztem Tankstopp)', () => {
  it('zieht den seit dem letzten Volltanken geschätzten Verbrauch ab', () => {
    const entries = [
      entry({ id: 'a', date: '2026-05-01', engineHours: 1000, fuelLiters: 200 }), // Tankstopp @1000 h
      entry({ id: 'b', date: '2026-06-01', engineHours: 1010 }), // 10 h gefahren
    ]
    const r = tankRange(entries, 10) // 10 l/h → 100 l verbraucht
    expect(r.hasCurrent).toBe(true)
    expect(r.hoursSinceFill).toBe(10)
    expect(r.currentLiters).toBeCloseTo(190) // 290 − 100
    expect(r.currentPct).toBeCloseTo((190 / 290) * 100)
    expect(r.currentHours).toBeCloseTo(19) // 190 / 10
  })

  it('Restmenge wird bei 0 gekappt (mehr verbraucht als Tankinhalt)', () => {
    const entries = [
      entry({ id: 'a', date: '2026-05-01', engineHours: 1000, fuelLiters: 200 }),
      entry({ id: 'b', date: '2026-06-01', engineHours: 1100 }), // 100 h × 10 = 1000 l
    ]
    const r = tankRange(entries, 10)
    expect(r.currentLiters).toBe(0)
    expect(r.currentHours).toBe(0)
  })
})

describe('maintenanceReport', () => {
  // Service-Baseline = erster Eintrag des jüngsten Jahres (Saisonstart/Winterlager).
  const entries = [
    entry({ id: 'a', date: '2026-04-15', engineHours: 1000 }), // Saisonstart 2026, Service hier
    entry({ id: 'b', date: '2026-05-20', engineHours: 1030 }),
    entry({ id: 'c', date: '2026-06-10', engineHours: 1060 }),
  ]

  it('leitet den letzten Service aus dem ersten Eintrag des Jahres ab', () => {
    const rep = maintenanceReport(entries, new Date(2026, 5, 18))
    expect(rep.serviceYear).toBe(2026)
    expect(rep.serviceDate).toBe('2026-04-15')
    expect(rep.serviceHours).toBe(1000)
    expect(rep.currentHours).toBe(1060)
    expect(rep.newSeasonPending).toBe(false)
  })

  it('Motoröl (100 h) wird fällig, sobald 100 h seit Service erreicht sind', () => {
    // 60 h gefahren (1000 → 1060) ~2 Monate: noch ok.
    const ok = maintenanceReport(entries, new Date(2026, 5, 18))
    expect(ok.items.find((i) => i.key === 'engine-oil')!.status).toBe('ok')

    // 105 h gefahren → über 100-h-Intervall → fällig.
    const heavy = [...entries, entry({ id: 'd', date: '2026-06-15', engineHours: 1105 })]
    const rep = maintenanceReport(heavy, new Date(2026, 5, 18))
    const oil = rep.items.find((i) => i.key === 'engine-oil')!
    expect(oil.status).toBe('due')
    expect(oil.dueInHours).toBeLessThan(0)
  })

  it('„bald fällig" bei ≥80 % des Intervalls', () => {
    const near = [...entries, entry({ id: 'd', date: '2026-06-15', engineHours: 1085 })] // 85 h
    const oil = maintenanceReport(near, new Date(2026, 5, 18)).items.find(
      (i) => i.key === 'engine-oil',
    )!
    expect(oil.status).toBe('soon')
  })

  it('neue Saison ohne Service-Eintrag → Monatsintervall macht jährliche Posten fällig', () => {
    // Letzter Service 2025, „heute" tief im 2026 ohne 2026-Eintrag.
    const lastYear = [entry({ id: 'a', date: '2025-04-15', engineHours: 1000 })]
    const rep = maintenanceReport(lastYear, new Date(2026, 6, 1)) // ~14,5 Monate später
    expect(rep.serviceYear).toBe(2025)
    expect(rep.newSeasonPending).toBe(true)
    // Jährliche Posten (z. B. Opferanoden, intervalMonths 12) sind überfällig.
    expect(rep.items.find((i) => i.key === 'anodes')!.status).toBe('due')
  })

  it('ohne Einträge → alles unknown', () => {
    const rep = maintenanceReport([], new Date(2026, 5, 18))
    expect(rep.serviceYear).toBeNull()
    expect(rep.items.every((i) => i.status === 'unknown')).toBe(true)
  })
})

describe('maintenanceSummary', () => {
  it('zählt fällige und bald fällige Positionen', () => {
    const heavy = [
      entry({ id: 'a', date: '2026-04-15', engineHours: 1000 }),
      entry({ id: 'd', date: '2026-06-15', engineHours: 1105 }), // Öl + Kraftstofffilter (100 h) fällig
    ]
    const rep = maintenanceReport(heavy, new Date(2026, 5, 18))
    const s = maintenanceSummary(rep.items)
    expect(s.due).toBeGreaterThanOrEqual(2)
  })
})
