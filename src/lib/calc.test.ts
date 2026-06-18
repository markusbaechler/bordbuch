import { describe, it, expect } from 'vitest'
import type { Entry } from './types'
import {
  byDateAsc,
  byDateDesc,
  maxEngineHours,
  hoursPerEntry,
  hoursSinceStart,
  consumptionPerEntry,
  yearStatsAll,
  totalStats,
} from './calc'

/**
 * Test-Helfer: baut einen vollständigen Entry mit sinnvollen Defaults, sodass
 * jeder Test nur die fürs Szenario relevanten Felder setzen muss.
 */
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

describe('maxEngineHours', () => {
  it('liefert den höchsten Zählerstand', () => {
    expect(
      maxEngineHours([
        entry({ id: 'a', date: '2020-01-01', engineHours: 100 }),
        entry({ id: 'b', date: '2020-02-01', engineHours: 150 }),
        entry({ id: 'c', date: '2020-03-01', engineHours: 130 }),
      ]),
    ).toBe(150)
  })

  it('ignoriert fehlende Werte und liefert null bei leerer Liste', () => {
    expect(maxEngineHours([])).toBeNull()
    expect(
      maxEngineHours([entry({ id: 'a', date: '2020-01-01', engineHours: null })]),
    ).toBeNull()
  })
})

describe('Sortierung', () => {
  it('byDateAsc/Desc sortiert nach Datum, dann Zählerstand, dann id', () => {
    const e1 = entry({ id: 'z', date: '2020-01-01', engineHours: 100 })
    const e2 = entry({ id: 'a', date: '2020-01-01', engineHours: 100 }) // gleiches Datum+Stand → id
    const e3 = entry({ id: 'm', date: '2020-01-01', engineHours: 120 }) // gleiches Datum → Stand
    const e4 = entry({ id: 'b', date: '2019-12-31', engineHours: 999 }) // frühestes Datum

    const asc = [e1, e2, e3, e4].sort(byDateAsc).map((e) => e.id)
    expect(asc).toEqual(['b', 'a', 'z', 'm'])

    const desc = [e1, e2, e3, e4].sort(byDateDesc).map((e) => e.id)
    expect(desc).toEqual(asc.slice().reverse())
  })
})

describe('hoursPerEntry', () => {
  it('erster Eintrag = 0, danach Differenz zum vorherigen Zählerstand', () => {
    const res = hoursPerEntry([
      entry({ id: 'a', date: '2020-01-01', engineHours: 100 }),
      entry({ id: 'b', date: '2020-02-01', engineHours: 110 }),
      entry({ id: 'c', date: '2020-03-01', engineHours: 130 }),
    ])
    expect(res).toEqual({ a: 0, b: 10, c: 20 })
  })

  it('sortiert intern – Eingabereihenfolge egal', () => {
    const res = hoursPerEntry([
      entry({ id: 'c', date: '2020-03-01', engineHours: 130 }),
      entry({ id: 'a', date: '2020-01-01', engineHours: 100 }),
      entry({ id: 'b', date: '2020-02-01', engineHours: 110 }),
    ])
    expect(res).toEqual({ a: 0, b: 10, c: 20 })
  })

  it('negative Differenz (Zähler kleiner als vorher) → null', () => {
    const res = hoursPerEntry([
      entry({ id: 'a', date: '2020-01-01', engineHours: 100 }),
      entry({ id: 'b', date: '2020-02-01', engineHours: 90 }),
    ])
    expect(res.b).toBeNull()
  })

  it('fehlender Zählerstand → null, der nächste rechnet gegen den letzten gültigen', () => {
    const res = hoursPerEntry([
      entry({ id: 'a', date: '2020-01-01', engineHours: 100 }),
      entry({ id: 'b', date: '2020-02-01', engineHours: null }),
      entry({ id: 'c', date: '2020-03-01', engineHours: 130 }),
    ])
    expect(res.a).toBe(0)
    expect(res.b).toBeNull()
    expect(res.c).toBe(30) // 130 − 100, der null-Eintrag verschiebt die Basis nicht
  })
})

describe('hoursSinceStart', () => {
  it('Differenz zum kleinsten Zählerstand overall', () => {
    const entries = [
      entry({ id: 'a', date: '2020-01-01', engineHours: 100 }),
      entry({ id: 'b', date: '2020-02-01', engineHours: 130 }),
    ]
    expect(hoursSinceStart(entries[0], entries)).toBe(0)
    expect(hoursSinceStart(entries[1], entries)).toBe(30)
  })

  it('fehlender Wert → null', () => {
    const e = entry({ id: 'a', date: '2020-01-01', engineHours: null })
    expect(hoursSinceStart(e, [e])).toBeNull()
  })
})

describe('consumptionPerEntry', () => {
  it('weist Block-l/h allen Einträgen seit dem letzten Tankstopp zu', () => {
    const res = consumptionPerEntry([
      entry({ id: 'a', date: '2020-01-01', engineHours: 100 }),
      entry({ id: 'b', date: '2020-02-01', engineHours: 110, fuelLiters: 50 }), // Tankstopp: 50 l / 10 h
    ])
    expect(res.a).toBeCloseTo(5)
    expect(res.b).toBeCloseTo(5)
  })

  it('Einträge nach dem letzten Tankstopp → null ("–")', () => {
    const res = consumptionPerEntry([
      entry({ id: 'a', date: '2020-01-01', engineHours: 100 }),
      entry({ id: 'b', date: '2020-02-01', engineHours: 110, fuelLiters: 50 }),
      entry({ id: 'c', date: '2020-03-01', engineHours: 130 }), // offener Block
      entry({ id: 'd', date: '2020-04-01', engineHours: 140 }),
    ])
    expect(res.a).toBeCloseTo(5)
    expect(res.b).toBeCloseTo(5)
    expect(res.c).toBeNull()
    expect(res.d).toBeNull()
  })

  it('Division durch 0 Stunden im Block → null', () => {
    const res = consumptionPerEntry([
      entry({ id: 'a', date: '2020-01-01', engineHours: 100, fuelLiters: 30 }), // Block-Stunden = 0
    ])
    expect(res.a).toBeNull()
  })
})

describe('yearStatsAll', () => {
  it('Baseline im ersten Jahr (min overall), danach max des Vorjahrs', () => {
    const stats = yearStatsAll([
      entry({ id: 'a', date: '2020-01-01', engineHours: 100 }),
      entry({ id: 'b', date: '2020-06-01', engineHours: 150, fuelLiters: 100, fuelCostChf: 200 }),
      entry({ id: 'c', date: '2021-04-01', engineHours: 150 }),
      entry({ id: 'd', date: '2021-08-01', engineHours: 200 }),
    ])
    expect(stats).toHaveLength(2)

    const y2020 = stats[0]
    expect(y2020.year).toBe(2020)
    expect(y2020.operatingHours).toBe(50) // 150 − 100 (Baseline = min overall)
    expect(y2020.entryCount).toBe(2)
    expect(y2020.fuelLiters).toBe(100)
    expect(y2020.consumptionLh).toBeCloseTo(2) // 100 l / 50 h
    expect(y2020.costPerHourChf).toBeCloseTo(4) // 200 CHF / 50 h

    const y2021 = stats[1]
    expect(y2021.year).toBe(2021)
    expect(y2021.operatingHours).toBe(50) // 200 − 150 (max Vorjahr)
    expect(y2021.consumptionLh).toBe(0) // 0 l / 50 h: Stunden vorhanden, kein Treibstoff → 0 (nicht null)
  })
})

describe('totalStats', () => {
  it('summiert konsistent zum Pro-Jahr-Chart und rechnet Ø/Jahr exakt', () => {
    const t = totalStats([
      entry({ id: 'a', date: '2020-01-01', engineHours: 100 }),
      entry({ id: 'b', date: '2020-06-01', engineHours: 150, fuelLiters: 100, fuelCostChf: 200 }),
      entry({ id: 'c', date: '2021-04-01', engineHours: 150 }),
      entry({ id: 'd', date: '2021-08-01', engineHours: 200 }),
    ])
    expect(t.totalOperatingHours).toBe(100) // 50 + 50
    expect(t.totalFuelLiters).toBe(100)
    expect(t.totalFuelCostChf).toBe(200)
    expect(t.avgConsumptionLh).toBeCloseTo(1) // 100 l / 100 h, EXAKT
    expect(t.entryCount).toBe(4)
    expect(t.yearCount).toBe(2)
    expect(t.avgHoursPerYear).toBe(50)
    expect(t.avgEntriesPerYear).toBe(2)
    expect(t.avgCostPerYear).toBe(100)
  })

  it('leere Eingabe → Nullen bzw. null bei Quotienten', () => {
    const t = totalStats([])
    expect(t.totalOperatingHours).toBe(0)
    expect(t.avgConsumptionLh).toBeNull()
    expect(t.avgHoursPerYear).toBeNull()
  })
})
