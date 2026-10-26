/// <reference types="vite/client" />
import type { LudoraBridge } from '../../shared/bridge';

declare global {
  interface Window {
    ludora: LudoraBridge;
  }
}
