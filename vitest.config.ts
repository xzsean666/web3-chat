import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/local-joint-test/**'],
    server: {
      deps: {
        external: ['node:sqlite'],
      },
    },
  },
  ssr: {
    external: ['node:sqlite'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@luckydrop/sdk': path.resolve(__dirname, '../LuckyDrop/sdk/src'),
      'react-native': 'react-native-web',
      'expo-secure-store': path.resolve(__dirname, './test/mocks/expo-secure-store.ts'),
    },
  },
});
