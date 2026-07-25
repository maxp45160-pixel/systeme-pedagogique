"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Difficulte, Dimension, DomaineId, TypeExercice } from "@/lib/domain/types";
import { DIFFICULTES, LIBELLES_DIMENSIONS } from "@/lib/domain/types";
import { DOMAINES } from "@/lib/domain/referentiel";
import { creerExercice } from "@/lib/store/actions";
import { classesBouton, cx } from "@/components/ui/primitives";

/**
 * Création manuelle d'un exercice, à partir de ce que le tuteur a produit en
 * conversation (copier-coller). Jamais `diagnostic: true` (§1.4) : le champ
 * reste réservé aux 10 exercices du plan d'évaluation initiale.
 */

const TYPES: { valeur: TypeExercice; libelle: string }[] = [
  { valeur: "rappel", libelle: "Rappel" },
  { valeur: "application", libelle: "Application" },
  { valeur: "calcul", libelle: "Calcul" },
  { valeur: "probleme", libelle: "Problème" },
  { valeur: "etude-de-cas", libelle: "Étude de cas" },
  { valeur: "programmation", libelle: "Programmation" },
  { valeur: "simulation", libelle: "Simulation" },
  { valeur: "projet", libelle: "Projet" },
];

const DIMENSIONS: Dimension[] = [
  "comprehension",
  "application",
  "transfert",
  "integration",
  "justification",
];

const champ =
  "mt-1 w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none";

export function FormulaireCreationExercice({
  skillsDisponibles,
}: {
  skillsDisponibles: { code: string; intitule: string }[];
}) {
  const router = useRouter();
  const [titre, setTitre] = useState("");
  const [domaine, setDomaine] = useState<DomaineId>(DOMAINES[0].id);
  const [type, setType] = useState<TypeExercice>("probleme");
  const [difficulte, setDifficulte] = useState<Difficulte>(2);
  const [competences, setCompetences] = useState<string[]>([]);
  const [dureeEstimeeMin, setDuree] = useState(20);
  const [enonce, setEnonce] = useState("");
  const [indices, setIndices] = useState<string[]>([""]);
  const [correction, setCorrection] = useState("");
  const [criteres, setCriteres] = useState<{ dimension: Dimension; libelle: string }[]>([
    { dimension: "comprehension", libelle: "" },
  ]);

  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const pret =
    titre.trim() &&
    enonce.trim() &&
    correction.trim() &&
    competences.length > 0 &&
    criteres.some((c) => c.libelle.trim());

  function soumettre() {
    setErreur(null);
    demarrer(async () => {
      try {
        const id = await creerExercice({
          titre,
          domaine,
          type,
          difficulte,
          competences,
          dureeEstimeeMin,
          enonce,
          indices: indices.filter((i) => i.trim()),
          correction,
          criteres: criteres.filter((c) => c.libelle.trim()),
        });
        router.push(`/exercices/${id}`);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Création impossible.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-medium">Titre</span>
        <input
          type="text"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Stock de sécurité avec délai variable"
          className={champ}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium">Domaine</span>
          <select
            value={domaine}
            onChange={(e) => setDomaine(e.target.value as DomaineId)}
            className={champ}
          >
            {DOMAINES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TypeExercice)}
            className={champ}
          >
            {TYPES.map((t) => (
              <option key={t.valeur} value={t.valeur}>
                {t.libelle}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium">Difficulté</span>
          <select
            value={difficulte}
            onChange={(e) => setDifficulte(Number(e.target.value) as Difficulte)}
            className={champ}
          >
            {([1, 2, 3, 4, 5] as Difficulte[]).map((n) => (
              <option key={n} value={n}>
                {n}/5 — {DIFFICULTES[n]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium">Durée estimée (min)</span>
          <input
            type="number"
            min={1}
            max={600}
            value={dureeEstimeeMin}
            onChange={(e) => setDuree(Math.max(1, Number(e.target.value) || 1))}
            className={cx(champ, "chiffres")}
          />
        </label>
      </div>

      <div>
        <label className="block">
          <span className="text-xs font-medium">Compétences ciblées (au moins une)</span>
          <select
            multiple
            value={competences}
            onChange={(e) => setCompetences([...e.target.selectedOptions].map((o) => o.value))}
            size={5}
            className={cx(champ, "text-xs")}
          >
            {skillsDisponibles.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} — {s.intitule}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-1 text-[0.625rem] text-texte-discret">
          La première sélectionnée est la cible principale. Ctrl/⌘ + clic pour en choisir plusieurs.
        </p>
      </div>

      <label className="block">
        <span className="text-xs font-medium">Énoncé</span>
        <textarea
          value={enonce}
          onChange={(e) => setEnonce(e.target.value)}
          rows={5}
          placeholder="Le problème posé. Markdown léger accepté."
          className={cx(champ, "resize-y")}
        />
      </label>

      {/* Indices — liste dynamique, peut rester vide */}
      <div>
        <div className="mb-1 text-xs font-medium">
          Indices <span className="font-normal text-texte-discret">— du plus léger au plus explicite, optionnels</span>
        </div>
        <div className="space-y-1.5">
          {indices.map((ind, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                type="text"
                value={ind}
                onChange={(e) =>
                  setIndices((p) => p.map((x, j) => (j === i ? e.target.value : x)))
                }
                placeholder={`Indice ${i + 1}`}
                className={cx(champ, "mt-0")}
              />
              <button
                type="button"
                onClick={() => setIndices((p) => p.filter((_, j) => j !== i))}
                className={classesBouton("discret", "petite")}
                aria-label="Retirer cet indice"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIndices((p) => [...p, ""])}
          className={cx(classesBouton("secondaire", "petite"), "mt-1.5")}
        >
          + Ajouter un indice
        </button>
      </div>

      <label className="block">
        <span className="text-xs font-medium">Correction</span>
        <textarea
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          rows={5}
          placeholder="La correction complète, révélée après tentative."
          className={cx(champ, "resize-y")}
        />
      </label>

      {/* Critères — au moins un */}
      <div>
        <div className="mb-1 text-xs font-medium">
          Critères d&apos;auto-évaluation{" "}
          <span className="font-normal text-texte-discret">— au moins un</span>
        </div>
        <div className="space-y-1.5">
          {criteres.map((c, i) => (
            <div key={i} className="flex gap-1.5">
              <select
                value={c.dimension}
                onChange={(e) =>
                  setCriteres((p) =>
                    p.map((x, j) =>
                      j === i ? { ...x, dimension: e.target.value as Dimension } : x,
                    ),
                  )
                }
                className={cx(champ, "mt-0 w-40 shrink-0")}
              >
                {DIMENSIONS.map((d) => (
                  <option key={d} value={d}>
                    {LIBELLES_DIMENSIONS[d]}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={c.libelle}
                onChange={(e) =>
                  setCriteres((p) =>
                    p.map((x, j) => (j === i ? { ...x, libelle: e.target.value } : x)),
                  )
                }
                placeholder="Ce que l'utilisateur doit pouvoir cocher"
                className={cx(champ, "mt-0")}
              />
              <button
                type="button"
                onClick={() => setCriteres((p) => p.filter((_, j) => j !== i))}
                disabled={criteres.length === 1}
                className={classesBouton("discret", "petite")}
                aria-label="Retirer ce critère"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCriteres((p) => [...p, { dimension: "comprehension", libelle: "" }])}
          className={cx(classesBouton("secondaire", "petite"), "mt-1.5")}
        >
          + Ajouter un critère
        </button>
      </div>

      {erreur && (
        <p className="rounded-md border border-danger/30 bg-danger-faible px-3 py-2 text-xs text-danger">
          {erreur}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-bordure pt-3">
        <button
          type="button"
          onClick={soumettre}
          disabled={!pret || enCours}
          className={classesBouton("principal")}
        >
          {enCours ? "Création…" : "Créer l'exercice"}
        </button>
        {!pret && (
          <span className="text-xs text-texte-discret">
            Titre, énoncé, correction, au moins une compétence et un critère sont requis.
          </span>
        )}
      </div>
    </div>
  );
}
