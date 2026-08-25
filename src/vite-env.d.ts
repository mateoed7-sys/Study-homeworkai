/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Local development only. Production builds use the /api/anthropic proxy. */
  readonly VITE_ANTHROPIC_API_KEY?: string;
  /** Set to "1" to exercise the proxy path from a dev server. */
  readonly VITE_FORCE_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
