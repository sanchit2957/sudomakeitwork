import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "frontend", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@database": path.resolve(templateRoot, "database"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["dotenv/config"],
    testTimeout: 20000,
    include: [
      "backend/**/*.test.ts",
      "backend/**/*.spec.ts",
      "frontend/src/**/*.test.ts",
      "frontend/src/**/*.spec.ts",
      "frontend/src/**/*.test.tsx",
      "frontend/src/**/*.spec.tsx",
    ],
  },
});
