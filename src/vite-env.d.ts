/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_UNIFIED_SEARCH?: string;
  readonly VITE_API_LEARNING_PROGRESS?: string;
  readonly VITE_HOME_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
