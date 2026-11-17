import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // redirect.html is the Microsoft sign-in return page (src/auth/redirect.ts).
      input: {
        main: resolve(__dirname, 'index.html'),
        redirect: resolve(__dirname, 'redirect.html'),
      },
    },
  },
})
