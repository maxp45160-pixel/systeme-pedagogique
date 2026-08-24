"use client";

import { useState } from "react";
import Link from "next/link";
import { cx, classesLienBouton } from "@/components/ui/primitives";
import {
  IconeAmpoule,
  IconeFleche,
  IconeValide,
  IconeFermer,
  IconeCalculatrice,
  IconeLivre,
  IconeEtudeDeCas,
  IconeRedaction,
} from "@/components/ui/icones";

type SujetCle = "maths" | "langues" | "concours" | "code";

interface QuestionDemo {
  id: string;
  sujetCle: SujetCle;
  sujetNom: string;
  competence: string;
  enonce: string;
  options: {
    id: string;
    texte: string;
    estCorrecte: boolean;
    explication: string;
  }[];
  diagnosticSucces: {
    niveau: string;
    confiance: string;
    observation: string;
    prochaineAction: string;
  };
  diagnosticEchec: {
    niveau: string;
    confiance: string;
    observation: string;
    prochaineAction: string;
  };
}

const QUESTIONS: Record<SujetCle, QuestionDemo> = {
  maths: {
    id: "maths-1",
    sujetCle: "maths",
    sujetNom: "Mathématiques",
    competence: "Dérivation — Fonctions composées",
    enonce: "Quelle est la dérivée de f(x) = (3x + 2)² ?",
    options: [
      {
        id: "a",
        texte: "f'(x) = 2(3x + 2) = 6x + 4",
        estCorrecte: false,
        explication: "Attention à la dérivée de la fonction interne u(x) = 3x + 2, qui vaut u'(x) = 3.",
      },
      {
        id: "b",
        texte: "f'(x) = 2 × 3 × (3x + 2) = 18x + 12",
        estCorrecte: true,
        explication: "Exact : formule (u²)' = 2 × u' × u. Ici 2 × 3 × (3x + 2) = 6(3x + 2) = 18x + 12.",
      },
      {
        id: "c",
        texte: "f'(x) = 6x",
        estCorrecte: false,
        explication: "Développer d'abord ou appliquer la formule de composition : (3x+2)² = 9x² + 12x + 4 dont la dérivée est 18x + 12.",
      },
    ],
    diagnosticSucces: {
      niveau: "Niveau 1 — Notions acquises",
      confiance: "35 % (Faible — 1 seule preuve)",
      observation: "Règle de composition maîtrisée sur polynôme de degré 1 sans aide.",
      prochaineAction: "Monter en complexité : dérivation de composition avec racine ou quotient.",
    },
    diagnosticEchec: {
      niveau: "Niveau 0 — À consolider",
      confiance: "30 % (Faible — 1 seule preuve)",
      observation: "Oubli fréquent du facteur de dérivée interne u'(x).",
      prochaineAction: "Exercice court de repérage ciblé sur la décomposition u(v(x)).",
    },
  },
  concours: {
    id: "concours-1",
    sujetCle: "concours",
    sujetNom: "Concours & Examens",
    competence: "Raisonnement logique & Dosage proportionnel",
    enonce:
      "Une prescription indique 15 mg/kg/jour répartis en 3 prises pour un enfant de 18 kg. Combien de mg reçoit-il par prise ?",
    options: [
      {
        id: "a",
        texte: "90 mg par prise",
        estCorrecte: true,
        explication: "Dose journalière totale = 15 × 18 = 270 mg. Répartie en 3 prises = 270 / 3 = 90 mg par prise.",
      },
      {
        id: "b",
        texte: "270 mg par prise",
        estCorrecte: false,
        explication: "270 mg est la dose totale sur 24 heures, à diviser par les 3 prises de la journée.",
      },
      {
        id: "c",
        texte: "135 mg par prise",
        estCorrecte: false,
        explication: "Le calcul 270 / 2 donne 135 mg (pour 2 prises), mais la prescription en demande 3.",
      },
    ],
    diagnosticSucces: {
      niveau: "Niveau 1 — Calcul opératoire validé",
      confiance: "40 % (Initial)",
      observation: "Enchaînement correct dose unitaire × poids / prises sans hésitation.",
      prochaineAction: "Situation d'épreuve : conversion de concentration (mg/mL) avec débit horaire.",
    },
    diagnosticEchec: {
      niveau: "Niveau 0 — Risque de confusion de consigne",
      confiance: "35 % (Initial)",
      observation: "Confusion entre dose totale journalière et dose unitaire par prise.",
      prochaineAction: "2 exercices courts d'analyse de consignes médicales et sanitaires.",
    },
  },
  langues: {
    id: "langues-1",
    sujetCle: "langues",
    sujetNom: "Langues (Espagnol)",
    competence: "Subjonctif vs Indicatif dans l'expression du doute",
    enonce: "Complétez : « No creo que ellos ___ la verdad. » (decir)",
    options: [
      {
        id: "a",
        texte: "dicen",
        estCorrecte: false,
        explication: "« No creo que » exprime le doute ou la négation de pensée et exige le subjonctif présent.",
      },
      {
        id: "b",
        texte: "digan",
        estCorrecte: true,
        explication: "Très bien : après « no creo que », le verbe irrégulier « decir » devient « digan » au subjonctif présent.",
      },
      {
        id: "c",
        texte: "dijeron",
        estCorrecte: false,
        explication: "« Dijeron » est au passé simple de l'indicatif. La concordance demande ici le subjonctif présent.",
      },
    ],
    diagnosticSucces: {
      niveau: "Niveau 1 — Règle du doute intégrée",
      confiance: "35 % (Faible — 1 seule preuve)",
      observation: "Identification du déclencheur négatif et morphologie irrégulière exacte.",
      prochaineAction: "Alternance d'amorces positives (« Creo que... ») et négatives pour tester les réflexes.",
    },
    diagnosticEchec: {
      niveau: "Niveau 0 — À pratiquer",
      confiance: "30 % (Faible — 1 seule preuve)",
      observation: "Sélection de l'indicatif par automatisme de traduction directe.",
      prochaineAction: "Fiche d'entraînement sur les verbes d'opinion et leurs bascules de mode.",
    },
  },
  code: {
    id: "code-1",
    sujetCle: "code",
    sujetNom: "Informatique & Data (Python)",
    competence: "Mutabilité & Références de listes",
    enonce: "Soit : a = [1, 2] ; b = a ; b.append(3). Que vaut 'a' ?",
    options: [
      {
        id: "a",
        texte: "[1, 2]",
        estCorrecte: false,
        explication: "En Python, l'affectation b = a copie la référence de l'objet, pas son contenu. Modifier 'b' modifie 'a'.",
      },
      {
        id: "b",
        texte: "[1, 2, 3]",
        estCorrecte: true,
        explication: "Exact : les listes sont mutables. 'a' et 'b' pointent vers le même objet en mémoire.",
      },
      {
        id: "c",
        texte: "Une erreur TypeError est levée",
        estCorrecte: false,
        explication: "L'opération append(3) est parfaitement valide sur une liste.",
      },
    ],
    diagnosticSucces: {
      niveau: "Niveau 1 — Modèle mémoire assimilé",
      confiance: "40 % (Initial)",
      observation: "Compréhension nette de l'assignation par référence sur structures mutables.",
      prochaineAction: "Cas pratique : copies superficielles vs profondes (copy.deepcopy) avec dictionnaires imbriqués.",
    },
    diagnosticEchec: {
      niveau: "Niveau 0 — Modèle mémoire flou",
      confiance: "35 % (Initial)",
      observation: "Supposition erronée d'une copie automatique par valeur lors de l'affectation.",
      prochaineAction: "Exercice visuel pas à pas sur le passage de paramètres et la modification in-place.",
    },
  },
};

const ONGLETS: { cle: SujetCle; nom: string; icone: React.ComponentType<{ className?: string }> }[] = [
  { cle: "maths", nom: "Mathématiques", icone: IconeCalculatrice },
  { cle: "concours", nom: "Concours & Tests", icone: IconeEtudeDeCas },
  { cle: "langues", nom: "Langues", icone: IconeRedaction },
  { cle: "code", nom: "Informatique & Data", icone: IconeLivre },
];

export function SimulateurDiagnostic() {
  const [sujetActif, setSujetActif] = useState<SujetCle>("maths");
  const [optionChoisie, setOptionChoisie] = useState<string | null>(null);
  const [estValide, setEstValide] = useState(false);

  const question = QUESTIONS[sujetActif];
  const reponseSelectionnee = question.options.find((opt) => opt.id === optionChoisie);
  const estSucces = reponseSelectionnee?.estCorrecte ?? false;
  const diagnostic = estSucces ? question.diagnosticSucces : question.diagnosticEchec;

  const changerSujet = (cle: SujetCle) => {
    setSujetActif(cle);
    setOptionChoisie(null);
    setEstValide(false);
  };

  const validerReponse = () => {
    if (!optionChoisie) return;
    setEstValide(true);
  };

  const reinitialiser = () => {
    setOptionChoisie(null);
    setEstValide(false);
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Sélecteur de matière */}
      <div className="flex flex-wrap items-center justify-center gap-2" role="tablist" aria-label="Choix de la matière à tester">
        {ONGLETS.map((onglet) => {
          const Icone = onglet.icone;
          const actif = onglet.cle === sujetActif;
          return (
            <button
              key={onglet.cle}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => changerSujet(onglet.cle)}
              className={cx(
                "flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-all sm:text-sm",
                actif
                  ? "border-primaire bg-primaire text-primaire-contraste shadow-sm"
                  : "border-bordure bg-surface text-texte-attenue hover:border-bordure-forte hover:bg-surface-2 hover:text-texte",
              )}
            >
              <Icone className="size-4 shrink-0" />
              <span>{onglet.nom}</span>
            </button>
          );
        })}
      </div>

      {/* Cadre du test */}
      <div className="mt-6 overflow-hidden rounded-carte border border-bordure bg-surface shadow-[var(--ombre-carte)]">
        {/* En-tête de la séance test */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bordure bg-surface-2 px-5 py-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primaire" aria-hidden />
            <span className="font-mono uppercase tracking-wider text-texte-discret">Micro-diagnostic</span>
            <span className="text-texte-discret">·</span>
            <span className="font-medium text-texte">{question.competence}</span>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {/* Énoncé */}
          <div className="rounded-lg border border-bordure-faible bg-fond/60 p-4 sm:p-5">
            <p className="font-mono text-xs uppercase tracking-wide text-texte-discret">Question de calibrage</p>
            <p className="mt-2 font-serif text-lg font-medium leading-snug text-texte sm:text-xl">{question.enonce}</p>
          </div>

          {/* Choix */}
          {!estValide ? (
            <div className="mt-6 grid gap-3">
              {question.options.map((option) => {
                const estSelectionne = optionChoisie === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setOptionChoisie(option.id)}
                    className={cx(
                      "flex w-full items-center justify-between rounded-lg border p-4 text-left text-sm transition-all sm:text-base",
                      estSelectionne
                        ? "border-primaire bg-primaire-faible/50 text-texte ring-1 ring-primaire"
                        : "border-bordure bg-surface text-texte-attenue hover:border-bordure-forte hover:bg-surface-2 hover:text-texte",
                    )}
                  >
                    <span className="font-medium">{option.texte}</span>
                    <span
                      className={cx(
                        "size-4 rounded-full border transition-colors",
                        estSelectionne ? "border-primaire bg-primaire" : "border-bordure-forte",
                      )}
                    />
                  </button>
                );
              })}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-xs text-texte-discret">
                  Sélectionnez une réponse pour voir comment le moteur analyse votre résultat.
                </p>
                <button
                  type="button"
                  disabled={!optionChoisie}
                  onClick={validerReponse}
                  className={cx(
                    classesLienBouton("principal"),
                    !optionChoisie && "cursor-not-allowed opacity-50",
                  )}
                >
                  Valider et voir la dérivation
                  <IconeFleche className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Résultat et analyse du moteur */
            <div className="mt-6 space-y-6">
              {/* Explication de la réponse */}
              <div
                className={cx(
                  "rounded-lg border p-4 text-sm",
                  estSucces
                    ? "border-valide/30 bg-valide/10 text-texte"
                    : "border-alerte/30 bg-alerte/10 text-texte",
                )}
              >
                <div className="flex items-start gap-2.5">
                  {estSucces ? (
                    <IconeValide className="mt-0.5 size-4 shrink-0 text-valide" />
                  ) : (
                    <IconeFermer className="mt-0.5 size-4 shrink-0 text-alerte" />
                  )}
                  <div>
                    <p className="font-medium">
                      {estSucces ? "Réponse exacte" : "Réponse incorrecte"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-texte-attenue">
                      {reponseSelectionnee?.explication}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ce que le système dérive */}
              <div className="rounded-carte border border-bordure bg-surface-2 p-5 sm:p-6">
                <div className="flex items-center gap-2 border-b border-bordure pb-3">
                  <IconeAmpoule className="size-4 text-primaire" />
                  <h4 className="font-serif text-base font-medium text-texte">
                    Ce que le moteur déduit de cette tentative
                  </h4>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border border-bordure bg-surface p-3.5">
                    <span className="font-mono text-[0.6875rem] uppercase tracking-wide text-texte-discret">
                      Niveau dérivé
                    </span>
                    <p className="mt-1 font-serif text-base font-medium text-texte">{diagnostic.niveau}</p>
                    <p className="mt-1 text-xs text-texte-discret">
                      Calculé d&apos;après le succès observé, sans pénalité de démarrage.
                    </p>
                  </div>

                  <div className="rounded-md border border-bordure bg-surface p-3.5">
                    <span className="font-mono text-[0.6875rem] uppercase tracking-wide text-texte-discret">
                      Indice de confiance
                    </span>
                    <p className="mt-1 font-serif text-base font-medium text-texte">{diagnostic.confiance}</p>
                    <p className="mt-1 text-xs text-texte-discret">
                      Le système refuse de surévaluer sans plusieurs démonstrations dans le temps.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3 rounded-md border border-bordure bg-surface p-4 text-xs">
                  <div>
                    <span className="font-semibold text-texte">Observation consignée : </span>
                    <span className="text-texte-attenue">{diagnostic.observation}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-primaire">Meilleure action étayée maintenant : </span>
                    <span className="text-texte-attenue">{diagnostic.prochaineAction}</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-bordure pt-4">
                  <button
                    type="button"
                    onClick={reinitialiser}
                    className="text-xs text-texte-attenue hover:text-texte"
                  >
                    ← Essayer une autre réponse
                  </button>

                  <Link href="/login?mode=inscription" className={classesLienBouton("principal")}>
                    Créer mon compte et continuer l&apos;apprentissage
                    <IconeFleche className="size-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
