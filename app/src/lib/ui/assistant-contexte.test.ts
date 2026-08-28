import { describe, expect, it } from "vitest";
import { acquitterEtapeAssistantContexte, lireEtatAssistantContexte } from "./assistant-contexte";

describe("état local de l'assistant de période", () => {
  it("isole la reprise par compte et ignore les étapes inconnues", () => {
    const stockage = new Map<string, string>();
    const ancienWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: {
        getItem: (cle: string) => stockage.get(cle) ?? null,
        setItem: (cle: string, valeur: string) => stockage.set(cle, valeur),
        removeItem: (cle: string) => stockage.delete(cle),
      } },
    });
    try {
      acquitterEtapeAssistantContexte("compte-a", "periode");
      expect(lireEtatAssistantContexte("compte-a").etapesAcquittees).toEqual(["periode"]);
      expect(lireEtatAssistantContexte("compte-b").etapesAcquittees).toEqual([]);
    } finally {
      if (ancienWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else Object.defineProperty(globalThis, "window", { configurable: true, value: ancienWindow });
    }
  });
});
