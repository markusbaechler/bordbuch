// src/hooks/useConditions.ts
// Bündelt die drei Live-Quellen (Wind, Pegel, Wassertemperatur) in einen Zustand
// mit Lade-/Fehler-Handling. Jede Quelle darf einzeln ausfallen.

import { useState, useEffect, useCallback } from "react";
import { fetchWind, fetchLake, LOCARNO, type Spot, type WindNow } from "../lib/liveData";
import { getWaterTemp } from "../lib/waterTemp";

export interface Conditions {
  wind: WindNow | null;
  levelMasl: number | null;
  waterTempC: number | null;
  waterTempSource: "alplakes" | "estimate" | null;
  fetchedAt: Date | null;
}

const EMPTY: Conditions = {
  wind: null, levelMasl: null, waterTempC: null, waterTempSource: null, fetchedAt: null,
};

export function useConditions(spot: Spot = LOCARNO, refreshMs = 0) {
  const [data, setData] = useState<Conditions>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [wind, lake, temp] = await Promise.allSettled([
      fetchWind(spot),
      fetchLake(spot),
      getWaterTemp(),
    ]);

    const w = wind.status === "fulfilled" ? wind.value : null;
    const l = lake.status === "fulfilled" ? lake.value.levelMasl : null;
    const t = temp.status === "fulfilled" ? temp.value : null;

    if (!w && l == null && !t) setError("Quellen nicht erreichbar");

    setData({
      wind: w,
      levelMasl: l,
      waterTempC: t?.value ?? null,
      waterTempSource: t?.source ?? null,
      fetchedAt: new Date(),
    });
    setLoading(false);
  }, [spot]);

  useEffect(() => {
    load();
    if (refreshMs > 0) {
      const id = setInterval(load, refreshMs);
      return () => clearInterval(id);
    }
  }, [load, refreshMs]);

  return { ...data, loading, error, reload: load };
}
