/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** /exec-URL der Apps-Script-Web-App */
  readonly VITE_API_URL: string
  /** Shared Secret (Token) für die API */
  readonly VITE_API_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
