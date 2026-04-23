import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * eyedeu.github.io/myapps/PDF/ — alt dizin. production'da mutlak taban;
 * aksi halde .../myapps/PDF (slash yok) iken script yolları kirilir, mobilde beyaz ekran.
 * Gelistirme: Vite varsayilani / .
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? "/myapps/PDF/" : "/",
}));
