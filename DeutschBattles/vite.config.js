import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "app",
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "..", "shared")
    }
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")]
    }
  },
  build: {
    outDir: "..",
    emptyOutDir: false,
    assetsDir: "assets"
  }
});
