import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: false,
        test: {
          name: "@core/parser",
          root: "./packages/parser",
          include: ["tests/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/dist/**"],
        },
      },
      {
        extends: false,
        test: {
          name: "@core/data",
          root: "./packages/data",
          include: ["tests/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/dist/**"],
        },
      },
      {
        extends: false,
        test: {
          name: "@core/recomendador",
          root: "./packages/recomendador",
          include: ["tests/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/dist/**"],
        },
      },
    ],
  },
});
