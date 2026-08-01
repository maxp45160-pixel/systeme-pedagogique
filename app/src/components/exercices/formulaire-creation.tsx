"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Difficulte, Dimension, TypeExercice } from "@/lib/domain/types";
import { DIFFICULTES, LIBELLES_DIMENSIONS } from "@/lib/domain/types";
import { creerExercice } from "@/lib/store/actions";
import {
  CLE_PROPOSITION_EXERCICE,
  exerciceComplet,
  type PropositionExercice,
} from "@/lib/tutor/proposition";
import { classesBouton, cx, Etiquette } from "@/components/ui/primitives";
import { useEstHydrate } from "@/lib/ui/hydratation";
import { cleParCompte, ecrireSession, effacerSession, lireSession } from "@/lib/ui/stockage-session";

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
 * Le domaine n'est pas un choix : il **découle de la compétence cible**. Il
 * découlait jusqu'au 31/07/2026 du périmètre pilote global, qui n'existe plus —
 * le référentiel est propre au compte et peut compter plusieurs domaines actifs
 * (ADR-026). Le dériver de la compétence supprime au passage la possibilité
 * qu'un exercice soit rangé dans un domaine autre que celui qu'il mesure.
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

/**
 * Ce qui est conservé d'un formulaire à moitié rempli.
 *
 * Miroir exact des états de saisie ci-dessous. Le domaine n'y figure pas : il
 * se dérive de la compétence cible, et le stocker ouvrirait la possibilité
 * qu'il contredise ce qu'elle dit.
 */
interface BrouillonExercice {
  titre: string;
  type: TypeExercice;
  difficulte: Difficulte;
  competences: string[];
  dureeEstimeeMin: number;
  enonce: string;
  indices: string[];
  correction: string;
  criteres: { dimension: Dimension; libelle: string }[];
  origine: "manuel" | "tuteur";
  ignores: string[];
}

/** Formulaire vierge — l'état de départ, et celui vers lequel on abandonne. */
const BROUILLON_VIDE: BrouillonExercice = {
  titre: "",
  type: "probleme",
  difficulte: 2,
  competences: [],
  dureeEstimeeMin: 20,
  enonce: "",
  indices: [""],
  correction: "",
  criteres: [{ dimension: "comprehension", libelle: "" }],
  origine: "manuel",
  ignores: [],
};

export interface ProprietesFormulaireExercice {
  skillsDisponibles: { code: string; intitule: string; domaine: string }[];
  /** Compte courant — isole le brouillon conservé (voir `stockage-session`). */
  compteId: string;
  /** Vrai quand on arrive du chat via `?proposition=1` (ADR-004). */
  propositionEnAttente?: boolean;
}

/**
 * Le formulaire ne se monte qu'une fois le navigateur disponible.
 *
 * Son brouillon vit dans `sessionStorage`, que le serveur ne peut pas lire.
 * Attendre l'hydratation permet de partir de l'état conservé dès le premier
 * rendu réel, plutôt que d'afficher un formulaire vide puis d'y réinjecter la
 * saisie dans un effet.
 */
export function FormulaireCreationExercice(proprietes: ProprietesFormulaireExercice) {
  const hydrate = useEstHydrate();
  if (!hydrate) return null;
  return <FormulaireHydrate {...proprietes} />;
}

function FormulaireHydrate({
  skillsDisponibles,
  propositionEnAttente = false,
  compteId,
}: ProprietesFormulaireExercice) {
  const router = useRouter();

  const cleBrouillon = cleParCompte("brouillon-exercice", compteId);
  const [depart] = useState<BrouillonExercice>(
    () => lireSession<BrouillonExercice>(cleBrouillon) ?? BROUILLON_VIDE,
  );

  const [titre, setTitre] = useState(depart.titre);
  const [type, setType] = useState<TypeExercice>(depart.type);
  const [difficulte, setDifficulte] = useState<Difficulte>(depart.difficulte);
  const [competences, setCompetences] = useState<string[]>(depart.competences);
  const [dureeEstimeeMin, setDuree] = useState(depart.dureeEstimeeMin);
  const [enonce, setEnonce] = useState(depart.enonce);
  const [indices, setIndices] = useState<string[]>(depart.indices);
  const [correction, setCorrection] = useState(depart.correction);
  const [criteres, setCriteres] = useState<{ dimension: Dimension; libelle: string }[]>(
    depart.criteres,
  );

  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  /**
   * Origine de l'énoncé, tracée jusqu'en base (ADR-004). Passe à « tuteur »
   * uniquement si le formulaire a effectivement été pré-rempli — un formulaire
   * repris à zéro reste « manuel ».
   */
  const [origine, setOrigine] = useState<"manuel" | "tuteur">(depart.origine);
  const [ignores, setIgnores] = useState<string[]>(depart.ignores);
  const [propositionPerdue, setPropositionPerdue] = useState(false);

  /**
   * Charge la proposition déposée par le chat dans `sessionStorage`.
   *
   * Déclenché par un clic, jamais au montage. Deux raisons : c'est un acte
   * volontaire de l'utilisateur, cohérent avec « le tuteur ne remplit rien
   * sans toi » (P5) ; et cela évite un rendu serveur qui divergerait de
   * l'hydratation, `sessionStorage` n'existant pas côté serveur.
   *
   * La proposition n'est PAS consommée ici. Elle l'était, et c'est ce qui
   * rendait le départ de la page définitif : plus de proposition à relire,
   * plus de brouillon, rien. Elle n'est effacée qu'à la création de l'exercice
   * ou sur un abandon explicite.
   */
  function chargerProposition() {
    const p = lireSession<PropositionExercice>(CLE_PROPOSITION_EXERCICE);
    if (!p) {
      setPropositionPerdue(true);
      return;
    }

    const ecartes: string[] = [];

    if (p.titre) setTitre(p.titre);
    if (p.enonce) setEnonce(p.enonce);
    if (p.correction) setCorrection(p.correction);

    // Le domaine proposé n'est jamais repris : il se dérive de la compétence
    // cible, plus bas. On le signale seulement s'il contredit ce qu'elle dit.
    const domainesDisponibles = new Set(skillsDisponibles.map((s) => s.domaine));
    if (p.domaine && !domainesDisponibles.has(p.domaine)) {
      ecartes.push(`domaine « ${p.domaine} », absent de ton périmètre`);
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

  /*
   * Enregistrement du brouillon à chaque frappe.
   *
   * Tant que le formulaire n'a rien reçu (`origine === "manuel"`), il n'y a rien
   * à conserver — et écrire un brouillon vide écraserait celui d'une visite
   * précédente avant même que la relecture ait eu lieu.
   */
  useEffect(() => {
    if (origine === "manuel") return;
    ecrireSession(cleBrouillon, {
      titre,
      type,
      difficulte,
      competences,
      dureeEstimeeMin,
      enonce,
      indices,
      correction,
      criteres,
      origine,
      ignores,
    } satisfies BrouillonExercice);
  }, [
    cleBrouillon,
    titre,
    type,
    difficulte,
    competences,
    dureeEstimeeMin,
    enonce,
    indices,
    correction,
    criteres,
    origine,
    ignores,
  ]);

  /** Efface brouillon et proposition d'un même geste : ils vont par paire. */
  function abandonnerBrouillon() {
    effacerSession(cleBrouillon);
    effacerSession(CLE_PROPOSITION_EXERCICE);
    setTitre(BROUILLON_VIDE.titre);
    setType(BROUILLON_VIDE.type);
    setDifficulte(BROUILLON_VIDE.difficulte);
    setCompetences(BROUILLON_VIDE.competences);
    setDuree(BROUILLON_VIDE.dureeEstimeeMin);
    setEnonce(BROUILLON_VIDE.enonce);
    setIndices(BROUILLON_VIDE.indices);
    setCorrection(BROUILLON_VIDE.correction);
    setCriteres(BROUILLON_VIDE.criteres);
    setIgnores(BROUILLON_VIDE.ignores);
    setPropositionPerdue(false);
    // En dernier : c'est lui qui referme les champs et coupe l'enregistrement
    // du brouillon ci-dessus.
    setOrigine(BROUILLON_VIDE.origine);
  }

  // La première compétence est la cible principale (convention `Exercise`) :
  // c'est elle qui donne son domaine à l'exercice.
  const domaineCible =
    skillsDisponibles.find((s) => s.code === competences[0])?.domaine ?? null;

  // Le fond du contrat est partagé avec le chat, qui n'offre son bouton que sur
  // une proposition entière : « complet » doit vouloir dire la même chose des
  // deux côtés. S'y ajoute ici la seule condition que le chat ne peut pas
  // évaluer — le domaine, dérivé de la compétence cible contre le référentiel.
  const pret =
    exerciceComplet({ titre, enonce, correction, competences, criteres }) &&
    domaineCible !== null;

  function soumettre() {
    setErreur(null);
    demarrer(async () => {
      try {
        const id = await creerExercice({
          titre,
          domaine: domaineCible ?? "",
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
        // L'exercice existe : le brouillon et la proposition n'ont plus d'objet.
        effacerSession(cleBrouillon);
        effacerSession(CLE_PROPOSITION_EXERCICE);
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
                ? "La proposition n'est plus disponible — l'onglet a été rouvert, ou le brouillon a été abandonné. Retourne au tuteur et clique à nouveau sur « Revoir et ajouter »."
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
          <p className="mt-1.5 text-texte-discret">
            Ce que tu saisis ici est conservé jusqu&apos;à la création de
            l&apos;exercice : tu peux quitter cette page et y revenir.
          </p>
          <button
            type="button"
            onClick={abandonnerBrouillon}
            className={cx(classesBouton("secondaire", "petite"), "mt-2")}
          >
            Abandonner ce brouillon
          </button>
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
