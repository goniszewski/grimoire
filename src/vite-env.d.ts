/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_DEMO_BASE?: string;
  readonly VITE_APP_TITLE?: string;
  readonly VITE_DEMO_INSTALL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
