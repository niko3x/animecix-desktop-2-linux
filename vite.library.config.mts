import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/library-page'),
  base: '/',
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, 'assets/library'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/library-page/index.html'),
    },
  },
});
