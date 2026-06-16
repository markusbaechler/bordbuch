import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base = GitHub-Pages-Pfad (Repo-Name). Lokal egal, für Pages zwingend.
export default defineConfig({
  base: '/bordbuch/',
  plugins: [react(), tailwindcss()],
})
