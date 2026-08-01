import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// En Docker el backend se llama "backend"; en host local, localhost.
const apiTarget = process.env.VITE_PROXY_TARGET || "http://backend:8000";
const wsTarget = apiTarget.replace(/^http/, "ws");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // Accesible desde cualquier dispositivo de la LAN (Smart TVs)
    watch: {
      usePolling: true,
    },
    // Un solo puerto (5173) para TVs: HTML + API + WebSocket
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/health": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/docs": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/openapi.json": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/red": {
        target: apiTarget,
        changeOrigin: true,
      },
      // Carátulas cacheadas en el backend (image_root) por si no están en public/
      "/images/covers": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/ws": {
        target: wsTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
