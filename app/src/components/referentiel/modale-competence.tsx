"use client";

/**
 * Modale de création d'une branche de compétences — créer là où on est.
 *
 * Ouverte depuis `+ Compétence` sur une carte de domaine ou `+ Domaine` en
 * tête de `/competences`. Saisie directe : intitulé, palier, importance.
 * **Aucun champ `code`** — il est attribué à l'enregistrement par
 * `attribuerCodes`, et la modale le dit.
 *
 * « Suggérer avec le tuteur » : même mécanique qu'en §1.1, remplit les lignes
 * de la modale, chacune décochable et modifiable.
 *
 * Écrit par `creerBranche` avec `origine: "manuel"` ou `"tuteur"` — l'action
 * accepte déjà le paramètre et se rattache **par nom** à un domaine existant.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bouton } from "@/components/ui/primitives";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import type { PropositionReferentiel } from "@/lib/tutor/proposition";
import { ValidationBranche, type BrancheInitiale } from "./validation-branche";

export function ModaleCompetence({
  onFermer,
  domainesExistants,
  compteId,
  domaineInitial,
  brancheInitiale,
}: {
  onFermer: () => void;
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  compteId: string;
  /** Domaine pré-rempli — quand on ouvre depuis une carte de domaine. */
  domaineInitial?: string;
  /** Branche pré-remplie — quand on ouvre depuis une proposition du tuteur. */
  brancheInitiale?: BrancheInitiale;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"formulaire" | "suggestion">("formulaire");
  const [sujet, setSujet] = useState("");
  const [progression, setProgression] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [initiale, setInitiale] = useState<BrancheInitiale | undefined>(
    brancheInitiale ??
      (domaineInitial
        ? { domaine: domaineInitial, prefixe: "", description: "", justification: "", competences: [] }
        : undefined),
  );
  const abandonRef = useRef<AbortController | null>(null);

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
            setPhase("formulaire");
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Ajouter des compétences"
      onClick={onFermer}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl border border-bordure bg-surface p-5 text-texte shadow-[var(--ombre-surcouche)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-bordure pb-3">
          <div>
            <h2 className="font-serif text-base font-medium">Ajouter des compétences</h2>
            <p className="mt-0.5 text-xs text-texte-discret">
              Le tuteur suggère, tu relis et tu valides. Les codes seront attribués à
              l{"'"}enregistrement.
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

        {phase === "suggestion" && (
          <div className="mt-8 flex flex-col items-center justify-center py-10 text-center">
            <span className="size-1.5 animate-pulse rounded-full bg-primaire" aria-hidden />
            <p className="mt-3 text-sm text-texte-attenue">
              {progression ?? "Le tuteur prend connaissance de ce qui a été mesuré…"}
            </p>
            <Bouton
              onClick={() => {
                abandonRef.current?.abort();
                setPhase("formulaire");
              }}
              variante="secondaire"
              taille="petite"
              className="mt-4"
            >
              Arrêter
            </Bouton>
          </div>
        )}

        {phase === "formulaire" && (
          <div className="mt-4 space-y-4">
            {!initiale && (
              <div>
                <label
                  htmlFor="modale-sujet"
                  className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret"
                >
                  Suggérer avec le tuteur
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="modale-sujet"
                    value={sujet}
                    onChange={(e) => setSujet(e.target.value)}
                    placeholder="Un sujet, un thème, un domaine…"
                    className="w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none"
                  />
                  <Bouton
                    onClick={() => void suggerer()}
                    disabled={sujet.trim().length === 0}
                    variante="secondaire"
                  >
                    Suggérer
                  </Bouton>
                </div>
                <p className="mt-1 text-[0.6875rem] text-texte-discret">
                  Le tuteur remplit les lignes ci-dessous — chacune reste décochable et
                  modifiable.
                </p>
              </div>
            )}

            {erreur && (
              <p className="rounded-md border border-danger/30 bg-danger-faible px-3 py-2 text-xs text-danger">
                {erreur}
              </p>
            )}

            <ValidationBranche
              domainesExistants={domainesExistants}
              initiale={initiale}
              origine={initiale ? "tuteur" : "manuel"}
              surEnregistre={() => {
                onFermer();
                router.refresh();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}