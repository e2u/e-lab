/// <reference types="vite/client" />

declare const __ENABLE_LADDER__: boolean;
declare const __ENABLE_AUTO_LAYOUT__: boolean;

interface ImportMetaEnv {
  readonly VITE_ENABLE_LADDER?: string;
  readonly VITE_ENABLE_AUTO_LAYOUT?: string;
  readonly ENABLE_LADDER?: string;
  readonly ENABLE_AUTO_LAYOUT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
