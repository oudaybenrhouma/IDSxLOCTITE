import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    root: '.',
    include: ['tests/**/*.test.{js,jsx}'],
    environment: 'node',
    environmentMatchGlobs: [['tests/ui.test.jsx', 'jsdom']],
    globals: false,
    testTimeout: 30000,
    hookTimeout: 40000,
  },
  esbuild: { jsx: 'automatic' },
});
