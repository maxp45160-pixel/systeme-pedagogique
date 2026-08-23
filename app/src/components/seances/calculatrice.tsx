"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Calculatrice scientifique — un outil de séance, sans dépendance.
 *
 * L'évaluation passe par une liste blanche stricte : l'expression saisie ne
 * peut contenir que des chiffres, les opérateurs, les parenthèses et les noms
 * de fonctions reconnus. Tout autre caractère est refusé avant toute
 * évaluation — la chaîne n'est jamais passée à `eval` telle quelle.
 *
 * ## La saisie clavier (23/08/2026)
 *
 * La note « Saisie au clavier possible » était fausse : l'affichage était un
 * `<p>`, aucun gestionnaire de touche n'existait, et le pavé numérique ne
 * produisait rien. L'affichage est désormais un vrai `<input>` — le pavé
 * numérique, la touche d'effacement, la sélection, le curseur et le
 * copier-coller marchent parce que le navigateur les tient, pas parce qu'on
 * les réimplémente. Les touches de l'interface insèrent **à la position du
 * curseur**, pas en fin de chaîne.
 */

type Touche = {
  libelle: string;
  insere: string;
  /** Nom accessible quand le libellé est un symbole seul. */
  aria?: string;
  /** Position du curseur après insertion, comptée depuis la fin de `insere`. */
  recul?: number;
};

const RANGEE_SCIENTIFIQUE: Touche[][] = [
  [
    { libelle: "sin", insere: "sin()", aria: "Sinus", recul: 1 },
    { libelle: "cos", insere: "cos()", aria: "Cosinus", recul: 1 },
    { libelle: "tan", insere: "tan()", aria: "Tangente", recul: 1 },
    { libelle: "π", insere: "π", aria: "Pi" },
    { libelle: "e", insere: "e", aria: "Nombre e" },
  ],
  [
    { libelle: "ln", insere: "ln()", aria: "Logarithme népérien", recul: 1 },
    { libelle: "log", insere: "log()", aria: "Logarithme décimal", recul: 1 },
    { libelle: "√", insere: "√()", aria: "Racine carrée", recul: 1 },
    { libelle: "x²", insere: "^2", aria: "Au carré" },
    { libelle: "xʸ", insere: "^", aria: "Puissance" },
  ],
];

/** Les touches propres à cette rangée sont traitées par leur libellé. */
const EFFACER_TOUT = "C";
const EFFACER = "⌫";

const RANGEES_PRINCIPALES: Touche[][] = [
  [
    { libelle: EFFACER_TOUT, insere: "", aria: "Tout effacer" },
    { libelle: EFFACER, insere: "", aria: "Effacer le caractère précédent" },
    { libelle: "(", insere: "(" },
    { libelle: ")", insere: ")" },
    { libelle: "÷", insere: "/", aria: "Diviser" },
  ],
  [
    { libelle: "7", insere: "7" },
    { libelle: "8", insere: "8" },
    { libelle: "9", insere: "9" },
    { libelle: "%", insere: "%", aria: "Modulo" },
    { libelle: "×", insere: "*", aria: "Multiplier" },
  ],
  [
    { libelle: "4", insere: "4" },
    { libelle: "5", insere: "5" },
    { libelle: "6", insere: "6" },
    { libelle: "±", insere: "", aria: "Changer de signe" },
    { libelle: "−", insere: "-", aria: "Soustraire" },
  ],
  [
    { libelle: "1", insere: "1" },
    { libelle: "2", insere: "2" },
    { libelle: "3", insere: "3" },
    { libelle: "Ans", insere: "", aria: "Dernier résultat" },
    { libelle: "+", insere: "+", aria: "Additionner" },
  ],
  [
    { libelle: "0", insere: "0" },
    { libelle: ",", insere: ",", aria: "Virgule décimale" },
  ],
];

const CHANGER_SIGNE = "±";
const RAPPEL_RESULTAT = "Ans";

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
 * Caractères que le champ de saisie laisse entrer.
 *
 * Volontairement PLUS large que `REGEX_EXPRESSION` : on doit pouvoir taper
 * « s », « i », « n » l'un après l'autre pour écrire `sin(`, or aucun de ces
 * préfixes n'est une expression valide. Le filtre du champ empêche seulement
 * ce qui n'a aucune chance d'appartenir à une formule ; la barrière qui compte
 * reste `REGEX_EXPRESSION`, appliquée juste avant l'évaluation.
 */
const CARACTERES_SAISIS = /[^0-9+\-*/^().,%√π\ssincotalge]/gi;

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

/** Une ligne du ruban d'historique : ce qui a été demandé, ce qui est sorti. */
type LigneHistorique = { expression: string; resultat: string };

export function Calculatrice() {
  const [expression, setExpression] = useState("");
  const [historique, setHistorique] = useState<LigneHistorique[]>([]);
  const champ = useRef<HTMLInputElement>(null);

  const apercu = useMemo(() => {
    if (!expression.trim()) return null;
    const valeur = evaluer(expression);
    return valeur === null ? null : formater(valeur);
  }, [expression]);

  /* Le champ prend le focus à l'ouverture : le pavé numérique doit écrire
     immédiatement, sans qu'on ait à viser l'affichage à la souris. */
  useEffect(() => {
    champ.current?.focus();
  }, []);

  /**
   * Écrit à la position du curseur et l'y replace.
   *
   * L'ancienne version concaténait en fin de chaîne : corriger le milieu d'une
   * formule obligeait à tout réécrire. `recul` sert aux touches qui ouvrent une
   * parenthèse — `sin()` place le curseur entre les parenthèses.
   */
  const inserer = useCallback((morceau: string, recul = 0) => {
    const element = champ.current;
    const debut = element?.selectionStart ?? expression.length;
    const fin = element?.selectionEnd ?? expression.length;
    const suivante = expression.slice(0, debut) + morceau + expression.slice(fin);
    setExpression(suivante);
    const curseur = debut + morceau.length - recul;
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(curseur, curseur);
    });
  }, [expression]);

  /** Efface la sélection, ou le caractère avant le curseur. */
  const effacer = useCallback(() => {
    const element = champ.current;
    const debut = element?.selectionStart ?? expression.length;
    const fin = element?.selectionEnd ?? expression.length;
    const [coupeDebut, coupeFin] = debut === fin ? [Math.max(0, debut - 1), fin] : [debut, fin];
    setExpression(expression.slice(0, coupeDebut) + expression.slice(coupeFin));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(coupeDebut, coupeDebut);
    });
  }, [expression]);

  const toutEffacer = useCallback(() => {
    setExpression("");
    champ.current?.focus();
  }, []);

  /**
   * Bascule le signe du dernier nombre écrit, pas de l'expression entière :
   * après `12*3`, on veut `12*-3`, pas `-(12*3)`.
   */
  const changerSigne = useCallback(() => {
    setExpression((courante) => {
      const nombre = /(-?)(\d+(?:[.,]\d+)?)\s*$/.exec(courante);
      if (!nombre) return courante.startsWith("-") ? courante.slice(1) : `-${courante}`;
      const debut = courante.length - nombre[0].length;
      return courante.slice(0, debut) + (nombre[1] ? nombre[2] : `-${nombre[2]}`);
    });
    champ.current?.focus();
  }, []);

  const egale = useCallback(() => {
    const valeur = evaluer(expression);
    if (valeur === null) return;
    const resultat = formater(valeur);
    setHistorique((lignes) => [{ expression: expression.trim(), resultat }, ...lignes].slice(0, 4));
    setExpression(resultat);
    requestAnimationFrame(() => {
      champ.current?.focus();
      champ.current?.setSelectionRange(resultat.length, resultat.length);
    });
  }, [expression]);

  function actionner(touche: Touche) {
    switch (touche.libelle) {
      case EFFACER_TOUT:
        return toutEffacer();
      case EFFACER:
        return effacer();
      case CHANGER_SIGNE:
        return changerSigne();
      case RAPPEL_RESULTAT:
        return inserer(historique[0]?.resultat ?? "");
      default:
        return inserer(touche.insere, touche.recul);
    }
  }

  /**
   * Les seules touches interceptées sont celles que le champ ne sait pas
   * traiter lui-même. `Backspace`, `Delete`, les flèches et le collage restent
   * au navigateur — il les fait mieux qu'une réimplémentation.
   */
  function auClavier(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "=") {
      event.preventDefault();
      egale();
      return;
    }
    if (event.key === "Escape" && expression) {
      /* Échap vide le champ tant qu'il y a quelque chose ; sur un champ déjà
         vide, on laisse l'événement remonter fermer le panneau de l'outil. */
      event.stopPropagation();
      toutEffacer();
    }
  }

  return (
    <div className="w-full select-none">
      {historique.length > 0 && (
        <ol className="mb-2 space-y-0.5" aria-label="Calculs précédents">
          {historique.map((ligne, index) => (
            <li key={`${ligne.expression}-${index}`}>
              <button
                type="button"
                onClick={() => inserer(ligne.resultat)}
                title={`Réutiliser ${ligne.resultat}`}
                className="chiffres flex w-full cursor-pointer items-baseline justify-end gap-1.5 rounded px-1.5 py-0.5 text-right text-[0.6875rem] text-texte-discret transition-colors hover:bg-surface-2 hover:text-texte"
              >
                <span className="truncate">{ligne.expression}</span>
                <span className="shrink-0 text-texte-attenue">= {ligne.resultat}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="rounded-lg border border-bordure-controle bg-surface-2 px-3 py-2.5 focus-within:border-primaire/60">
        <input
          ref={champ}
          value={expression}
          onChange={(event) => setExpression(event.target.value.replace(CARACTERES_SAISIS, ""))}
          onKeyDown={auClavier}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          aria-label="Expression à calculer"
          placeholder="0"
          className="chiffres w-full bg-transparent text-right font-mono text-base text-texte outline-none placeholder:text-texte-discret"
        />
        <p
          className="chiffres mt-1 min-h-4 text-right text-xs text-primaire"
          aria-live="polite"
          aria-label="Résultat"
        >
          {apercu !== null && expression.trim() !== apercu ? `= ${apercu}` : ""}
        </p>
      </div>

      <div className="mt-3 space-y-1.5">
        {RANGEE_SCIENTIFIQUE.map((rangee, indexRangee) => (
          <div key={`sci-${indexRangee}`} className="grid grid-cols-5 gap-1.5">
            {rangee.map((touche) => (
              <ToucheBouton
                key={touche.libelle}
                touche={touche}
                onClick={() => actionner(touche)}
                petite
              />
            ))}
          </div>
        ))}
        {RANGEES_PRINCIPALES.map((rangee, indexRangee) => (
          <div key={`main-${indexRangee}`} className="grid grid-cols-5 gap-1.5">
            {rangee.map((touche) => (
              <ToucheBouton
                key={touche.libelle}
                touche={touche}
                onClick={() => actionner(touche)}
                accentuee={touche.libelle === EFFACER_TOUT || touche.libelle === EFFACER}
                className={touche.libelle === "0" ? "col-span-2" : undefined}
              />
            ))}
            {indexRangee === RANGEES_PRINCIPALES.length - 1 && (
              <button
                type="button"
                onClick={egale}
                aria-label="Calculer"
                className="col-span-2 cursor-pointer rounded-md bg-primaire py-2 text-sm font-semibold text-primaire-contraste transition-colors hover:bg-primaire-survol focus:outline-none focus:ring-2 focus:ring-primaire/40"
              >
                =
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="mt-2 text-center text-[0.625rem] leading-relaxed text-texte-discret">
        Pavé numérique actif. Entrée calcule, Retour arrière efface, Échap vide.
      </p>
    </div>
  );
}

function ToucheBouton({
  touche,
  onClick,
  petite = false,
  accentuee = false,
  className,
}: {
  touche: Touche;
  onClick: () => void;
  petite?: boolean;
  /** Les touches d'effacement se distinguent des chiffres qu'elles annulent. */
  accentuee?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={touche.aria}
      title={touche.aria}
      className={[
        "flex items-center justify-center rounded-md border font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primaire/40",
        accentuee
          ? "border-bordure bg-surface-2 text-texte-attenue hover:border-danger/40 hover:text-danger"
          : "border-bordure bg-surface text-texte hover:bg-surface-2 hover:border-primaire/40",
        petite ? "py-1.5 text-xs" : "py-2 text-sm",
        /^[0-9]$/.test(touche.libelle) ? "chiffres" : "",
        className ?? "",
      ].join(" ")}
    >
      {touche.libelle}
    </button>
  );
}
