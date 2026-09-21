import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            if ((err as any).code === "ECONNREFUSED") {
              console.warn("⚠️  [vite proxy] Backend on port 3001 is starting up or offline. Waiting for backend...");
              if (res && "writeHead" in res && !(res as any).headersSent) {
                (res as any).writeHead(503, { "Content-Type": "application/json" });
                (res as any).end(JSON.stringify({ error: "Backend server is starting up. Please wait a few seconds and refresh." }));
              }
            }
          });
        },
      },
    },
  },
});
