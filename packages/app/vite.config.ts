import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base must match the GitHub Pages project path: https://<user>.github.io/knit-helper-4000/
export default defineConfig({
  base: '/knit-helper-4000/',
  plugins: [react()],
});
