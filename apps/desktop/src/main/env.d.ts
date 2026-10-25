/// <reference types="electron-vite/node" />

// Variáveis MAIN_VITE_* são injetadas no build do processo principal (.env).
interface ImportMetaEnv {
  readonly MAIN_VITE_API_URL?: string;
}
