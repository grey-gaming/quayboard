import react from "@vitejs/plugin-react";
import { searchForWorkspaceRoot } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/auth": "http://127.0.0.1:3001",
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts?(x)"],
  },
});
