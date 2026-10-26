import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

// Pacotes internos do monorepo exportam TypeScript puro (main: src/index.ts).
// Precisam ser compilados junto com o app em vez de externalizados, senão o
// Node tentaria dar require em .ts dentro do app empacotado.
const pacotesInternos = ['@ludora/design-tokens', '@ludora/shared-types'];

// O renderer não faz nenhuma requisição de rede: tudo passa pelo processo main
// via IPC. Por isso o CSP de produção pode ser bem restritivo (connect-src 'none').
// Só no build: o dev server do Vite precisa de scripts inline e websocket (HMR).
const cspProducao = (): Plugin => ({
  name: 'ludora-csp',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'none'",
          "object-src 'none'",
          "base-uri 'none'",
          "form-action 'none'",
        ].join('; '),
      },
      injectTo: 'head-prepend',
    },
  ],
});

export default defineConfig({
  main: {
    build: { externalizeDeps: { exclude: pacotesInternos } },
  },
  preload: {
    build: { externalizeDeps: { exclude: pacotesInternos } },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), cspProducao()],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        // Fidelidade visual: o desktop importa os componentes e CSS do web.
        '@web': resolve(__dirname, '../web/src'),
        // Mesmos SVGs do mobile/web (packages/icons); usados como máscara de ícone.
        '@icons': resolve(__dirname, '../../packages/icons/src/svg'),
      },
      // Uma única cópia de React mesmo importando arquivos de apps/web.
      dedupe: ['react', 'react-dom', 'react-router-dom'],
    },
    server: { fs: { allow: [resolve(__dirname, '../..')] } },
    build: { rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') } },
  },
});
