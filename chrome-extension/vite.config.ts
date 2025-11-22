import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest: manifest as any }),
  ],
  define: {
    // This ensures process.env.API_KEY is replaced with the actual key during build
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  server: {
    port: 5173,
  },
});