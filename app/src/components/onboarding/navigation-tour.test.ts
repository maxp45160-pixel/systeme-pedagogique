import { describe, expect, it } from "vitest";
import { NAVIGATION, destinationsPrincipales, resumeDestinations } from "@/components/layout/navigation";

/**
 * Le tour d'accueil ne doit pas pouvoir mentir sur le rail.
 *
 * Le 24/08/2026, l'étape 3 surlignait la navigation et annonçait « vos trois
 * espaces : l'Atelier, le Cahier, la Progression ». Le rail en montrait quatre,
 * « Bureau » n'était pas nommé, et « Cahier » avait cessé d'être une
 * destination avec ADR-103 — c'était un mode de `/seances`. Le tout premier
 * écran d'un compte neuf décrivait une application qui n'existait plus.
 *
 * La phrase est désormais composée à partir de `NAVIGATION`. Ces tests sont ce
 * qui interdit d'y revenir : ils échouent si quelqu'un recopie une liste, ou
 * ajoute une destination sans lui donner de résumé.
 */
describe("résumé des destinations", () => {
  it("nomme chaque destination du rail, et rien d'autre", () => {
    const phrase = resumeDestinations();
    for (const entree of destinationsPrincipales()) {
      expect(phrase).toContain(entree.libelle);
    }
  });

  it("ne nomme aucune surface retirée du rail", () => {
    /*
     * « Cahier » reste un mot de l'interface — c'est le mode archive de
     * `/seances`, rebaptisé « Historique ». Ce qu'on interdit, c'est de le
     * présenter comme un espace du rail à côté des vraies destinations.
     */
    const phrase = resumeDestinations();
    for (const fantome of ["Cahier", "Atelier", "Bureau", "Carnet"]) {
      expect(phrase).not.toContain(fantome);
    }
  });

  it("donne un résumé non vide à chaque entrée, y compris l'aide", () => {
    for (const groupe of NAVIGATION) {
      for (const entree of groupe.entrees) {
        expect(entree.resume.trim(), `résumé manquant pour ${entree.libelle}`).not.toBe("");
      }
    }
  });

  it("exclut le groupe détaché : l'aide n'est pas un pôle de travail", () => {
    const libelles = destinationsPrincipales().map((e) => e.libelle);
    expect(libelles).not.toContain("Aide");
  });
});
