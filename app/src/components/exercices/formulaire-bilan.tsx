"use client";

import { useState, useTransition } from "react";
import type { Dimension, Exercise } from "@/lib/domain/types";
import { LIBELLES_DIMENSIONS } from "@/lib/domain/types";
import { terminerExercice } from "@/lib/store/actions";
import { BandeauInfo, Bouton, cx } from "@/components/ui/primitives";
import { autonomieObservee, LIBELLE_AIDE, type AideExterne } from "@/lib/engine/preuve";
import { APPRECIATIONS, RESULTATS, type ResultatBilan } from "@/lib/domain/bilan";
import type { BilanRedige } from "@/lib/tutor/conversion-correction";
import { BilanRedigeVue } from "@/components/exercices/bilan-redige";
import type { ContexteNavigationExercice } from "@/lib/domain/navigation-exercice";

/*
 * `APPRECIATIONS` et `RESULTATS` vivaient ici. Ils sont partis dans
 * `lib/domain/bilan.ts` parce que le prompt de correction (lot A1) doit rendre
 * son verdict dans **exactement** les mêmes termes : deux échelles qui
 * divergent ne lèveraient aucune erreur, elles produiraient une mesure fausse.
 */

const AIDES: { valeur: AideExterne; libelle: string }[] = [
  { valeur: "aucune", libelle: "Aucune" },
  { valeur: "documentation", libelle: "Documentation, cours, manuel" },
  { valeur: "assistant-ia", libelle: "Assistant IA" },
  { valeur: "correction", libelle: "Correction obtenue" },
];

/**
 * Évaluation après lecture de la correction.
 *
 * L'utilisateur juge sa performance critère par critère ; le système en tire
 * les dimensions de la preuve. Il ne choisit PAS son niveau d'autonomie :
 * celui-ci est déduit du nombre d'indices réellement consultés, donc observé
 * et non déclaré.
 */
/**
 * Le verdict du tuteur, déjà converti et vérifié (`conversion-correction.ts`).
 *
 * Il ne porte ni durée, ni aide extérieure, ni note — voir plus bas : ce sont
 * les seules choses que le tuteur ne peut pas savoir.
 */
export interface PropositionBilan {
  resultat: ResultatBilan;
  /** Index base 0, comme `exercice.criteres`. */
  appreciations: Record<number, number>;
  justifications: Record<number, string>;
  /**
   * Le retour rédigé (ADR-046) — la seule partie du verdict qui ne pré-remplit
   * rien. Elle s'affiche, elle ne se coche pas.
   */
  bilan?: BilanRedige;
}

export function FormulaireBilan({
  exercice,
  attemptId,
  dureeSuggeree,
  indicesUtilises,
  propositionInitiale,
  criteresReplies = false,
  navigation,
}: {
  exercice: Exercise;
  attemptId: string;
  dureeSuggeree: number;
  indicesUtilises: number;
  /** Verdict proposé par le tuteur. Absent : le formulaire s'ouvre vide, comme avant. */
  propositionInitiale?: PropositionBilan;
  /** Replie la liste des critères derrière « Relire / modifier ». */
  criteresReplies?: boolean;
  navigation?: ContexteNavigationExercice;
}) {
  /*
   * Initialiseurs paresseux, jamais un `useEffect` (CLAUDE.md §8).
   *
   * Un `useEffect` qui recopie une prop dans l'état écrase les modifications de
   * l'utilisateur au moindre re-rendu : on cocherait un critère et il
   * reviendrait à la valeur du tuteur. Ici la proposition est une valeur
   * INITIALE — après quoi l'état appartient à la personne.
   */
  const [resultat, setResultat] = useState<ResultatBilan>(
    () => propositionInitiale?.resultat ?? "reussi",
  );
  const [criteres, setCriteres] = useState<Record<number, number>>(
    () => propositionInitiale?.appreciations ?? {},
  );
  const [duree, setDuree] = useState(dureeSuggeree);
  const [notes, setNotes] = useState("");
  const [aide, setAide] = useState<AideExterne>("aucune");
  const [detaille, setDetaille] = useState(!criteresReplies);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const justifications = propositionInitiale?.justifications ?? {};
  const bilanRedige = propositionInitiale?.bilan;
  const assiste = propositionInitiale !== undefined;

  const tousRenseignes = exercice.criteres.every((_, i) => criteres[i] !== undefined);

  const autonomieCalculee = autonomieObservee(
    indicesUtilises,
    exercice.indices.length,
    aide,
  );
  const autonomiePrevue = `${autonomieCalculee} — ${
    autonomieCalculee === "A0"
      ? "solution fournie"
      : autonomieCalculee === "A1"
        ? "fortement guidé"
        : autonomieCalculee === "A2"
          ? "quelques indices nécessaires"
          : autonomieCalculee === "A3"
            ? "résolution autonome"
            : "autonome avec initiative méthodologique"
  }`;

  function soumettre() {
    setErreur(null);

    // Agrège les critères par dimension : moyenne des critères qui la visent.
    const parDimension = new Map<Dimension, number[]>();
    exercice.criteres.forEach((c, i) => {
      const v = criteres[i];
      if (v === undefined) return;
      parDimension.set(c.dimension, [...(parDimension.get(c.dimension) ?? []), v]);
    });
    const evaluation: Partial<Record<Dimension, number>> = {};
    for (const [d, valeurs] of parDimension) {
      evaluation[d] = valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
    }

    demarrer(async () => {
      try {
        await terminerExercice({
          attemptId,
          exerciseId: exercice.id,
          resultat,
          evaluation,
          dureeMin: duree,
          notes: notes.trim() || undefined,
          aideExterne: aide,
          /*
            Le verdict archivé est celui du TUTEUR, pas celui affiché après
            modification (ADR-046). On envoie `propositionInitiale`, jamais
            l'état local : écrire l'état confondrait ce qui a été proposé avec
            ce que la personne a retenu, et l'écart entre les deux est
            précisément ce qu'on veut pouvoir observer.
          */
          verdictTuteur: propositionInitiale?.bilan
            ? {
                resultat: propositionInitiale.resultat,
                appreciations: propositionInitiale.appreciations,
                justifications: propositionInitiale.justifications,
                bilan: propositionInitiale.bilan,
              }
            : undefined,
          navigation,
        });
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Résultat global */}
      <div>
        <div className="mb-2 text-xs font-medium">Comment évalues-tu ta résolution ?</div>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {RESULTATS.map((r) => (
            <button
              key={r.valeur}
              type="button"
              onClick={() => setResultat(r.valeur)}
              className={cx(
                "rounded-md border px-3 py-2 text-left transition-colors",
                resultat === r.valeur
                  ? "border-primaire/40 bg-primaire-faible"
                  : "border-bordure hover:bg-surface-2",
              )}
            >
              <div
                className={cx(
                  "text-xs font-medium",
                  resultat === r.valeur && "text-primaire",
                )}
              >
                {r.libelle}
              </div>
              <div className="mt-0.5 text-[0.625rem] text-texte-discret">{r.aide}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Critères */}
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-xs font-medium">
            Critère par critère
            <span className="ml-1.5 font-normal text-texte-discret">
              {assiste
                ? "— relis le verdict du tuteur : c'est toi qui décides"
                : "— sois honnête : c'est ce qui rend le suivi utile"}
            </span>
          </div>
          {/*
            Le repli n'existe que quand un verdict a été proposé. Sans lui, la
            personne remplit elle-même : replier ce qu'elle doit remplir
            n'aurait aucun sens.
          */}
          {criteresReplies && (
            <button
              type="button"
              onClick={() => setDetaille((d) => !d)}
              aria-expanded={detaille}
              className="text-[0.6875rem] text-texte-attenue underline-offset-2 hover:text-texte hover:underline"
            >
              {detaille ? "Replier" : "Relire / modifier"}
            </button>
          )}
        </div>

        {/*
          Vue compacte : les JUSTIFICATIONS restent visibles, pas seulement les
          pastilles. C'est la mitigation principale du risque central de ce lot
          — qu'« Accepter » devienne un tampon et corrompe la mesure à l'entrée
          de la chaîne. Un verdict qu'on ne peut pas lire ne se relit pas.
        */}
        {!detaille && (
          <ul className="space-y-1.5">
            {exercice.criteres.map((c, i) => {
              const valeur = criteres[i];
              const libelle = APPRECIATIONS.find((a) => a.valeur === valeur)?.libelle ?? "—";
              return (
                <li
                  key={i}
                  className="rounded-md border border-bordure-controle bg-surface-2 px-3 py-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="min-w-0 flex-1 text-xs">{c.libelle}</p>
                    <span
                      className={cx(
                        "shrink-0 rounded border px-1.5 py-0.5 text-[0.625rem] font-medium",
                        valeur === 1
                          ? "border-succes/40 bg-succes-faible text-succes"
                          : valeur === 0.5
                            ? "border-alerte/40 bg-alerte-faible text-alerte"
                            : "border-bordure-controle bg-surface text-texte-attenue",
                      )}
                    >
                      {libelle}
                    </span>
                  </div>
                  {justifications[i] && (
                    <p className="mt-1 text-[0.6875rem] text-texte-attenue">{justifications[i]}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {detaille && (
          <ul className="space-y-2">
            {exercice.criteres.map((c, i) => (
              <li
                key={i}
                className="rounded-md border border-bordure-controle bg-surface-2 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs">{c.libelle}</p>
                    <p className="mt-0.5 text-[0.625rem] text-texte-discret">
                      {LIBELLES_DIMENSIONS[c.dimension]}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {APPRECIATIONS.map((a) => (
                      <button
                        key={a.valeur}
                        type="button"
                        onClick={() => setCriteres((p) => ({ ...p, [i]: a.valeur }))}
                        className={cx(
                          "rounded border px-2 py-1 text-[0.6875rem] font-medium transition-colors",
                          criteres[i] === a.valeur
                            ? "border-primaire/40 bg-primaire text-primaire-contraste"
                            : "border-bordure-controle bg-surface text-texte-attenue hover:bg-surface-3",
                        )}
                      >
                        {a.libelle}
                      </button>
                    ))}
                  </div>
                </div>
                {justifications[i] && (
                  <p className="mt-1.5 border-t border-bordure pt-1.5 text-[0.6875rem] text-texte-attenue">
                    <span className="text-texte-discret">Tuteur —</span> {justifications[i]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/*
        Le retour rédigé du tuteur (ADR-046).

        Il vit APRÈS les critères et ne pré-remplit rien : c'est ce qui le
        distingue du reste du verdict. Les appréciations sont une mesure que la
        personne valide ; ceci est un conseil qu'elle lit. Les mêler ferait de
        la lecture un acte de validation.

        Affiché même si la personne modifie les critères : le tuteur a jugé ce
        qu'il a lu, et son analyse reste ce qu'elle était.
      */}
      {bilanRedige && <BilanRedigeVue bilan={bilanRedige} />}

      {/*
        Aide extérieure — plafonne l'autonomie enregistrée (ADR-033).

        ⚠️ Ce bloc et la durée restent HORS du repli, même quand le tuteur a
        proposé un verdict. Ce n'est pas un oubli : l'aide extérieure est un
        fait que seule la personne connaît — le tuteur ne peut pas savoir si
        elle avait un assistant ouvert à côté. La lui faire proposer serait
        fabriquer la donnée même qu'ADR-033 existe pour aller chercher.
      */}
      <div>
        <div className="mb-2 text-xs font-medium">
          As-tu eu besoin d&apos;aide extérieure ?
          <span className="ml-1.5 font-normal text-texte-discret">
            — cela plafonne l&apos;autonomie enregistrée
          </span>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {AIDES.map((a) => (
            <button
              key={a.valeur}
              type="button"
              onClick={() => setAide(a.valeur)}
              className={cx(
                "rounded-md border px-3 py-2 text-left text-xs transition-colors",
                aide === a.valeur
                  ? "border-primaire/40 bg-primaire-faible text-primaire"
                  : "border-bordure text-texte-attenue hover:bg-surface-2",
              )}
            >
              {a.libelle}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[0.625rem] text-texte-discret">
          {aide === "aucune" &&
            "Aucune aide extérieure : l'autonomie sera déduite des seuls indices consultés."}
          {aide === "documentation" &&
            "Documentation consultée : l'autonomie est plafonnée à A2 — quelques indices nécessaires."}
          {aide === "assistant-ia" &&
            "Assistant IA sollicité : l'autonomie est plafonnée à A1 — solution fortement guidée."}
          {aide === "correction" &&
            "Correction obtenue : l'autonomie est plafonnée à A0 — solution fournie."}
        </p>
      </div>

      {/* Durée et notes */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium">Temps passé</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={600}
              value={duree}
              onChange={(e) => setDuree(Math.max(1, Number(e.target.value) || 1))}
              className="chiffres w-20 rounded-md border border-bordure-controle bg-surface px-2 py-1 text-sm"
            />
            <span className="text-xs text-texte-attenue">minutes</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium">Note personnelle (optionnelle)</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ce qui a bloqué, ce que je retiens…"
            className="mt-1 w-full rounded-md border border-bordure-controle bg-surface px-2 py-1 text-sm placeholder:text-texte-discret"
          />
        </label>
      </div>

      {/* Ce qui sera enregistré — annoncé avant l'écriture, pas après. */}
      <div className="rounded-md border border-bordure-controle bg-surface-2 px-3 py-2.5 text-[0.6875rem] text-texte-attenue">
        <p className="font-medium text-texte">Ce qui sera enregistré</p>
        <ul className="mt-1 space-y-0.5">
          <li>
            · Une preuve directe pour <strong>{exercice.competences[0]}</strong>
            {exercice.competences.length > 1 && (
              <>
                , et une preuve indirecte pour {exercice.competences.slice(1).join(", ")}
              </>
            )}
          </li>
          <li>
            · Autonomie <strong>{autonomiePrevue}</strong>, déduite des {indicesUtilises} indice(s)
            consulté(s)
            {aide !== "aucune" && (
              <>
                {" "}
                — plafonnée par l&apos;aide déclarée : {LIBELLE_AIDE[aide]}
              </>
            )}
          </li>
          <li>· Une entrée de journal datée</li>
        </ul>
        <p className="mt-1.5">
          Le niveau n{"'"}évoluera que si cette preuve le justifie au regard du protocole
          d{"'"}évaluation. Une réussite isolée ne suffit pas à dépasser le niveau 2.
        </p>
      </div>

      {erreur && (
        <BandeauInfo ton="danger" taille="compacte">
          <p className="text-danger">{erreur}</p>
        </BandeauInfo>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Bouton onClick={soumettre} disabled={!tousRenseignes || enCours} variante="principal">
          {enCours
            ? "Enregistrement…"
            : assiste
              ? "Accepter et enregistrer"
              : "Enregistrer la preuve"}
        </Bouton>
        {!tousRenseignes && (
          <span className="text-xs text-texte-discret">
            Renseigne chaque critère pour continuer.
          </span>
        )}
      </div>
    </div>
  );
}
