import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("@/lib/store/actions", () => ({ demarrerTentative: vi.fn() }));

import { planifierDemarrageAutomatique } from "./auto-demarrage";

describe("démarrage automatique d'un exercice", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ne laisse pas le rejeu Strict Mode posséder l'unique démarrage", async () => {
    vi.useFakeTimers();
    const demarrer = vi.fn().mockResolvedValue(undefined);
    const rafraichir = vi.fn();
    const signalerEchec = vi.fn();

    // React nettoie le premier effet avant d'installer l'effet survivant.
    const nettoyerPremier = planifierDemarrageAutomatique(
      demarrer,
      rafraichir,
      signalerEchec,
    );
    nettoyerPremier();
    planifierDemarrageAutomatique(demarrer, rafraichir, signalerEchec);

    await vi.runAllTimersAsync();

    expect(demarrer).toHaveBeenCalledTimes(1);
    expect(rafraichir).toHaveBeenCalledTimes(1);
    expect(signalerEchec).not.toHaveBeenCalled();
  });
});
