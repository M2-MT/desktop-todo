/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  // 相对路径，保证打包后的前端资源在 Tauri 里能正确加载
  base: "./",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
  },
  build: {
    target: "es2021",
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
