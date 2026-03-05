import fs from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const configuredRoot = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = fs.realpathSync(configuredRoot);

export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  server: {
    fs: {
      allow: [configuredRoot, projectRoot],
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
