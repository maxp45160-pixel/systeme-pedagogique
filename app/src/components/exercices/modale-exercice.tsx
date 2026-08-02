"use client";

/**
 * Modale de génération d'exercice — créer là où on est.
 *
 * Un composant, trois points de montage : `/` (carte Prochaine action),
 * `/exercices` (en-tête), `/competences/[code]`.
 *
 * La compétence est pré-remplie par `recommander()`, changeable. La difficulté
 * et l'angle sont dérivés par `calibrer()` et **affichés avec leur source**,
 * jamais saisis (ADR-028). Le thème est un indice de rédaction, pas un
 * sélecteur d'objet.
 *
 * Génération → prévisualisation dans la modale → « Enregistrer » → la liste se
 * met à jour sans rechargement. Fermer la modale abandonne la génération
 * (`request.signal`, câblé côté route).
 *
 * ⚠️ Piège du thème libre. `creerExercice` refuse une compétence hors
 * périmètre. Un thème sans correspondance ne peut rien produire : l'écran le
 * dit et propose d'ajouter la compétence. Il ne fabrique pas.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { classesBouton, cx, Etiquette } from "@/components/ui/primitives";
import { creerExercice } from "@/lib/store/actions";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import type { PropositionExercice } from "@/lib/tutor/proposition";
import { DIFFICULTES, LIBELLES_DIMENSIONS, type Difficulte, type Dimension, type TypeExercice } from "@/lib/domain/types";

export interface CompetenceModale {
  code: string;
  intitule: string;
  domaine: string;
}

export interface CalibrageModale {
  difficulteConseillee: Difficulte | null;
  dimensionFaible: { dimension: Dimension; moyenne: number; observations: number } | null;
  reserves: string[];
}

export function ModaleExercice({
  ouvert,
  onFermer,
  competences,
  competenceInitiale,
  calibrage,
  compteId,
  surEnregistre,
}: {
  ouvert: boolean;
  onFermer: () => void;
  competences: CompetenceModale[];
  competenceInitiale: string;
  calibrage: CalibrageModale | null;
  compteId: string;
  /** Appelé après l'enregistrement d'un exercice — pour rafraîchir la liste. */
  surEnregistre?: (id: string) => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState(competenceInitiale);
  const [theme, setTheme] = useState("");
  const [phase, setPhase] = useState<"formulaire" | "generation" | "previsualisation">("formulaire");
  const [propositions, setPropositions] = useState<PropositionExercice[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const abandonRef = useRef<AbortController | null>(null);

  // Abandon de la génération à la fermeture.
  useEffect(() => {
    if (!ouvert) abandonRef.current?.abort();
  }, [ouvert]);

  const competence = competences.find((c) => c.code === code);
  const cal = calibrage;

  const generer = useCallback(async () => {
    if (!competence) return;
    setPhase("generation");
    setMessage(null);
    setErreur(null);
    setPropositions([]);

    const abandon = new AbortController();
    abandonRef.current = abandon;

    try {
      const reponse = await fetch("/api/exercices/generer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          competences: [competence.code],
          theme: theme.trim() || undefined,
          config: lireConfigTuteur(compteId) ?? undefined,
        }),
        signal: abandon.signal,
      });

      if (!reponse.ok || !reponse.body) {
        const donnees = await reponse.json().catch(() => null);
        setErreur(
          donnees?.message ??
            "La génération n'a pas pu démarrer. Vérifie la configuration du tuteur dans les réglages.",
        );
        setPhase("formulaire");
        return;
      }

      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = "";

      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });

        const evenements = tampon.split("\n\n");
        tampon = evenements.pop() ?? "";

        for (const bloc of evenements) {
          const lignes = bloc.split("\n");
          const type = lignes.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message";
          const donnees = lignes.find((l) => l.startsWith("data:"))?.slice(5).trim();

          if (type === "propositions" && donnees) {
            const parsed = JSON.parse(donnees) as { exercices: PropositionExercice[] };
            setPropositions(parsed.exercices);
            setPhase("previsualisation");
          } else if (type === "erreur" && donnees) {
            const parsed = JSON.parse(donnees) as { message: string };
            setErreur(parsed.message);
            setPhase("formulaire");
          } else if (type === "proposition-en-cours") {
            setMessage("Le tuteur rédige un exercice…");
          }
        }
      }
    } catch {
      if (!abandon.signal.aborted) {
        setErreur("Génération interrompue.");
        setPhase("formulaire");
      }
    }
  }, [competence, theme, compteId]);

  const enregistrer = useCallback(
    async (p: PropositionExercice) => {
      if (!competence) return;
      setErreur(null);
      try {
        const id = await creerExercice({
          titre: p.titre,
          domaine: competence.domaine,
          type: p.type as TypeExercice,
          difficulte: (Number(p.difficulte) || 2) as Difficulte,
          competences: p.competences,
          dureeEstimeeMin: Number(p.dureeEstimeeMin) || 30,
          enonce: p.enonce,
          indices: p.indices,
          correction: p.correction,
          criteres: p.criteres as { dimension: Dimension; libelle: string }[],
          origine: "tuteur",
        });
        setEnregistre(true);
        surEnregistre?.(id);
        router.refresh();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Échec de l'enregistrement.");
      }
    },
    [competence, router, surEnregistre],
  );

  if (!ouvert) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Générer un exercice"
      onClick={onFermer}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl border border-bordure bg-surface p-5 text-texte shadow-[var(--ombre-surcouche)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-bordure pb-3">
          <div>
            <h2 className="font-serif text-base font-medium">Générer un exercice</h2>
            <p className="mt-0.5 text-xs text-texte-discret">
              Le tuteur rédige, tu relis et tu valides. Rien nest écrit avant.
            </p>
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-md px-2 py-1 text-sm text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte"
          >
            ✕
          </button>
        </div>

        {phase === "formulaire" && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                Compétence ciblée
              </label>
              <select
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm focus:border-primaire focus:outline-none"
              >
                {competences.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.intitule}
                  </option>
                ))}
              </select>
            </div>

            {cal && (
              <div className="rounded-md border border-bordure bg-surface-2 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    Difficulté {cal.difficulteConseillee ?? "—"}/5
                  </span>
                  {cal.difficulteConseillee && (
                    <span className="text-texte-attenue">
                      {DIFFICULTES[cal.difficulteConseillee]}
                    </span>
                  )}
                  <button
                    type="button"
                    className="text-primaire hover:underline"
                    onClick={() => setMessage(cal.reserves.join(" ") || "Aucune réserve.")}
                  >
                    ▸ Pourquoi ?
                  </button>
                </div>
                {cal.dimensionFaible && (
                  <p className="mt-1 text-texte-attenue">
                    Angle à travailler :{" "}
                    <span className="font-medium">
                      {LIBELLES_DIMENSIONS[cal.dimensionFaible.dimension]}
                    </span>{" "}
                    ({cal.dimensionFaible.moyenne} sur {cal.dimensionFaible.observations}{" "}
                    tentative{cal.dimensionFaible.observations > 1 ? "s" : ""})
                  </p>
                )}
                {cal.difficulteConseillee === null && (
                  <p className="mt-1 text-texte-discret">
                    Aucune tentative exploitable — difficulté déduite du niveau.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                Sur… (facultatif)
              </label>
              <input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Un thème, un contexte, une situation…"
                className="mt-1 w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none"
              />
              <p className="mt-1 text-[0.6875rem] text-texte-discret">
                Un indice de rédaction, pas un sélecteur dobjet.
              </p>
            </div>

            {message && (
              <p className="rounded-md border border-info/30 bg-info-faible px-3 py-2 text-xs text-texte-attenue">
                {message}
              </p>
            )}
            {erreur && (
              <p className="rounded-md border border-danger/30 bg-danger-faible px-3 py-2 text-xs text-danger">
                {erreur}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-bordure pt-3">
              <button type="button" onClick={onFermer} className={classesBouton("secondaire")}>
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void generer()}
                disabled={!competence}
                className={classesBouton("principal")}
              >
                Générer
              </button>
            </div>
          </div>
        )}

        {phase === "generation" && (
          <div className="mt-8 flex flex-col items-center justify-center py-10 text-center">
            <span className="size-1.5 animate-pulse rounded-full bg-primaire" aria-hidden />
            <p className="mt-3 text-sm text-texte-attenue">
              {message ?? "Le tuteur rédige un exercice — énoncé, indices, correction, critères…"}
            </p>
            <button
              type="button"
              onClick={() => abandonRef.current?.abort()}
              className={cx(classesBouton("secondaire", "petite"), "mt-4")}
            >
              Arrêter
            </button>
          </div>
        )}

        {phase === "previsualisation" && (
          <div className="mt-4 space-y-4">
            {enregistre && (
              <p className="rounded-md border border-succes/30 bg-succes-faible px-3 py-2 text-xs text-succes">
                Exercice enregistré dans ta bibliothèque.
              </p>
            )}
            {propositions.length === 0 ? (
              <p className="rounded-md border border-alerte/30 bg-alerte-faible px-3 py-2 text-xs text-alerte">
                Aucun exercice exploitable na été produit. Réessaie, ou change de thème.
              </p>
            ) : (
              propositions.map((p, i) => (
                <div key={i} className="rounded-md border border-bordure bg-surface-2 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Etiquette ton="primaire">Proposition {i + 1}</Etiquette>
                    {p.competences.map((c) => (
                      <Etiquette key={c} mono>
                        {c}
                      </Etiquette>
                    ))}
                    {p.difficulte && (
                      <span className="text-[0.6875rem] text-texte-attenue">
                        difficulté {p.difficulte}/5
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium">{p.titre}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-texte-attenue">{p.enonce}</p>
                  {p.indices.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                        Indices
                      </p>
                      <ul className="mt-1 space-y-0.5 text-xs text-texte-attenue">
                        {p.indices.map((ind, j) => (
                          <li key={j}>· {ind}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {p.correction && (
                    <div className="mt-2">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                        Correction
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-texte-attenue">
                        {p.correction}
                      </p>
                    </div>
                  )}
                  {p.criteres.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                        Critères
                      </p>
                      <ul className="mt-1 space-y-0.5 text-xs text-texte-attenue">
                        {p.criteres.map((c, j) => (
                          <li key={j}>
                            · {LIBELLES_DIMENSIONS[c.dimension as Dimension] ?? c.dimension} —{" "}
                            {c.libelle}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!enregistre && (
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPhase("formulaire");
                          setPropositions([]);
                        }}
                        className={classesBouton("secondaire", "petite")}
                      >
                        Rejeter
                      </button>
                      <button
                        type="button"
                        onClick={() => void enregistrer(p)}
                        className={classesBouton("principal", "petite")}
                      >
                        Enregistrer
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            {erreur && (
              <p className="rounded-md border border-danger/30 bg-danger-faible px-3 py-2 text-xs text-danger">
                {erreur}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-bordure pt-3">
              <button type="button" onClick={onFermer} className={classesBouton("secondaire")}>
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}