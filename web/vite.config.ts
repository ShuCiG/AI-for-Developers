import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
const aiProxyTarget = process.env.VITE_PROXY_AI_TARGET || "http://localhost:8000";

export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: aiProxyTarget,
        changeOrigin: true,
      },
      "/health": {
        target: aiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
