"use client";

import { useState, useTransition } from "react";
import type { Autonomie, Dimension, SkillEvidence } from "@/lib/domain/types";
import { AUTONOMIE, LIBELLES_DIMENSIONS } from "@/lib/domain/types";
import { enregistrerPreuveManuelle } from "@/lib/store/actions";
import { classesBouton, cx } from "@/components/ui/primitives";

/**
 * Enregistrement d'une preuve qui ne passe pas par un exercice du store :
 * script fait seul, exercice papier, synthèse d'un échange avec le tuteur.
 *
 * Différence clé avec `formulaire-bilan.tsx` : l'autonomie est ici DÉCLARÉE
 * par l'utilisateur (pas d'ancrage « nombre d'indices » à déduire). La mention
 * « déclarée, pas déduite » reste visible, et le commentaire stocké la préfixe.
 */

const RESULTATS = [
  { valeur: "reussi", libelle: "Réussi", aide: "Méthode et résultat corrects" },
  { valeur: "partiel", libelle: "Partiellement", aide: "En partie seulement" },
  { valeur: "echec", libelle: "Non abouti", aide: "Je n'ai pas su faire" },
] as const;

const TYPES: { valeur: SkillEvidence["type"]; libelle: string }[] = [
  { valeur: "exercice", libelle: "Exercice" },
  { valeur: "calcul", libelle: "Calcul" },
  { valeur: "code", libelle: "Code / script" },
  { valeur: "explication", libelle: "Explication" },
  { valeur: "etude-de-cas", libelle: "Étude de cas" },
  { valeur: "transfert", libelle: "Transfert" },
  { valeur: "correction-erreur", libelle: "Correction d'une erreur" },
  { valeur: "projet", libelle: "Projet" },
];

const AUTONOMIES: Autonomie[] = ["A0", "A1", "A2", "A3", "A4"];
const DIMENSIONS: Dimension[] = [
  "comprehension",
  "application",
  "transfert",
  "integration",
  "justification",
];

/** Non observée (undefined) par défaut — on ne force jamais une valeur. */
const APPRECIATIONS = [
  { label: "Non observée", valeur: undefined },
  { label: "Non", valeur: 0 },
  { label: "En partie", valeur: 0.5 },
  { label: "Oui", valeur: 1 },
] as const;

export interface ValeursInitialesPreuve {
  contexte?: string;
  commentaire?: string;
  niveauPreuve?: "A" | "B";
  type?: SkillEvidence["type"];
}

export function FormulairePreuveManuelle({
  skillCode,
  skillsDisponibles,
  valeursInitiales,
}: {
  skillCode: string;
  skillsDisponibles: { code: string; intitule: string }[];
  valeursInitiales?: ValeursInitialesPreuve;
}) {
  const [resultat, setResultat] = useState<"reussi" | "partiel" | "echec">("reussi");
  const [type, setType] = useState<SkillEvidence["type"]>(valeursInitiales?.type ?? "exercice");
  // Plus un choix : une preuve saisie ici porte sur un travail que l'utilisateur
  // a fait lui-même, donc directe (A). Seule une proposition venue du tuteur
  // arrive en B, et ce n'est pas à l'utilisateur de la requalifier.
  const [niveauPreuve] = useState<"A" | "B">(valeursInitiales?.niveauPreuve ?? "A");
  const [autonomie, setAutonomie] = useState<Autonomie>("A3");
  const [dims, setDims] = useState<Partial<Record<Dimension, number>>>({});
  const [contexte, setContexte] = useState(valeursInitiales?.contexte ?? "");
  const [combinees, setCombinees] = useState<string[]>([]);
  const [sourceRef, setSourceRef] = useState("");
  const [commentaire, setCommentaire] = useState(valeursInitiales?.commentaire ?? "");

  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  const pret = contexte.trim().length > 0 && sourceRef.trim().length > 0;
  const autres = skillsDisponibles.filter((s) => s.code !== skillCode);

  function soumettre() {
    setErreur(null);
    demarrer(async () => {
      try {
        await enregistrerPreuveManuelle({
          skillCode,
          type,
          niveauPreuve,
          autonomie,
          resultat,
          contexte,
          dimensions: dims,
          competencesCombinees: combinees.length ? combinees : undefined,
          sourceRef,
          commentaire: commentaire.trim() || undefined,
        });
        // Le niveau est recalculé côté serveur ; la fiche se rafraîchit via
        // revalidatePath. On réinitialise et on confirme.
        setSucces(true);
        setContexte("");
        setSourceRef("");
        setCommentaire("");
        setDims({});
        setCombinees([]);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  const dimsRenseignees = Object.keys(dims).length;

  return (
    <div className="space-y-5">
      {/* Résultat */}
      <div>
        <div className="mb-2 text-xs font-medium">Résultat</div>
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
              <div className={cx("text-xs font-medium", resultat === r.valeur && "text-primaire")}>
                {r.libelle}
              </div>
              <div className="mt-0.5 text-[0.625rem] text-texte-discret">{r.aide}</div>
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-xs font-medium">Type de preuve</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as SkillEvidence["type"])}
          className="mt-1 w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm focus:border-primaire focus:outline-none"
        >
          {TYPES.map((t) => (
            <option key={t.valeur} value={t.valeur}>
              {t.libelle}
            </option>
          ))}
        </select>
      </label>

      {/* Autonomie déclarée */}
      <div>
        <label className="block">
          <span className="text-xs font-medium">Autonomie</span>
          <select
            value={autonomie}
            onChange={(e) => setAutonomie(e.target.value as Autonomie)}
            className="mt-1 w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm focus:border-primaire focus:outline-none"
          >
            {AUTONOMIES.map((a) => (
              <option key={a} value={a}>
                {a} — {AUTONOMIE[a].libelle}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-1 text-[0.625rem] text-texte-discret">
          Déclarée, pas déduite — contrairement au flux exercice où elle vient du nombre d&apos;indices.
          Le commentaire enregistré le signalera.
        </p>
      </div>

      {/* Dimensions */}
      <div>
        <div className="mb-2 text-xs font-medium">
          Dimensions observées
          <span className="ml-1.5 font-normal text-texte-discret">
            — laisse « Non observée » si tu ne l&apos;as pas réellement vue
          </span>
        </div>
        <ul className="space-y-2">
          {DIMENSIONS.map((d) => (
            <li
              key={d}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-bordure bg-surface-2 px-3 py-2"
            >
              <span className="text-xs">{LIBELLES_DIMENSIONS[d]}</span>
              <div className="flex shrink-0 flex-wrap gap-1">
                {APPRECIATIONS.map((a) => {
                  const actif = dims[d] === a.valeur || (a.valeur === undefined && dims[d] === undefined);
                  return (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() =>
                        setDims((p) => {
                          const copie = { ...p };
                          if (a.valeur === undefined) delete copie[d];
                          else copie[d] = a.valeur;
                          return copie;
                        })
                      }
                      className={cx(
                        "rounded border px-2 py-1 text-[0.6875rem] font-medium transition-colors",
                        actif
                          ? "border-primaire/40 bg-primaire text-primaire-contraste"
                          : "border-bordure bg-surface text-texte-attenue hover:bg-surface-3",
                      )}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Contexte */}
      <label className="block">
        <span className="text-xs font-medium">Contexte (obligatoire)</span>
        <textarea
          value={contexte}
          onChange={(e) => setContexte(e.target.value)}
          rows={2}
          placeholder="Ce sur quoi portait le travail, en une phrase."
          className="mt-1 w-full resize-y rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none"
        />
      </label>

      {/* Compétences combinées */}
      {autres.length > 0 && (
        <div>
          <label className="block">
            <span className="text-xs font-medium">Compétences combinées (optionnel)</span>
            <select
              multiple
              value={combinees}
              onChange={(e) =>
                setCombinees([...e.target.selectedOptions].map((o) => o.value))
              }
              size={4}
              className="mt-1 w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-xs focus:border-primaire focus:outline-none"
            >
              {autres.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.intitule}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-[0.625rem] text-texte-discret">
            À renseigner seulement si cette preuve mobilisait vraiment plusieurs compétences ensemble
            (condition d&apos;une preuve intégrée, niveau 5). Ctrl/⌘ + clic pour en choisir plusieurs.
          </p>
        </div>
      )}

      {/* Source */}
      <label className="block">
        <span className="text-xs font-medium">Source (obligatoire)</span>
        <input
          type="text"
          value={sourceRef}
          onChange={(e) => setSourceRef(e.target.value)}
          placeholder="Script Python exécuté le 26/07"
          className="mt-1 w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none"
        />
        <span className="mt-1 block text-[0.625rem] text-texte-discret">
          D&apos;où vient cette preuve, de façon vérifiable ? Aucune valeur n&apos;est enregistrée sans source.
        </span>
      </label>

      {/* Commentaire */}
      <label className="block">
        <span className="text-xs font-medium">Commentaire (optionnel)</span>
        <textarea
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          rows={2}
          placeholder="Ce qui a marché, ce qui a bloqué, ce qui reste à confirmer."
          className="mt-1 w-full resize-y rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none"
        />
      </label>

      {/* Récapitulatif */}
      <div className="rounded-md border border-bordure bg-surface-2 px-3 py-2.5 text-[0.6875rem] text-texte-attenue">
        <p className="font-medium text-texte">Ce qui sera enregistré</p>
        <ul className="mt-1 space-y-0.5">
          <li>
            · Une preuve <strong>{niveauPreuve === "A" ? "directe (A)" : "indirecte (B)"}</strong> pour{" "}
            <strong>{skillCode}</strong>, résultat {resultat}
          </li>
          <li>
            · Autonomie <strong>{autonomie}</strong> — déclarée, pas déduite (le commentaire le mentionnera)
          </li>
          <li>
            · {dimsRenseignees === 0
              ? "Aucune dimension chiffrée (aucune valeur inventée)"
              : `${dimsRenseignees} dimension(s) observée(s)`}
          </li>
          <li>· Une entrée de journal datée, et les XP correspondants s&apos;il y a lieu</li>
        </ul>
        <p className="mt-1.5">
          Le niveau n&apos;évoluera que si la preuve le justifie au regard du protocole. Une réussite
          isolée ne suffit pas à dépasser le niveau 2.
        </p>
      </div>

      {erreur && (
        <p className="rounded-md border border-danger/30 bg-danger-faible px-3 py-2 text-xs text-danger">
          {erreur}
        </p>
      )}
      {succes && (
        <p className="rounded-md border border-succes/30 bg-succes-faible px-3 py-2 text-xs text-succes">
          Preuve enregistrée. Le niveau et la confiance ont été recalculés à partir de tes preuves.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={soumettre}
          disabled={!pret || enCours}
          className={classesBouton("principal")}
        >
          {enCours ? "Enregistrement…" : "Enregistrer la preuve"}
        </button>
        {!pret && (
          <span className="text-xs text-texte-discret">
            Renseigne le contexte et la source pour continuer.
          </span>
        )}
      </div>
    </div>
  );
}
