import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Configuration dédiée au lanceur de campagne.
 *
 * `vitest.config.ts` n'inclut que `*.test.ts` : le lanceur (`campagne.run.ts`)
 * en est donc exclu, et `npm run test` ne déclenche jamais deux minutes et demie
 * de simulation par accident.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/lib/simulation/campagne.run.ts"],
    environment: "node",
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
