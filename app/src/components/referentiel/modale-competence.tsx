"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BandeauInfo, Bouton } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import type { PropositionReferentiel } from "@/lib/tutor/proposition";
import { ValidationBranche, type BrancheInitiale } from "./validation-branche";
import { ChargementGeneration } from "@/components/ui/chargement-generation";

export function ModaleCompetence({
  onFermer,
  domainesExistants,
  compteId,
  domaineInitial,
  brancheInitiale,
  sujetInitial = "",
  descriptionInitiale = "",
  justificationInitiale = "",
  suggestionAutomatique = false,
  surEnregistre,
}: {
  onFermer: () => void;
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  compteId: string;
  /** Domaine pré-rempli — quand on ouvre depuis une carte de domaine. */
  domaineInitial?: string;
  /** Branche pré-remplie — quand on ouvre depuis une proposition du tuteur. */
  brancheInitiale?: BrancheInitiale;
  /** Sujet déjà déclaré avant l'ouverture de la modale (sans valoir proposition). */
  sujetInitial?: string;
  /** Contexte libre conservé dans le formulaire, toujours modifiable. */
  descriptionInitiale?: string;
  /** Explication d'un refus du tuteur, informative et non mesurante. */
  justificationInitiale?: string;
  /** Lance immédiatement la suggestion, pour l'amorçage d'un compte neuf. */
  suggestionAutomatique?: boolean;
  /** Permet à l'appelant de reprendre son flux après la création. */
  surEnregistre?: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"formulaire" | "suggestion">("formulaire");
  const [sujet, setSujet] = useState(sujetInitial || domaineInitial || "");
  const [progression, setProgression] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modeSuggestionOuvert, setModeSuggestionOuvert] = useState(false);

  const [initiale, setInitiale] = useState<BrancheInitiale | undefined>(
    brancheInitiale ??
      (domaineInitial
        ? { domaine: domaineInitial, prefixe: "", description: "", justification: "", competences: [] }
        : descriptionInitiale || justificationInitiale
          ? {
              domaine: "",
              prefixe: "",
              description: descriptionInitiale,
              justification: justificationInitiale,
              competences: [],
            }
          : undefined),
  );

  const [venuDuTuteur, setVenuDuTuteur] = useState(brancheInitiale !== undefined);
  const abandonRef = useRef<AbortController | null>(null);
  const suggestionLanceeRef = useRef(false);

  useEffect(() => {
    const controleur = abandonRef;
    return () => controleur.current?.abort();
  }, []);

  const suggerer = useCallback(async () => {
    if (sujet.trim().length === 0) return;
    setPhase("suggestion");
    setProgression(null);
    setErreur(null);

    const abandon = new AbortController();
    abandonRef.current = abandon;

    try {
      const reponse = await fetch("/api/referentiel/suggerer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sujet: sujet.trim(),
          config: lireConfigTuteur(compteId) ?? undefined,
        }),
        signal: abandon.signal,
      });

      if (!reponse.ok || !reponse.body) {
        const donnees = await reponse.json().catch(() => null);
        setErreur(
          donnees?.message ??
            "La suggestion n'a pas pu démarrer. Vérifie la configuration du tuteur dans les réglages.",
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

          if (type === "proposition" && donnees) {
            const parsed = JSON.parse(donnees) as { branche: PropositionReferentiel };
            setInitiale({
              domaine: parsed.branche.domaine,
              prefixe: parsed.branche.prefixe,
              description: parsed.branche.description,
              justification: parsed.branche.justification,
              competences: parsed.branche.competences,
            });
            setVenuDuTuteur(true);
            setPhase("formulaire");
            setModeSuggestionOuvert(false);
          } else if (type === "erreur" && donnees) {
            const parsed = JSON.parse(donnees) as { message: string };
            setErreur(parsed.message);
            setPhase("formulaire");
          } else if (type === "proposition-en-cours") {
            setProgression("Le tuteur compose une branche de compétences…");
          }
        }
      }
    } catch {
      if (!abandon.signal.aborted) {
        setErreur("Suggestion interrompue.");
        setPhase("formulaire");
      }
    }
  }, [sujet, compteId]);

  useEffect(() => {
    if (!suggestionAutomatique || suggestionLanceeRef.current || sujet.trim().length === 0) return;
    suggestionLanceeRef.current = true;
    void suggerer();
  }, [suggestionAutomatique, sujet, suggerer]);

  const estDomaineExistant = Boolean(domaineInitial);
  const titreModale = estDomaineExistant ? "Ajouter une compétence" : "Nouveau domaine d’apprentissage";
  const sousTitreModale = estDomaineExistant
    ? `Ajoute une compétence observable et mesurable au domaine.`
    : "Définis une nouvelle branche du référentiel et ses compétences.";

  return (
    <Modale
      titre={titreModale}
      sousTitre={sousTitreModale}
      largeur="xl"
      onFermer={onFermer}
    >
      <>
        {phase === "suggestion" && (
          <div className="py-8">
            <ChargementGeneration
              progressionServeur={progression}
              etapes={[
                "Analyse du domaine et de l'axe d'apprentissage…",
                "Formulation des compétences associées…",
                "Définition des critères d'évaluation…",
                "Finalisation de la branche…",
              ]}
              dureeAsymptoteSec={7}
              onArreter={() => {
                abandonRef.current?.abort();
                setPhase("formulaire");
              }}
            />
          </div>
        )}

        {phase === "formulaire" && (
          <div className="space-y-4">
            {/* Volet suggestion du tuteur (repliable et épuré) */}
            {!venuDuTuteur && (
              <div className="rounded-xl border border-bordure bg-surface-2/40 p-3.5">
                {!modeSuggestionOuvert ? (
                  <button
                    type="button"
                    onClick={() => setModeSuggestionOuvert(true)}
                    className="flex w-full items-center justify-between text-left text-xs text-texte-attenue hover:text-primaire cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <span>Suggérer des compétences avec le tuteur IA</span>
                    </span>
                    <span className="text-texte-discret">Déplier →</span>
                  </button>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="modale-sujet"
                        className="text-xs font-semibold text-texte"
                      >
                        Sujet ou intention pour le tuteur
                      </label>
                      <button
                        type="button"
                        onClick={() => setModeSuggestionOuvert(false)}
                        className="text-[0.6875rem] text-texte-discret hover:text-texte cursor-pointer"
                      >
                        Fermer
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        id="modale-sujet"
                        value={sujet}
                        onChange={(e) => setSujet(e.target.value)}
                        placeholder="Ex : Récursivité avancée, Raisonnement stoïcien..."
                        className="w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-xs text-texte placeholder:text-texte-discret focus:border-primaire outline-none"
                      />
                      <Bouton
                        onClick={() => void suggerer()}
                        disabled={sujet.trim().length === 0}
                        variante="secondaire"
                        taille="petite"
                        className="shrink-0"
                      >
                        Générer
                      </Bouton>
                    </div>
                  </div>
                )}
              </div>
            )}

            {erreur && (
              <BandeauInfo ton="danger" taille="compacte">
                <p className="text-danger">{erreur}</p>
              </BandeauInfo>
            )}

            <ValidationBranche
              domainesExistants={domainesExistants}
              initiale={initiale}
              domaineFixe={estDomaineExistant}
              origine={venuDuTuteur ? "tuteur" : "manuel"}
              onFermer={onFermer}
              surEnregistre={() => {
                surEnregistre?.();
                onFermer();
                router.refresh();
              }}
            />
          </div>
        )}
      </>
    </Modale>
  );
}
