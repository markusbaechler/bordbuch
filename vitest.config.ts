import { defineConfig } from 'vitest/config'

// Eigene Test-Config (vitest bevorzugt sie vor vite.config.ts), damit die Tests
// die React-/Tailwind-Plugins NICHT laden – die Rechenlogik ist pures TS und
// braucht kein DOM. Test-Dateien sind aus dem Pages-Build ausgeschlossen
// (tsconfig.app.json), `npm run build` bleibt davon unberührt.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
