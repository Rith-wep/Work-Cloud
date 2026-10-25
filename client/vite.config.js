import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  // Keep the dev server from leaving stale HTML/CSS in the browser cache.
  server: {
    headers: {
      "Cache-Control": "no-store",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/app/testSetup.js",
    css: true,
  },
  build: {
    // Keep production output usable on older Chromium, Firefox, and Safari
    // versions commonly found on budget phones and embedded browsers.
    target: ["es2015", "safari12"],
    cssTarget: "safari12",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("/src/features/admin/") || id.includes("\\src\\features\\admin\\")) {
            return "admin-shell";
          }

          if (
            id.includes("/src/shared/components/Admin") ||
            id.includes("\\src\\shared\\components\\Admin") ||
            id.includes("/src/features/admin/") ||
            id.includes("\\src\\features\\admin\\") ||
            id.includes("/src/shared/utils/admin") ||
            id.includes("\\src\\shared\\utils\\admin")
          ) {
            return "admin-shell";
          }

          if (id.includes("node_modules")) {
            if (id.includes("react-router-dom")) {
              return "router-vendor";
            }

            if (id.includes("react-hot-toast") || id.includes("lucide-react")) {
              return "ui-vendor";
            }
          }

          return undefined;
        },
      },
    },
  },
});

