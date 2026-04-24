import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  base: './',
  server: { port: 5173, open: false },
  build: { target: 'es2022', sourcemap: true },
  plugins: [checker({ typescript: true }), cloudflare()],
});