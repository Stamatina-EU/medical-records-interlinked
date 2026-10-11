import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Original tests exercise the preserved legacy profile; integration tests explicitly select rich.
    env: { MRI_DEMO_PROFILE: "legacy" },
  },
});
