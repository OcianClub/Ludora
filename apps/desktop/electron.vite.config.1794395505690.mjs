// electron.vite.config.ts
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
var __electron_vite_injected_dirname = "E:\\ESTUDO PROGRAMACAO\\projetos\\Ludora\\apps\\desktop";
var pacotesInternos = ["@ludora/design-tokens", "@ludora/shared-types"];
var cspProducao = () => ({
  name: "ludora-csp",
  apply: "build",
  transformIndexHtml: () => [
    {
      tag: "meta",
      attrs: {
        "http-equiv": "Content-Security-Policy",
        content: [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'none'",
          "object-src 'none'",
          "base-uri 'none'",
          "form-action 'none'"
        ].join("; ")
      },
      injectTo: "head-prepend"
    }
  ]
});
var electron_vite_config_default = defineConfig({
  main: {
    build: { externalizeDeps: { exclude: pacotesInternos } }
  },
  preload: {
    build: { externalizeDeps: { exclude: pacotesInternos } }
  },
  renderer: {
    root: resolve(__electron_vite_injected_dirname, "src/renderer"),
    plugins: [react(), cspProducao()],
    resolve: {
      alias: {
        "@renderer": resolve(__electron_vite_injected_dirname, "src/renderer/src"),
        // Fidelidade visual: o desktop importa os componentes e CSS do web.
        "@web": resolve(__electron_vite_injected_dirname, "../web/src"),
        // Mesmos SVGs do mobile/web (packages/icons); usados como máscara de ícone.
        "@icons": resolve(__electron_vite_injected_dirname, "../../packages/icons/src/svg")
      },
      // Uma única cópia de React mesmo importando arquivos de apps/web.
      dedupe: ["react", "react-dom", "react-router-dom"]
    },
    server: {
      ...process.env.LUDORA_DESKTOP_DEV_API ? { port: 5174, strictPort: true } : {},
      fs: { allow: [resolve(__electron_vite_injected_dirname, "../..")] }
    },
    build: { rollupOptions: { input: resolve(__electron_vite_injected_dirname, "src/renderer/index.html") } }
  }
});
export {
  electron_vite_config_default as default
};
