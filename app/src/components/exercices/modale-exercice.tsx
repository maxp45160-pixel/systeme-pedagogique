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
 * ⚠️ Deux règles portées ici, et chacune a déjà coûté :
 *
 *  1. **Le calibrage suit le sélecteur.** Les calibrages arrivent indexés par
 *     code (`calibragesPourModale`) et sont relus à chaque changement de
 *     compétence. Une prop unique laissait afficher la difficulté d'une autre
 *     compétence que celle visée — P3 rompu.
 *  2. **Rien n'est fabriqué à l'enregistrement.** `convertirProposition`
 *     refuse une difficulté ou une durée illisibles au lieu d'y substituer un
 *     défaut (ADR-034, P2). La modale affiche alors ce qui cloche.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { classesBouton, cx, Etiquette } from "@/components/ui/primitives";
import { Markdown } from "@/components/ui/markdown";
import { creerExercice } from "@/lib/store/actions";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import { convertirProposition } from "@/lib/tutor/conversion-exercice";
import type { PropositionExercice } from "@/lib/tutor/proposition";
import { DIFFICULTES, LIBELLES_DIMENSIONS, type Dimension } from "@/lib/domain/types";
import type {
  CalibrageModale,
  CompetenceModale,
} from "./proprietes-generation";

export type { CalibrageModale, CompetenceModale };

export function ModaleExercice({
  onFermer,
  competences,
  competenceInitiale,
  calibrages,
  compteId,
  surEnregistre,
}: {
  onFermer: () => void;
  competences: CompetenceModale[];
  competenceInitiale: string;
  /** Calibrages de toutes les compétences actives, indexés par code. */
  calibrages: Record<string, CalibrageModale>;
  compteId: string;
  /** Appelé après l'enregistrement d'un exercice — pour rafraîchir la liste. */
  surEnregistre?: (id: string) => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState(competenceInitiale);
  const [theme, setTheme] = useState("");
  const [phase, setPhase] = useState<"formulaire" | "generation" | "previsualisation">(
    "formulaire",
  );
  const [propositions, setPropositions] = useState<PropositionExercice[]>([]);
  /** Index des propositions déjà enregistrées — pas un drapeau global. */
  const [enregistrees, setEnregistrees] = useState<Set<number>>(new Set());
  const [pourquoi, setPourquoi] = useState(false);
  const [progression, setProgression] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const abandonRef = useRef<AbortController | null>(null);

  /*
   * La modale est montée à l'ouverture et démontée à la fermeture
   * (`BoutonGenerer`), donc l'état repart neuf à chaque fois. Il reste à
   * abandonner la génération en cours au démontage : sans quoi le fournisseur
   * continue de rédiger, facturé, pour un texte que plus personne ne lit.
   */
  useEffect(() => {
    const controleur = abandonRef;
    return () => controleur.current?.abort();
  }, []);

  const competence = competences.find((c) => c.code === code);
  // Relu à chaque rendu : c'est ce qui fait suivre le calibrage au sélecteur.
  const cal = calibrages[code] ?? null;

  const generer = useCallback(async () => {
    if (!competence) return;
    setPhase("generation");
    setProgression(null);
    setErreur(null);
    setPropositions([]);
    setEnregistrees(new Set());

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
            setProgression("Le tuteur rédige l'exercice — énoncé, indices, correction, critères…");
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
    async (p: PropositionExercice, index: number) => {
      if (!competence) return;
      setErreur(null);

      /*
       * Conversion explicite AVANT l'écriture. Une difficulté ou une durée
       * illisible arrête l'enregistrement et se dit — elle n'est pas remplacée
       * par un défaut silencieux (ADR-034, P2). La durée en particulier est ce
       * dont `tentativeMenee` se sert pour juger qu'une tentative a eu lieu.
       */
      const conversion = convertirProposition(p);
      if (!conversion.ok) {
        setErreur(
          `Cette proposition n'est pas enregistrable — ${conversion.erreurs.join(" ")}`,
        );
        return;
      }

      try {
        const id = await creerExercice({
          ...conversion.valeur,
          domaine: competence.domaine,
          origine: "tuteur",
        });
        setEnregistrees((s) => new Set(s).add(index));
        surEnregistre?.(id);
        router.refresh();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Échec de l'enregistrement.");
      }
    },
    [competence, router, surEnregistre],
  );

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
              Le tuteur rédige, tu relis et tu valides. Rien n&apos;est écrit avant.
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
              <label
                htmlFor="modale-competence"
                className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret"
              >
                Compétence ciblée
              </label>
              <select
                id="modale-competence"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setPourquoi(false);
                }}
                className="mt-1 w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm focus:border-primaire focus:outline-none"
              >
                {competences.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.intitule}
                  </option>
                ))}
              </select>
            </div>

            {/*
              Le bloc de calibrage est indexé sur `code` : il suit le sélecteur.
              Sans calibrage du tout, on ne montre rien plutôt qu'un zéro (P2).
            */}
            {cal ? (
              <div className="rounded-md border border-bordure bg-surface-2 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {cal.difficulteConseillee
                      ? `Difficulté ${cal.difficulteConseillee}/5`
                      : "Difficulté non dérivable"}
                  </span>
                  {cal.difficulteConseillee && (
                    <span className="text-texte-attenue">
                      {DIFFICULTES[cal.difficulteConseillee]}
                    </span>
                  )}
                  <button
                    type="button"
                    className="text-primaire hover:underline"
                    aria-expanded={pourquoi}
                    onClick={() => setPourquoi((p) => !p)}
                  >
                    {pourquoi ? "▾ Pourquoi ?" : "▸ Pourquoi ?"}
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
                    Aucune tentative exploitable — la difficulté sera déduite du niveau.
                  </p>
                )}

                {pourquoi && (
                  <div className="mt-2 border-t border-bordure pt-2">
                    {cal.facteurs.length > 0 ? (
                      <ul className="space-y-0.5 text-texte-attenue">
                        {cal.facteurs.map((f, i) => (
                          <li key={i}>
                            · <span className="font-medium">{f.libelle}</span> — {f.valeur}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-texte-discret">
                        Aucune tentative terminée sur cette compétence.
                      </p>
                    )}
                    {cal.reserves.map((r, i) => (
                      <p key={i} className="mt-1 text-texte-discret">
                        {r}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-md border border-bordure bg-surface-2 px-3 py-2 text-xs text-texte-discret">
                Aucune mesure sur cette compétence — la difficulté sera déduite du niveau.
              </p>
            )}

            <div>
              <label
                htmlFor="modale-theme"
                className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret"
              >
                Sur… (facultatif)
              </label>
              <input
                id="modale-theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Un thème, un contexte, une situation…"
                className="mt-1 w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none"
              />
              <p className="mt-1 text-[0.6875rem] text-texte-discret">
                Un indice de rédaction, pas un sélecteur d&apos;objet.
              </p>
            </div>

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
              {progression ?? "Le tuteur prend connaissance de ce qui a été mesuré…"}
            </p>
            <button
              type="button"
              onClick={() => {
                abandonRef.current?.abort();
                setPhase("formulaire");
              }}
              className={cx(classesBouton("secondaire", "petite"), "mt-4")}
            >
              Arrêter
            </button>
          </div>
        )}

        {phase === "previsualisation" && (
          <div className="mt-4 space-y-4">
            {propositions.length === 0 ? (
              <p className="rounded-md border border-alerte/30 bg-alerte-faible px-3 py-2 text-xs text-alerte">
                Aucun exercice exploitable n&apos;a été produit. Réessaie, ou change de thème.
              </p>
            ) : (
              propositions.map((p, i) => (
                <div key={i} className="overflow-hidden rounded-md border border-bordure bg-surface-2">
                  {/* En-tête : titre + métadonnées */}
                  <div className="border-b border-bordure bg-surface px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Etiquette ton="primaire">Proposition {i + 1}</Etiquette>
                      {enregistrees.has(i) && <Etiquette ton="succes">Enregistrée</Etiquette>}
                    </div>
                    <h3 className="mt-1.5 text-sm font-semibold leading-snug">{p.titre}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
                      {p.dureeEstimeeMin && (
                        <span className="text-[0.6875rem] text-texte-attenue">
                          ≈ {p.dureeEstimeeMin} min
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Corps : énoncé en markdown, indices et correction repliés */}
                  <div className="px-3 py-2.5">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                      Énoncé
                    </p>
                    <div className="prose-exo mt-1 text-xs">
                      <Markdown contenu={p.enonce} />
                    </div>

                    {p.indices.length > 0 && (
                      <details className="mt-2.5">
                        <summary className="cursor-pointer text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret hover:text-texte">
                          Indices ({p.indices.length})
                        </summary>
                        <ul className="mt-1.5 space-y-1 text-xs text-texte-attenue">
                          {p.indices.map((ind, j) => (
                            <li key={j} className="flex items-start gap-1.5">
                              <span className="mt-0.5 text-texte-discret">{j + 1}.</span>
                              <span>{ind}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {p.correction && (
                      <details className="mt-2.5">
                        <summary className="cursor-pointer text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret hover:text-texte">
                          Correction
                        </summary>
                        <div className="prose-exo mt-1.5 text-xs">
                          <Markdown contenu={p.correction} />
                        </div>
                      </details>
                    )}

                    {p.criteres.length > 0 && (
                      <div className="mt-2.5">
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                          Critères d&apos;auto-évaluation
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs text-texte-attenue">
                          {p.criteres.map((c, j) => (
                            <li key={j} className="flex items-start gap-1.5">
                              <span
                                className={`mt-0.5 size-3 shrink-0 rounded-sm border ${
                                  enregistrees.has(i)
                                    ? "border-succes/40 bg-succes-faible"
                                    : "border-bordure"
                                }`}
                                aria-hidden
                              />
                              <span>
                                <span className="font-medium">
                                  {LIBELLES_DIMENSIONS[c.dimension as Dimension] ?? c.dimension}
                                </span>{" "}
                                — {c.libelle}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Pied : actions */}
                  {!enregistrees.has(i) && (
                    <div className="flex justify-end gap-2 border-t border-bordure bg-surface px-3 py-2">
                      {/* Ne retire que cette proposition — les autres restent. */}
                      <button
                        type="button"
                        onClick={() =>
                          setPropositions((liste) => liste.filter((_, j) => j !== i))
                        }
                        className={classesBouton("secondaire", "petite")}
                      >
                        Rejeter
                      </button>
                      <button
                        type="button"
                        onClick={() => void enregistrer(p, i)}
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
              <button
                type="button"
                onClick={() => setPhase("formulaire")}
                className={classesBouton("secondaire")}
              >
                Générer un autre
              </button>
              <button type="button" onClick={onFermer} className={classesBouton("principal")}>
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
