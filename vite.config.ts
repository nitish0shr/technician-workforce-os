import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Express API runs on PORT (default 3001). In dev, Vite serves the client
// on 5173 and proxies /api to the API server. In production the API server
// serves the built client from /dist on a single port (Replit-friendly).
const API_PORT = process.env.PORT || 3001;

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
