/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", sourcemap: true },
  // Engine tests are pure (node); component tests opt into jsdom per file.
  test: { environment: "node", include: ["src/**/*.test.{ts,tsx}"] },
});
