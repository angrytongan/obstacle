import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/obstacle/",
  test: {
    include: ["src/**/*.test.ts"],
  },
});
