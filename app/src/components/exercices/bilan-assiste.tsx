"use client";

/**
 * Parcours de correction assistée d'une tentative.
 *
 * La correction est une proposition : elle ne produit jamais directement une
 * observation. Tant qu'aucune proposition recevable n'est arrivée, l'écran
 * offre uniquement une reprise explicite ou la clôture « sans mesure ».
 * L'ancien repli vers un formulaire vide était trompeur : il obligeait la
 * personne à fabriquer une auto-évaluation après une panne du tuteur.
 */

import { useEffect, useRef, useState } from "react";
import type { Exercise } from "@/lib/domain/types";
import {
  DELAI_INTERRUPTION_CORRECTION_MS,
  DELAI_SORTIE_CORRECTION_MS,
  reprendreCorrection,
  type CauseCorrectionIndisponible,
  type EtatCorrectionPersiste,
} from "@/lib/domain/correction-exercice";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import { convertirCorrection } from "@/lib/tutor/conversion-correction";
import type { PropositionCorrection } from "@/lib/tutor/outils";
import { BandeauInfo, Bouton, PointActif } from "@/components/ui/primitives";
import { BoutonAbandon } from "./abandon";
import type { ContexteNavigationExercice } from "@/lib/domain/navigation-exercice";
import {
  cleParCompte,
  effacerSession,
  ecrireSession,
  lireSession,
} from "@/lib/ui/stockage-session";
import type { PropositionBilan } from "./formulaire-bilan";
import { FormulaireBilan } from "./formulaire-bilan";

type Etat =
  | { phase: "correction" }
  | { phase: "prete"; proposition: PropositionBilan }
  | {
      phase: "indisponible";
      cause: CauseCorrectionIndisponible;
      raison: string;
    };

type CorrectionPersiste = EtatCorrectionPersiste<PropositionCorrection>;

const RAISON_EXPIRATION =
  "La relecture par le tuteur a été interrompue après 25 secondes d'attente.";
const RAISON_RELECTURE_INDISPONIBLE =
  "Aucune correction recevable n'a été obtenue. La tentative reste disponible pour une nouvelle demande.";

export function BilanAssiste({
  exercice,
  attemptId,
  dureeSuggeree,
  indicesUtilises,
  compteId,
  navigation,
}: {
  exercice: Exercise;
  attemptId: string;
  dureeSuggeree: number;
  indicesUtilises: number;
  compteId: string;
  navigation?: ContexteNavigationExercice;
}) {
  const cleEtat = cleParCompte(`correction:exercice:${attemptId}`, compteId);
  const [etat, setEtat] = useState<Etat>({ phase: "correction" });
  const [hydrate, setHydrate] = useState(false);
  const [progression, setProgression] = useState<string | null>(null);
  const [secondes, setSecondes] = useState(0);
  const abandonRef = useRef<AbortController | null>(null);
  /** Une seule requête active : protège les doubles clics et le mode strict. */
  const lanceRef = useRef(false);

  useEffect(() => {
    let actif = true;
    queueMicrotask(() => {
      if (!actif) return;
      const sauvegarde = reprendreCorrection(
        lireSession<CorrectionPersiste>(cleEtat),
      );

      if (!sauvegarde) {
        setHydrate(true);
        return;
      }

      if (sauvegarde.phase === "prete") {
        const conversion = convertirCorrection(
          sauvegarde.correction,
          exercice.criteres.length,
        );
        if (conversion.ok) {
          setEtat({ phase: "prete", proposition: conversion.valeur });
        } else {
          effacerSession(cleEtat);
          setEtat({
            phase: "indisponible",
            cause: "erreur",
            raison:
              "La correction conservée n'est plus lisible. Aucune observation n'a été produite.",
          });
        }
      } else {
        setEtat({
          phase: "indisponible",
          cause: sauvegarde.cause,
          raison: sauvegarde.raison,
        });
      }
      setHydrate(true);
    });
    return () => {
      actif = false;
    };
  }, [cleEtat, exercice.criteres.length]);

  useEffect(() => {
    if (!hydrate || etat.phase !== "correction" || lanceRef.current) return;

    lanceRef.current = true;
    const abandon = new AbortController();
    abandonRef.current = abandon;
    ecrireSession(cleEtat, {
      phase: "en-cours",
      lanceeLe: Date.now(),
    } satisfies CorrectionPersiste);
    setProgression(null);
    setSecondes(0);

    void (async () => {
      try {
        const reponse = await fetch("/api/exercices/corriger", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            attemptId,
            config: lireConfigTuteur(compteId) ?? undefined,
          }),
          signal: abandon.signal,
        });

        if (!reponse.ok || !reponse.body) {
          const donnees = (await reponse.json().catch(() => null)) as {
            message?: string;
          } | null;
          if (abandon.signal.aborted) return;
          const raison = donnees?.message ?? RAISON_RELECTURE_INDISPONIBLE;
          ecrireSession(cleEtat, {
            phase: "indisponible",
            cause: "erreur",
            raison,
          });
          setEtat({ phase: "indisponible", cause: "erreur", raison });
          return;
        }

        const lecteur = reponse.body.getReader();
        const decodeur = new TextDecoder();
        let tampon = "";
        let recue: PropositionCorrection | null = null;
        let message: string | null = null;

        for (;;) {
          const { done, value } = await lecteur.read();
          if (done) break;
          tampon += decodeur.decode(value, { stream: true });

          const blocs = tampon.split("\n\n");
          tampon = blocs.pop() ?? "";

          for (const bloc of blocs) {
            const lignes = bloc.split("\n");
            const type =
              lignes.find((ligne) => ligne.startsWith("event:"))?.slice(6).trim() ??
              "message";
            const donnees = lignes
              .find((ligne) => ligne.startsWith("data:"))
              ?.slice(5)
              .trim();
            if (!donnees) continue;

            if (type === "proposition") {
              recue = (
                JSON.parse(donnees) as { correction: PropositionCorrection }
              ).correction;
            } else if (type === "erreur") {
              message = (JSON.parse(donnees) as { message: string }).message;
            } else if (type === "proposition-en-cours") {
              setProgression("Le tuteur rédige son verdict…");
            }
          }
        }

        if (abandon.signal.aborted) return;
        if (!recue) {
          const raison = message ?? RAISON_RELECTURE_INDISPONIBLE;
          ecrireSession(cleEtat, {
            phase: "indisponible",
            cause: "erreur",
            raison,
          });
          setEtat({ phase: "indisponible", cause: "erreur", raison });
          return;
        }

        const conversion = convertirCorrection(recue, exercice.criteres.length);
        if (!conversion.ok) {
          const raison =
            "Le verdict du tuteur était incomplet ou illisible. Aucune observation n'a été produite.";
          ecrireSession(cleEtat, {
            phase: "indisponible",
            cause: "erreur",
            raison,
          });
          setEtat({ phase: "indisponible", cause: "erreur", raison });
          return;
        }

        // Le cache évite de facturer une nouvelle génération lors d'un simple
        // rechargement avant l'acceptation du bilan.
        ecrireSession(cleEtat, {
          phase: "prete",
          correction: recue,
        });
        setEtat({ phase: "prete", proposition: conversion.valeur });
      } catch {
        if (abandon.signal.aborted) return;
        const raison = "La relecture du tuteur a échoué. Aucune observation n'a été produite.";
        ecrireSession(cleEtat, {
          phase: "indisponible",
          cause: "erreur",
          raison,
        });
        setEtat({ phase: "indisponible", cause: "erreur", raison });
      }
    })();

    return () => abandon.abort();
  }, [
    attemptId,
    cleEtat,
    compteId,
    exercice.criteres.length,
    etat.phase,
    hydrate,
  ]);

  useEffect(() => {
    if (!hydrate || etat.phase !== "correction") return;
    const debut = Date.now();
    const minuterie = setInterval(() => {
      const ecoulees = Math.floor((Date.now() - debut) / 1000);
      if (ecoulees * 1000 >= DELAI_INTERRUPTION_CORRECTION_MS) {
        clearInterval(minuterie);
        abandonRef.current?.abort();
        ecrireSession(cleEtat, {
          phase: "indisponible",
          cause: "expiration",
          raison: RAISON_EXPIRATION,
        });
        setEtat({
          phase: "indisponible",
          cause: "expiration",
          raison: RAISON_EXPIRATION,
        });
        return;
      }
      setSecondes(ecoulees);
    }, 1_000);
    return () => clearInterval(minuterie);
  }, [cleEtat, etat.phase, hydrate]);

  function arreterPourSortieSansMesure() {
    abandonRef.current?.abort();
    const raison =
      "La demande de correction a été arrêtée. La tentative sera clôturée sans résultat ni observation.";
    ecrireSession(cleEtat, { phase: "indisponible", cause: "erreur", raison });
    setEtat({ phase: "indisponible", cause: "erreur", raison });
  }

  function relancer() {
    abandonRef.current?.abort();
    effacerSession(cleEtat);
    lanceRef.current = false;
    setProgression(null);
    setSecondes(0);
    setEtat({ phase: "correction" });
  }

  const sortieSansMesure = (
    <BoutonAbandon
      attemptId={attemptId}
      exerciceId={exercice.id}
      dureeMin={dureeSuggeree}
      codes={exercice.competences}
      navigation={navigation}
      mode="sans-mesure"
      avantConfirmation={
        etat.phase === "correction" ? arreterPourSortieSansMesure : undefined
      }
    />
  );

  if (etat.phase === "correction") {
    const attenteLongue = secondes * 1000 >= DELAI_SORTIE_CORRECTION_MS;
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center" aria-live="polite">
        <PointActif />
        <p className="mt-3 text-sm text-texte-attenue">
          {progression ?? "Correction en cours : le tuteur relit votre réponse…"}
        </p>
        <p className="mt-1 text-[0.6875rem] text-texte-discret">
          {secondes} s — aucune observation n&apos;est encore écrite.
        </p>
        {attenteLongue && (
          <div className="mt-4 space-y-2">
            <p className="max-w-sm text-[0.6875rem] text-texte-discret">
              La correction prend plus longtemps que prévu. Vous pouvez attendre, ou terminer
              sans mesure ; votre réponse restera conservée.
            </p>
            {sortieSansMesure}
          </div>
        )}
      </div>
    );
  }

  if (etat.phase === "indisponible") {
    return (
      <div className="space-y-3">
        <BandeauInfo ton="danger" taille="compacte">
          <p role="alert" className="text-danger">
            <span className="font-medium">Correction indisponible.</span> {etat.raison}
          </p>
          <p className="mt-1 text-texte-attenue">
            Aucune preuve n&apos;a été produite et aucune observation ne sera écrite sans
            correction recevable. Vous n&apos;avez pas à vous autoévaluer pour continuer.
          </p>
        </BandeauInfo>
        <div className="flex flex-wrap items-center gap-2">
          <Bouton onClick={relancer} variante="principal" taille="petite">
            Réessayer la correction
          </Bouton>
          {sortieSansMesure}
        </div>
        <p className="text-[0.6875rem] text-texte-discret">
          Une nouvelle demande est toujours explicite. Si la clé du service est partagée, elle
          peut consommer une génération ; aucun nouvel appel n&apos;est lancé au rechargement.
          Après la clôture sans mesure, la réponse attendue restera consultable.
        </p>
      </div>
    );
  }

  return (
    <FormulaireBilan
      exercice={exercice}
      attemptId={attemptId}
      dureeSuggeree={dureeSuggeree}
      indicesUtilises={indicesUtilises}
      propositionInitiale={etat.proposition}
      criteresReplies
      navigation={navigation}
    />
  );
}
