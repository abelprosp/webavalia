/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { playwright } from '@vitest/browser-playwright'

/**
 * Recharts 3.x default-imports `es-toolkit/compat/*` CJS shims. Under Vite 8 /
 * Rolldown those helpers can initialize out of order and crash production with
 * `TypeError: t is not a function`. Rewrite to the ESM barrel instead.
 * @see https://github.com/recharts/recharts/issues/7376
 */
function esToolkitCompatEsm(): Plugin {
  const virtualPrefix = '\0es-toolkit-compat:'
  return {
    name: 'es-toolkit-compat-esm',
    enforce: 'pre',
    resolveId(id) {
      if (id.startsWith('es-toolkit/compat/') && id !== 'es-toolkit/compat') {
        return `${virtualPrefix}${id.slice('es-toolkit/compat/'.length)}`
      }
    },
    load(id) {
      if (!id.startsWith(virtualPrefix)) return
      const name = id.slice(virtualPrefix.length)
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) return
      return `export { ${name} as default } from 'es-toolkit/compat';\n`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    esToolkitCompatEsm(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // Keep recharts out of the broken CJS-interop prebundle path in Vite 8.
    exclude: ['recharts'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    silent: 'passed-only',
    unstubEnvs: true,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    coverage: {
      // include: ['src/**/*.{js,jsx,ts,tsx}'], // Uncomment to expand the report to all src/**/* so untested modules appear as 0% coverage.
      exclude: [
        'src/components/ui/**',
        'src/assets/**',
        'src/tanstack-table.d.ts',
        'src/routeTree.gen.ts',
        'src/test-utils/**',
        'src/routes/**',
      ],
    },
  },
})
