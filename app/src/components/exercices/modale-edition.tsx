"use client";

/**
 * Corriger un exercice sans le perdre (ADR-047).
 *
 * ## Le besoin, dépouillé de la solution
 *
 * Remonté à l'usage : « l'utilisateur ne peut pas suggérer de modification ou
 * signaler facilement un problème sur un exercice ». Un « signalement »
 * supposerait un destinataire — il n'y en a pas, la personne est seule avec son
 * corpus. Le besoin réel est plus simple et plus direct : **corriger**.
 *
 * Le corpus est écrit par un LLM et relu par personne. Sans ce chemin, un
 * énoncé ambigu ou une correction fausse n'avait qu'une issue : l'archivage,
 * c'est-à-dire jeter le seul contenu disponible pour une compétence qui, le
 * plus souvent, n'en a aucun autre.
 *
 * ## Ce que l'écran annonce avant le clic
 *
 * Le nombre de tentatives déjà portées. Corriger n'efface aucune preuve — elles
 * mesurent une tentative sur l'énoncé d'alors, et les retoucher serait réécrire
 * l'histoire (P4). Mais la personne doit savoir que l'exercice qu'elle modifie
 * a déjà servi, comme le retrait annonce son mode avant de s'exécuter (ADR-027).
 */

import { useState, useTransition } from "react";
import type { Dimension, Exercise, TypeExercice } from "@/lib/domain/types";
import { LIBELLES_DIMENSIONS } from "@/lib/domain/types";
import { modifierExercice } from "@/lib/store/actions";
import { BandeauInfo, Bouton, cx } from "@/components/ui/primitives";
import { Champ, ChampSelect } from "@/components/ui/champ";
import { Modale } from "@/components/ui/modale";
import {
  DIFFICULTE_MAX,
  DIFFICULTE_MIN,
  DUREE_ESTIMEE_MAX,
  DUREE_ESTIMEE_MIN,
  motifRefusExercice,
} from "@/lib/domain/exercice";

/** Les huit types du domaine, dans l'ordre de `TypeExercice`. */
const TYPES: TypeExercice[] = [
  "rappel",
  "application",
  "calcul",
  "probleme",
  "etude-de-cas",
  "programmation",
  "simulation",
  "projet",
];

const DIMENSIONS: Dimension[] = [
  "comprehension",
  "application",
  "transfert",
  "integration",
  "justification",
];

export function ModaleEdition({
  exercice,
  tentatives,
  onFermer,
}: {
  exercice: Exercise;
  /** Tentatives déjà portées — annoncées avant le clic, jamais bloquantes. */
  tentatives: number;
  onFermer: () => void;
}) {
  const [titre, setTitre] = useState(exercice.titre);
  const [type, setType] = useState<TypeExercice>(exercice.type);
  const [difficulte, setDifficulte] = useState(String(exercice.difficulte));
  const [duree, setDuree] = useState(String(exercice.dureeEstimeeMin));
  const [enonce, setEnonce] = useState(exercice.enonce);
  const [indices, setIndices] = useState(exercice.indices.join("\n"));
  const [correction, setCorrection] = useState(exercice.correction);
  const [criteres, setCriteres] = useState(exercice.criteres);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const contenu = {
    titre,
    difficulte: Number(difficulte),
    dureeEstimeeMin: Number(duree),
    competences: exercice.competences,
    enonce,
    correction,
    criteres,
  };
  /*
   * La MÊME fonction que le serveur (`lib/domain/exercice.ts`).
   *
   * L'écran ne réécrit pas les règles : il les rejoue pour dire tout de suite
   * ce qui cloche. Une validation d'interface qui diverge de celle du serveur
   * produit soit un refus incompréhensible, soit — pire — une acceptation que
   * le serveur rejettera après coup.
   */
  const refusLocal = motifRefusExercice(contenu);

  function soumettre() {
    setErreur(null);
    demarrer(async () => {
      try {
        await modifierExercice({
          exerciceId: exercice.id,
          domaine: exercice.domaine,
          competences: exercice.competences,
          type,
          titre,
          difficulte: Number(difficulte) as Exercise["difficulte"],
          dureeEstimeeMin: Number(duree),
          enonce,
          indices: indices.split("\n").filter((i) => i.trim().length > 0),
          correction,
          criteres,
        });
        onFermer();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Modification impossible.");
      }
    });
  }

  return (
    <Modale
      titre="Corriger cet exercice"
      sousTitre="L'énoncé, les indices, la correction et le calibrage. Les compétences visées ne changent pas ici."
      onFermer={onFermer}
      pied={
        <>
          <Bouton variante="secondaire" onClick={onFermer} disabled={enCours}>
            Annuler
          </Bouton>
          <Bouton
            variante="principal"
            onClick={soumettre}
            disabled={refusLocal !== null}
            enChargement={enCours}
          >
            Enregistrer les corrections
          </Bouton>
        </>
      }
    >
      <div className="space-y-4">
        {/*
          Annoncé avant le clic, pas après (ADR-027 appliqué à l'exercice) :
          modifier un exercice qui a déjà servi est un geste différent de
          modifier un brouillon, et la personne doit le savoir en le faisant.
        */}
        {tentatives > 0 && (
          <BandeauInfo ton="info" taille="compacte">
            <p className="text-xs text-texte-attenue">
              Cet exercice porte {tentatives} tentative{tentatives > 1 ? "s" : ""}. Les preuves
              déjà écrites ne changent pas : elles mesurent ce qui a été fait sur l&apos;énoncé
              d&apos;alors. La date de modification sera enregistrée pour que le journal reste
              lisible.
            </p>
          </BandeauInfo>
        )}

        <Champ label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} requis />

        <div className="grid gap-3 sm:grid-cols-3">
          <ChampSelect
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as TypeExercice)}
            options={TYPES.map((t) => ({ valeur: t, libelle: t }))}
          />
          <Champ
            label={`Difficulté (${DIFFICULTE_MIN}–${DIFFICULTE_MAX})`}
            type="number"
            min={DIFFICULTE_MIN}
            max={DIFFICULTE_MAX}
            value={difficulte}
            onChange={(e) => setDifficulte(e.target.value)}
          />
          <Champ
            label={`Durée estimée (${DUREE_ESTIMEE_MIN}–${DUREE_ESTIMEE_MAX} min)`}
            type="number"
            min={DUREE_ESTIMEE_MIN}
            max={DUREE_ESTIMEE_MAX}
            value={duree}
            onChange={(e) => setDuree(e.target.value)}
            aide="Le moteur s'en sert pour juger si une tentative a eu lieu."
          />
        </div>

        <Champ
          label="Énoncé"
          multiligne
          rows={8}
          value={enonce}
          onChange={(e) => setEnonce(e.target.value)}
          requis
        />

        <Champ
          label="Indices"
          multiligne
          rows={3}
          value={indices}
          onChange={(e) => setIndices(e.target.value)}
          aide="Un par ligne, du plus léger au plus explicite. Laisser vide pour n'en proposer aucun."
        />

        <Champ
          label="Correction"
          multiligne
          rows={8}
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          requis
        />

        <div>
          <p className="text-xs font-medium">Critères d&apos;évaluation</p>
          <p className="mt-0.5 text-[0.6875rem] text-texte-discret">
            Ce sont eux qui produisent les dimensions de la preuve. En retirer un change ce que
            l&apos;exercice mesure.
          </p>
          <ul className="mt-2 space-y-2">
            {criteres.map((c, i) => (
              <li key={i} className="rounded-md border border-bordure px-3 py-2">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Champ
                      label="Libellé"
                      value={c.libelle}
                      onChange={(e) =>
                        setCriteres((l) =>
                          l.map((x, k) => (k === i ? { ...x, libelle: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                  <ChampSelect
                    label="Dimension"
                    value={c.dimension}
                    onChange={(e) =>
                      setCriteres((l) =>
                        l.map((x, k) =>
                          k === i ? { ...x, dimension: e.target.value as Dimension } : x,
                        ),
                      )
                    }
                    options={DIMENSIONS.map((d) => ({
                      valeur: d,
                      libelle: LIBELLES_DIMENSIONS[d],
                    }))}
                  />
                  <Bouton
                    variante="discret"
                    taille="petite"
                    onClick={() => setCriteres((l) => l.filter((_, k) => k !== i))}
                    disabled={criteres.length <= 1}
                    title={
                      criteres.length <= 1
                        ? "Un exercice sans critère ne mesure rien"
                        : "Retirer ce critère"
                    }
                  >
                    Retirer
                  </Bouton>
                </div>
              </li>
            ))}
          </ul>
          <Bouton
            variante="secondaire"
            taille="petite"
            className="mt-2"
            onClick={() =>
              setCriteres((l) => [...l, { dimension: "application", libelle: "" }])
            }
          >
            + Critère
          </Bouton>
        </div>

        {(erreur ?? refusLocal) && (
          <BandeauInfo ton={erreur ? "danger" : "alerte"} taille="compacte">
            <p className={cx("text-xs", erreur ? "text-danger" : "text-alerte")}>
              {erreur ?? refusLocal}
            </p>
          </BandeauInfo>
        )}

      </div>
    </Modale>
  );
}
