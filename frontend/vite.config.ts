import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const compatAlias = (file: string) =>
  new URL(`./src/lib/es-toolkit-compat/${file}.ts`, import.meta.url).pathname

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'es-toolkit/compat/get': compatAlias('get'),
      'es-toolkit/compat/isPlainObject': compatAlias('isPlainObject'),
      'es-toolkit/compat/last': compatAlias('last'),
      'es-toolkit/compat/maxBy': compatAlias('maxBy'),
      'es-toolkit/compat/minBy': compatAlias('minBy'),
      'es-toolkit/compat/omit': compatAlias('omit'),
      'es-toolkit/compat/range': compatAlias('range'),
      'es-toolkit/compat/sortBy': compatAlias('sortBy'),
      'es-toolkit/compat/sumBy': compatAlias('sumBy'),
      'es-toolkit/compat/throttle': compatAlias('throttle'),
      'es-toolkit/compat/uniqBy': compatAlias('uniqBy'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
