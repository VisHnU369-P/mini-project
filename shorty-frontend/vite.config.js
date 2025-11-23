import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  preview: {
    host: true,
    port: process.env.PORT || 5173,
    allowedHosts: [
      "mini-project-production-d8d2.up.railway.app" // <-- your domain
    ],
  },
});
