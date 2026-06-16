/** Schlichter Lade-Spinner im Instrument-Look (Teal-Ring). */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-2">
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-teal"
        role="status"
        aria-label="Lädt"
      />
      {label && <span className="text-[13px]">{label}</span>}
    </div>
  )
}
