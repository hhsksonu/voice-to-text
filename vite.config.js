import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@tauri-apps/api": path.resolve(__dirname, "node_modules/@tauri-apps/api"),
    },
  },
  server: {
    strictPort: true,
  },
  clearScreen: false,
});
