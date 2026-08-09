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
import { BandeauInfo, Bouton, PointActif } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
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
  /*
   * Deux choses distinctes, longtemps portées par le même drapeau (audit §2.13).
   *
   * `initiale` répond à « le formulaire est-il pré-rempli ? ». Ouvrir la modale
   * depuis la carte d'un domaine le pré-remplit avec ce seul domaine et
   * `competences: []` — rien ne vient du tuteur. Or `origine` en était déduit :
   * tout ce qu'on tapait à la main depuis un domaine, y compris via le lien
   * « Ajouter une compétence à la main », était enregistré comme généré par le
   * tuteur. C'est le champ de provenance qu'ADR-004 a créé.
   *
   * Et le même drapeau masquait « Suggérer avec le tuteur », qui n'apparaissait
   * donc JAMAIS sur ce chemin.
   */
  const [venuDuTuteur, setVenuDuTuteur] = useState(brancheInitiale !== undefined);
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
            // C'est ICI, et seulement ici, que le contenu vient du tuteur.
            setVenuDuTuteur(true);
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
    <Modale
      titre="Ajouter des compétences"
      sousTitre="Le tuteur suggère, tu relis et tu valides. Les codes seront attribués à l'enregistrement."
      onFermer={onFermer}
    >
      <>
        {phase === "suggestion" && (
          <div className="mt-8 flex flex-col items-center justify-center py-10 text-center">
            <PointActif />
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
            {!venuDuTuteur && (
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
                    className="w-full rounded-md border border-bordure-controle bg-surface px-2 py-1.5 text-sm placeholder:text-texte-discret"
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
              <BandeauInfo ton="danger" taille="compacte">
                <p className="text-danger">{erreur}</p>
              </BandeauInfo>
            )}

            <ValidationBranche
              domainesExistants={domainesExistants}
              initiale={initiale}
              origine={venuDuTuteur ? "tuteur" : "manuel"}
              surEnregistre={() => {
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