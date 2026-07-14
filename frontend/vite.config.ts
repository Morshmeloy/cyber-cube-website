import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/teacher': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/teacher/, ''),
      },
    },
  },
})
