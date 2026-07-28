"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Difficulte, Dimension, DomaineId, TypeExercice } from "@/lib/domain/types";
import { DIFFICULTES, LIBELLES_DIMENSIONS } from "@/lib/domain/types";
import { DOMAINES, DOMAINE_PILOTE } from "@/lib/domain/referentiel";
import { creerExercice } from "@/lib/store/actions";
import { CLE_PROPOSITION_EXERCICE, type PropositionExercice } from "@/lib/tutor/proposition";
import { classesBouton, cx, Etiquette } from "@/components/ui/primitives";

/**
 * Validation d'un exercice proposé par le tuteur.
 *
 * Ce n'est plus un formulaire de saisie vierge (28/07/2026) : ADR-004 dit que
 * le contenu pédagogique vient du tuteur, et zéro exercice avait été créé à la
 * main depuis l'ouverture du produit. Onze champs offerts et jamais employés
 * sont une charge de décision sans contrepartie ; les champs ne s'affichent
 * donc qu'une fois une proposition chargée, pour être **relus et corrigés**.
 *
 * Le tuteur n'écrit jamais lui-même (P5) : il remplit ce formulaire, et c'est
 * la validation de l'utilisateur qui déclenche l'écriture. Jamais
 * `diagnostic: true` (§1.4) : le champ reste réservé aux exercices du plan
 * d'évaluation initiale.
 *
 * Le domaine n'est plus un choix : il découle du périmètre actif (ADR-018).
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

/* ------------------------------------------------------------------ */
/* Normalisation d'une proposition du tuteur                           */
/*                                                                     */
/* Le tuteur écrit du texte libre : rien ne garantit que ses valeurs    */
/* appartiennent aux énumérations du domaine. Chaque conversion échoue  */
/* en silence vers le défaut du formulaire plutôt que de rejeter la     */
/* proposition — l'utilisateur voit et corrige avant d'enregistrer.     */
/* ------------------------------------------------------------------ */

function versDomaine(valeur: string): DomaineId | null {
  return DOMAINES.find((d) => d.id === valeur)?.id ?? null;
}

function versType(valeur: string): TypeExercice | null {
  return TYPES.find((t) => t.valeur === valeur)?.valeur ?? null;
}

function versDifficulte(valeur: string): Difficulte | null {
  const n = Number.parseInt(valeur, 10);
  return n >= 1 && n <= 5 ? (n as Difficulte) : null;
}

function versDimension(valeur: string): Dimension | null {
  return DIMENSIONS.find((d) => d === valeur) ?? null;
}

export function FormulaireCreationExercice({
  skillsDisponibles,
  propositionEnAttente = false,
}: {
  skillsDisponibles: { code: string; intitule: string }[];
  /** Vrai quand on arrive du chat via `?proposition=1` (ADR-004). */
  propositionEnAttente?: boolean;
}) {
  const router = useRouter();
  const [titre, setTitre] = useState("");
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

  /**
   * Origine de l'énoncé, tracée jusqu'en base (ADR-004). Passe à « tuteur »
   * uniquement si le formulaire a effectivement été pré-rempli — un formulaire
   * repris à zéro reste « manuel ».
   */
  const [origine, setOrigine] = useState<"manuel" | "tuteur">("manuel");
  const [ignores, setIgnores] = useState<string[]>([]);
  const [propositionPerdue, setPropositionPerdue] = useState(false);

  /**
   * Charge la proposition déposée par le chat dans `sessionStorage`.
   *
   * Déclenché par un clic, jamais au montage. Deux raisons : c'est un acte
   * volontaire de l'utilisateur, cohérent avec « le tuteur ne remplit rien
   * sans toi » (P5) ; et cela évite un rendu serveur qui divergerait de
   * l'hydratation, `sessionStorage` n'existant pas côté serveur.
   *
   * La proposition est consommée une seule fois : revenir sur la page ne
   * réinjecte pas un ancien brouillon.
   */
  function chargerProposition() {
    const brut = window.sessionStorage.getItem(CLE_PROPOSITION_EXERCICE);
    if (!brut) {
      setPropositionPerdue(true);
      return;
    }
    window.sessionStorage.removeItem(CLE_PROPOSITION_EXERCICE);

    let p: PropositionExercice;
    try {
      p = JSON.parse(brut) as PropositionExercice;
    } catch {
      setPropositionPerdue(true);
      return;
    }

    const ecartes: string[] = [];

    if (p.titre) setTitre(p.titre);
    if (p.enonce) setEnonce(p.enonce);
    if (p.correction) setCorrection(p.correction);

    // Le domaine proposé n'est pas repris : il est imposé par le périmètre
    // actif. On le signale si le tuteur s'en est écarté.
    if (p.domaine && versDomaine(p.domaine) !== DOMAINE_PILOTE) {
      ecartes.push(`domaine « ${p.domaine} », hors périmètre`);
    }

    const t = versType(p.type);
    if (t) setType(t);
    else if (p.type) ecartes.push(`type « ${p.type} »`);

    const diff = versDifficulte(p.difficulte);
    if (diff) setDifficulte(diff);
    else if (p.difficulte) ecartes.push(`difficulté « ${p.difficulte} »`);

    const duree = Number.parseInt(p.dureeEstimeeMin, 10);
    if (Number.isFinite(duree) && duree > 0) setDuree(duree);

    // Une compétence hors référentiel n'est jamais retenue : le moteur
    // n'aurait rien à quoi la rattacher (anti-hallucination §2).
    const connues = new Set(skillsDisponibles.map((s) => s.code));
    const retenues = p.competences.filter((c) => connues.has(c));
    const inventees = p.competences.filter((c) => !connues.has(c));
    if (retenues.length > 0) setCompetences(retenues);
    if (inventees.length > 0) ecartes.push(`compétence(s) inconnue(s) : ${inventees.join(", ")}`);

    if (p.indices.length > 0) setIndices(p.indices);

    const criteresValides = p.criteres
      .map((c) => ({ dimension: versDimension(c.dimension), libelle: c.libelle }))
      .filter((c): c is { dimension: Dimension; libelle: string } => c.dimension !== null);
    if (criteresValides.length > 0) setCriteres(criteresValides);
    if (criteresValides.length < p.criteres.length) {
      ecartes.push("critère(s) à dimension non reconnue");
    }

    setOrigine("tuteur");
    setIgnores(ecartes);
    setPropositionPerdue(false);
  }

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
          domaine: DOMAINE_PILOTE,
          type,
          difficulte,
          competences,
          dureeEstimeeMin,
          enonce,
          indices: indices.filter((i) => i.trim()),
          correction,
          criteres: criteres.filter((c) => c.libelle.trim()),
          origine,
        });
        router.push(`/exercices/${id}`);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Création impossible.");
      }
    });
  }

  // Tant qu'aucune proposition n'a été chargée, il n'y a rien à corriger :
  // l'écran renvoie au tuteur au lieu d'ouvrir dix champs vides.
  if (origine === "manuel") {
    return (
      <div className="space-y-3 text-xs">
        {propositionEnAttente ? (
          <div className="rounded-md border border-primaire/30 bg-surface-2 px-3 py-2">
            <p className="text-texte-attenue">
              {propositionPerdue
                ? "La proposition n'est plus disponible — elle a peut-être déjà été chargée, ou l'onglet a été rouvert. Retourne au tuteur et clique à nouveau sur « Revoir et ajouter »."
                : "Le tuteur a proposé un exercice. Rien n'a été enregistré : charge-le pour le relire et le corriger avant de valider."}
            </p>
            {!propositionPerdue && (
              <button
                type="button"
                onClick={chargerProposition}
                className={cx(classesBouton("principal", "petite"), "mt-2")}
              >
                Relire la proposition du tuteur
              </button>
            )}
          </div>
        ) : (
          <p className="text-texte-attenue">
            Les exercices viennent du tuteur : demande-lui-en un, relis-le, puis valide-le
            ici. Aucun énoncé n&apos;est écrit sans que tu l&apos;aies lu.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {origine === "tuteur" && (
        <div className="rounded-md border border-info/30 bg-info-faible px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Etiquette ton="info">Proposé par le tuteur</Etiquette>
            <span className="text-texte-attenue">
              Relis avant d&apos;enregistrer : rien n&apos;a été écrit pour l&apos;instant.
            </span>
          </div>
          {ignores.length > 0 && (
            <p className="mt-1.5 text-texte-discret">
              Non repris car hors référentiel — {ignores.join(" · ")}.
            </p>
          )}
        </div>
      )}

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
