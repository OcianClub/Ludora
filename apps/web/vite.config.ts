import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export default defineConfig({
  plugins: [
    {
      // Evita uma requisição por SVG no dev sem duplicar os desenhos compartilhados com o mobile.
      name: 'ludora-inline-icons',
      enforce: 'pre',
      async transform(source, id) {
        if (!id.replaceAll('\\', '/').endsWith('/src/components/Icon.tsx')) return;
        const imports = [...source.matchAll(/import (\w+) from '([^']+\.svg)\?raw';/g)];
        const drawings = await Promise.all(imports.map(async ([statement, name, relative]) => {
          const file = resolve(dirname(id), relative);
          this.addWatchFile(file);
          return [statement, `const ${name} = ${JSON.stringify(await readFile(file, 'utf8'))};`];
        }));
        for (const [statement, replacement] of drawings) source = source.replace(statement, replacement);
        return { code: source, map: null };
      },
    },
    react(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
