import { defineConfig } from 'vite';

// `public/` is served at the web root, so `/assets/Toon Shooter/...` paths
// from assets.json resolve unchanged (the loader encodeURI()s the space).
export default defineConfig({
  base: './',
  server: { port: 5173, open: false },
  build: { outDir: 'dist', target: 'es2022', sourcemap: true },
});
