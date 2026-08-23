import { describe, expect, it } from "vitest";

import { evaluer } from "./calculatrice";

/**
 * Ce que fige ce fichier : la liste blanche de la calculatrice, seule barrière
 * avant `new Function`.
 *
 * Elle n'est pas testée pour le plaisir de couvrir une ligne. Une liste blanche
 * qu'aucun test ne tient se relâche à la première refonte — on ajoute un jeton
 * « pratique », et la barrière devient une passoire sans que rien ne le
 * signale. Les deux propriétés qui comptent sont ici : ce qui doit passer
 * passe, et ce qui ne doit jamais atteindre l'évaluation n'y arrive pas.
 */

describe("ce que la calculatrice accepte", () => {
  it("calcule les opérations et les fonctions déclarées", () => {
    expect(evaluer("1+2")).toBe(3);
    expect(evaluer("(1+2)*3")).toBe(9);
    expect(evaluer("2^10")).toBe(1024);
    expect(evaluer("√(16)")).toBe(4);
    expect(evaluer("log(100)")).toBe(2);
    expect(evaluer("7%3")).toBe(1);
  });

  it("accepte la virgule décimale française", () => {
    expect(evaluer("1,5+2")).toBe(3.5);
  });

  it("résout les constantes sans les confondre avec un identifiant", () => {
    expect(evaluer("π")).toBeCloseTo(Math.PI, 10);
    expect(evaluer("ln(e)")).toBe(1);
  });
});

describe("ce que la calculatrice refuse", () => {
  /*
   * Les seuls jetons alphabétiques admis sont `sin`, `cos`, `tan`, `ln`, `log`
   * et `e`. On ne peut épeler avec eux ni `constructor`, ni `eval`, ni `self` —
   * les lettres manquent. Ces cas figent l'interdit plutôt que de le supposer.
   */
  it.each([
    "alert(1)",
    "constructor",
    "self",
    "globalThis",
    "eval('1')",
    "fetch('/')",
    "window.location",
    "[].constructor",
    "1;alert(1)",
    "import('x')",
  ])("écarte %j sans l'évaluer", (expression) => {
    expect(evaluer(expression)).toBeNull();
  });

  it("rend null plutôt que de lever sur une expression mal formée", () => {
    expect(evaluer("1.2.3")).toBeNull();
    expect(evaluer("((1+2)")).toBeNull();
    expect(evaluer("")).toBeNull();
  });

  it("rend null sur un résultat non fini plutôt qu'Infinity", () => {
    expect(evaluer("1/0")).toBeNull();
  });

  /*
   * Depuis le 23/08/2026, l'affichage est un `<input>` : on tape au clavier,
   * et le filtre du champ laisse volontairement passer les lettres de `sin`,
   * `cos`, `tan`, `ln`, `log` et `e` — sans quoi on ne pourrait pas écrire
   * `sin(` caractère par caractère, aucun préfixe n'étant une expression
   * valide.
   *
   * Ces cas figent le fait que ce relâchement s'arrête au champ : tout ce
   * qu'on peut désormais taper et qui n'est PAS une expression est rejeté par
   * la liste blanche, avant `new Function`. La barrière n'a pas bougé.
   */
  it.each(["sin", "sco", "elg", "sin(", "cos)", "lnlog", "e e", "tanx"])(
    "écarte %j, tapable au clavier mais pas une expression",
    (saisie) => {
      expect(evaluer(saisie)).toBeNull();
    },
  );
});

describe("la liste blanche ne part pas en backtracking", () => {
  /*
   * L'écriture d'origine — `(\d+(\.\d+)?|…)+`, un `+` imbriqué dans un `+` —
   * essayait toutes les découpes d'une suite de chiffres suivie d'un caractère
   * refusé : 26 chiffres coûtaient 880 ms, et le coût doublait tous les deux
   * caractères. `evaluer` tourne dans un `useMemo` à chaque frappe, donc taper
   * une longue suite de chiffres puis une lettre gelait l'onglet.
   *
   * Le seuil est large exprès : il ne mesure pas une performance, il détecte un
   * retour à une forme exponentielle. Avec la forme corrigée, 5 000 caractères
   * se rejettent en moins d'une milliseconde ; avec l'ancienne, 40 caractères
   * ne finissaient pas.
   */
  it("rejette instantanément une longue saisie invalide", () => {
    const depart = Date.now();
    expect(evaluer(`${"1".repeat(5000)}!`)).toBeNull();
    expect(Date.now() - depart).toBeLessThan(1000);
  });
});
