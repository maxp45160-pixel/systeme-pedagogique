"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Calculatrice scientifique — un outil de séance, sans dépendance.
 *
 * L'évaluation passe par une liste blanche stricte : l'expression saisie ne
 * peut contenir que des chiffres, les opérateurs, les parenthèses et les noms
 * de fonctions reconnus. Tout autre caractère est refusé avant toute
 * évaluation — la chaîne n'est jamais passée à `eval` telle quelle.
 */

type Touche =
  | string
  | { libelle: string; insere: string; libelleAria?: string };

const RANGEE_SCIENTIFIQUE: Touche[][] = [
  [
    { libelle: "sin", insere: "sin(" },
    { libelle: "cos", insere: "cos(" },
    { libelle: "tan", insere: "tan(" },
    { libelle: "π", insere: "π" },
  ],
  [
    { libelle: "ln", insere: "ln(" },
    { libelle: "log", insere: "log(" },
    { libelle: "√", insere: "√(" },
    { libelle: "^", insere: "^" },
  ],
];

const RANGEES_PRINCIPALES: Touche[][] = [
  ["C", "(", ")", { libelle: "÷", insere: "/" }],
  ["7", "8", "9", { libelle: "×", insere: "*" }],
  ["4", "5", "6", "-"],
  ["1", "2", "3", "+"],
  ["0", ".", ",", { libelle: "⌫", insere: "" }],
];

/**
 * Ce que la personne peut taper, à l'exclusion de tout le reste.
 *
 * ## Pourquoi les chiffres sont des atomes d'UN caractère
 *
 * La première écriture était `(\d+(\.\d+)?|…)+` : un `+` imbriqué dans un `+`,
 * le motif d'école du backtracking catastrophique. Sur une suite de chiffres
 * suivie d'un caractère refusé, le moteur essaie toutes les découpes possibles
 * de la suite — 26 chiffres coûtaient déjà 880 ms, et le coût double tous les
 * deux caractères. `evaluer` tourne dans un `useMemo` à CHAQUE frappe : taper
 * une longue suite de chiffres puis une lettre gelait l'onglet.
 *
 * `\d` seul consomme exactement un caractère : il n'existe qu'une façon de
 * faire correspondre la chaîne, donc plus rien à réessayer. Le langage accepté
 * est le même — le point et la virgule sont déjà dans la classe de caractères,
 * et « 1.2 » y était déjà admis par les deux écritures.
 *
 * Cette liste blanche est la seule barrière avant `new Function` : aucun
 * caractère hors de cette liste n'atteint l'évaluation. Les seuls jetons
 * alphabétiques admis sont `sin`, `cos`, `tan`, `ln`, `log` et `e` — on ne peut
 * épeler avec eux ni `constructor`, ni `eval`, ni `self`, faute des lettres.
 * Toute concaténation qui n'est pas une expression valide lève, et la levée est
 * capturée.
 */
const REGEX_EXPRESSION = /^(?:\d|[+\-*/^().,%]|sin|cos|tan|ln|log|√|π|e|\s)+$/;

/**
 * Exportée pour être testable : c'est la seule barrière avant `new Function`,
 * et une barrière qu'aucun test ne tient se relâche à la première refonte.
 */
export function evaluer(expression: string): number | null {
  const propre = expression.trim().replace(/,/g, ".");
  if (!propre || !REGEX_EXPRESSION.test(propre)) return null;
  const traduite = propre
    .replace(/π/g, "(Math.PI)")
    .replace(/(?<![a-z])e(?![a-z])/g, "(Math.E)")
    .replace(/√\s*\(/g, "Math.sqrt(")
    .replace(/sin\(/g, "Math.sin(")
    .replace(/cos\(/g, "Math.cos(")
    .replace(/tan\(/g, "Math.tan(")
    /*
     * `log(` AVANT `ln(`, et l'ordre n'est pas un détail de style.
     *
     * Ces remplacements s'enchaînent sur le résultat du précédent. Dans l'autre
     * sens, `ln(2)` devenait `Math.log(2)`, puis la passe suivante retrouvait le
     * `log(` que l'on venait d'écrire et rendait `Math.Math.log10(2)` — une
     * levée, donc `null` : le bouton `ln` ne renvoyait jamais rien.
     *
     * Dans cet ordre, aucune sortie ne contient le motif de la passe suivante :
     * `Math.log10(` ne contient pas `ln(`, et `Math.log(` est écrit en dernier.
     */
    .replace(/log\(/g, "Math.log10(")
    .replace(/ln\(/g, "Math.log(")
    .replace(/\^/g, "**");
  try {
    const valeur = new Function(`return (${traduite});`)() as unknown;
    return typeof valeur === "number" && Number.isFinite(valeur) ? valeur : null;
  } catch {
    return null;
  }
}

function formater(valeur: number): string {
  if (Number.isInteger(valeur)) return String(valeur);
  return String(Number.parseFloat(valeur.toPrecision(12)));
}

export function Calculatrice() {
  const [expression, setExpression] = useState("");
  const apercu = useMemo(() => {
    if (!expression.trim()) return null;
    const valeur = evaluer(expression);
    return valeur === null ? null : formater(valeur);
  }, [expression]);

  const inserer = useCallback((morceau: string) => {
    setExpression((courante) => courante + morceau);
  }, []);

  function touches(touche: Touche) {
    const libelle = typeof touche === "string" ? touche : touche.libelle;
    const insertion = typeof touche === "string" ? touche : touche.insere;
    if (libelle === "C") {
      setExpression("");
      return;
    }
    if (libelle === "⌫") {
      setExpression((courante) =>
        courante.endsWith("(") && /^(sin|cos|tan|ln|log|√)$/.test(courante.slice(-4).slice(0, -1))
          ? courante.slice(0, -4)
          : courante.slice(0, -1),
      );
      return;
    }
    inserer(insertion);
  }

  function egale() {
    const valeur = evaluer(expression);
    if (valeur === null) return;
    setExpression(formater(valeur));
  }

  return (
    <div className="w-[min(20rem,calc(100vw-2rem))] select-none">
      <div className="rounded-lg border border-bordure-controle bg-surface-2 px-3 py-2.5 text-right">
        <p className="chiffres min-h-6 break-all font-mono text-sm text-texte" aria-live="polite">
          {expression || "0"}
        </p>
        {apercu !== null && expression.trim() !== apercu && (
          <p className="mt-1 text-xs text-primaire chiffres">= {apercu}</p>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {RANGEE_SCIENTIFIQUE.map((rangee, indexRangee) => (
          <div key={`sci-${indexRangee}`} className="grid grid-cols-4 gap-1.5">
            {rangee.map((touche) => (
              <ToucheBouton key={typeof touche === "string" ? touche : touche.libelle} touche={touche} onClick={() => touches(touche)} petite />
            ))}
          </div>
        ))}
        {RANGEES_PRINCIPALES.map((rangee, indexRangee) => (
          <div key={`main-${indexRangee}`} className="grid grid-cols-4 gap-1.5">
            {indexRangee === RANGEES_PRINCIPALES.length - 1 ? (
              <>
                {rangee.slice(0, 3).map((touche) => (
                  <ToucheBouton key={typeof touche === "string" ? touche : touche.libelle} touche={touche} onClick={() => touches(touche)} />
                ))}
                <button
                  type="button"
                  onClick={egale}
                  aria-label="Calculer"
                  className="rounded-md bg-primaire py-2 text-sm font-semibold text-primaire-contraste transition-colors hover:bg-primaire-survol cursor-pointer focus:outline-none focus:ring-2 focus:ring-primaire/40"
                >
                  =
                </button>
              </>
            ) : (
              rangee.map((touche) => (
                <ToucheBouton key={typeof touche === "string" ? touche : touche.libelle} touche={touche} onClick={() => touches(touche)} />
              ))
            )}
          </div>
        ))}
      </div>

      <p className="mt-2 text-center text-[0.625rem] text-texte-discret">
        Saisie au clavier possible — seuls chiffres, opérateurs et fonctions reconnus sont acceptés.
      </p>
    </div>
  );
}

function ToucheBouton({
  touche,
  onClick,
  petite = false,
}: {
  touche: Touche;
  onClick: () => void;
  petite?: boolean;
}) {
  const libelle = typeof touche === "string" ? touche : touche.libelle;
  const aria = typeof touche === "string" ? undefined : touche.libelleAria;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      className={[
        "rounded-md border border-bordure bg-surface font-medium text-texte transition-colors hover:bg-surface-2 hover:border-primaire/40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primaire/40",
        petite ? "py-1.5 text-xs" : "py-2 text-sm",
        /^[0-9]$/.test(libelle) ? "chiffres" : "",
      ].join(" ")}
    >
      {libelle}
    </button>
  );
}
