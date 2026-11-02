import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Tauri-ready notes:
// - Fixed dev server port so src-tauri/tauri.conf.json (added in Phase 7) can
//   point `build.devUrl` at it reliably.
// - `base: "./"` keeps built asset URLs relative, which is required for the
//   app to load correctly from Tauri's embedded webview (file:// / tauri://
//   origins) instead of assuming an absolute web root.
// - No use of `window.location`-based routing assumptions anywhere in the
//   app; navigation is in-memory (see src/hooks/useWorkspaceStore.ts), which
//   works identically in a browser tab and in a desktop webview.
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    // Prevent Vite from watching Tauri build artifacts (causes EBUSY crash)
    watch: {
      ignored: ["**/src-tauri/target/**", "**/src-tauri/*.rs", "**/src-tauri/sidecar/**"],
    },
  },
  build: {
    outDir: "dist",
    // Tauri on Windows bundles a Chromium-based WebView2 runtime, so we can
    // target a modern baseline without legacy transpilation.
    target: "es2021",
    rollupOptions: {
      external: ["@tauri-apps/api"],
    },
  },
  // Prevent @tauri-apps/api from being pre-bundled (it's external in Tauri)
  optimizeDeps: {
    exclude: ["@tauri-apps/api"],
  },
});
