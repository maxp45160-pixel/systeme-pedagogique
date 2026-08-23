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
    alias: {
      "@": path.resolve(__dirname, "src"),
      /*
       * `server-only` est une garde de bundler : son point d'entrée par défaut
       * lève dès qu'un module client l'importe. Sous Vitest il n'y a pas de
       * frontière client/serveur, et la levée empêchait de tester des routes
       * dont la chaîne d'imports traverse un module `lib/store` — ce que le
       * quota du tuteur a rendu vrai pour les treize routes IA. On la neutralise
       * ici, et seulement ici : le build Next continue de la faire respecter.
       */
      "server-only": path.resolve(__dirname, "src/lib/test/server-only-stub.ts"),
    },
  },
  test: {
    include: ["src/lib/simulation/campagne.run.ts"],
    environment: "node",
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
