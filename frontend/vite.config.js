import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/demo': 'http://127.0.0.1:8000',
      '/swagger-ui': {
        target: 'http://127.0.0.1:8000',
        rewrite: (path) => path.replace(/^\/swagger-ui/, '/docs'),
      },
      '/docs-theme.css': 'http://127.0.0.1:8000',
      '/openapi.json': 'http://127.0.0.1:8000',
    },
  },
})
