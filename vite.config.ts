import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (
            id.includes('primevue') ||
            id.includes('@primeuix') ||
            id.includes('primeicons')
          ) {
            return 'ui-kit'
          }

          if (
            id.includes('viem') ||
            id.includes('@noble') ||
            id.includes('abitype')
          ) {
            return 'wallet-core'
          }

          if (
            id.includes('trystero') ||
            id.includes('@trystero-p2p')
          ) {
            return 'webrtc-core'
          }

          return 'vendor'
        },
      },
    },
  },
})
