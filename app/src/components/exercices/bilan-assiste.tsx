"use client";

/**
 * Le bilan, précédé d'une relecture par le tuteur.
 *
 * Ce composant ne décide de rien : il lance un appel, convertit ce qui revient,
 * et rend `FormulaireBilan` — pré-rempli si la conversion a réussi, nu sinon.
 * Toute la logique de lecture vit dans `lib/tutor/conversion-correction.ts`,
 * testée (ADR-039 : une décision dans un `.tsx` est hors de portée de Vitest).
 *
 * Trois choix qui méritent leur ligne :
 *
 * 1. **Un seul lancement par montage.** Un garde `useRef` et un
 *    `AbortController` annulé au démontage — même motif que `modale-exercice.tsx`.
 *    Sans eux, un re-rendu relancerait une génération, et N envois rapprochés
 *    donneraient N appels simultanés, donc un 429 sur palier gratuit.
 * 2. **Le repli est immédiat et il se dit.** Erreur, 503, fournisseur sans
 *    outils, conversion refusée : dans tous ces cas le formulaire s'affiche nu
 *    avec la raison. Jamais un écran bloqué, jamais un verdict à moitié.
 * 3. **La conversion refusée est traitée comme une absence de verdict, pas
 *    comme un verdict partiel.** Un formulaire à moitié pré-rempli ressemble à
 *    un formulaire pré-rempli : la personne validerait des cases qu'elle
 *    croirait relues.
 */

import { useEffect, useRef, useState } from "react";
import type { Exercise } from "@/lib/domain/types";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import { convertirCorrection } from "@/lib/tutor/conversion-correction";
import type { PropositionCorrection } from "@/lib/tutor/outils";
import { Bouton, PointActif } from "@/components/ui/primitives";
import { FormulaireBilan, type PropositionBilan } from "./formulaire-bilan";
import type { ContexteNavigationExercice } from "@/lib/domain/navigation-exercice";

type Etat =
  | { phase: "correction" }
  | { phase: "prete"; proposition: PropositionBilan }
  | { phase: "nue"; raison: string | null };

/*
 * Les deux horloges de l'attente (25/08/2026).
 *
 * Une correction dépassant la minute était vécue comme une panne — et l'était
 * parfois. Le plafond serveur valait 300 s : cinq minutes devant un écran qui
 * ne dit rien. Désormais :
 *
 * - à **10 s**, la sortie manuelle est proposée (« Je ne sais pas encore ») :
 *   le formulaire s'ouvre NU, sans appel LLM, et rien n'est écrit sans la
 *   relecture de la personne — aucune observation n'est fabriquée par
 *   l'abandon (P5, et invariant « abandon ≠ preuve ») ;
 * - à **25 s**, l'attente est interrompue automatiquement : le flux est
 *   annulé (ce qui interrompt aussi la génération côté serveur via
 *   `request.signal`) et le formulaire manuel s'ouvre avec la raison.
 *
 * La mesure fine (TTFT, durée totale, fournisseur) vit dans les logs de la
 * route `/api/exercices/corriger` ; ici, seul ce que la personne vit est
 * affiché.
 */
const DELAI_SORTIE_PROPOSEE_MS = 10_000;
const DELAI_INTERRUPTION_MS = 25_000;

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
  const [etat, setEtat] = useState<Etat>({ phase: "correction" });
  const [progression, setProgression] = useState<string | null>(null);
  /** Secondes écoulées depuis le lancement — affiché, et seuil des deux horloges. */
  const [secondes, setSecondes] = useState(0);
  const abandonRef = useRef<AbortController | null>(null);
  const lanceRef = useRef(false);

  useEffect(() => {
    // Le garde survit aux re-rendus et au double montage du mode strict : une
    // correction se paie, elle ne se relance pas parce que React a remonté.
    if (lanceRef.current) return;
    lanceRef.current = true;

    const abandon = new AbortController();
    abandonRef.current = abandon;

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
          const donnees = (await reponse.json().catch(() => null)) as { message?: string } | null;
          setEtat({
            phase: "nue",
            raison:
              donnees?.message ??
              "Le tuteur n'a pas pu relire votre réponse. Remplissez le bilan à la main.",
          });
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
            const type = lignes.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message";
            const donnees = lignes.find((l) => l.startsWith("data:"))?.slice(5).trim();
            if (!donnees) continue;

            if (type === "proposition") {
              recue = (JSON.parse(donnees) as { correction: PropositionCorrection }).correction;
            } else if (type === "erreur") {
              message = (JSON.parse(donnees) as { message: string }).message;
            } else if (type === "proposition-en-cours") {
              setProgression("Le tuteur rédige son verdict…");
            }
          }
        }

        if (!recue) {
          setEtat({ phase: "nue", raison: message });
          return;
        }

        const conversion = convertirCorrection(recue, exercice.criteres.length);
        if (!conversion.ok) {
          // Volontairement traité comme une absence de verdict : un bilan à
          // moitié pré-rempli ressemble à un bilan pré-rempli.
          setEtat({
            phase: "nue",
            raison:
              "Le verdict du tuteur était incomplet ou illisible : il n'a pas été retenu. Remplis le bilan à la main.",
          });
          return;
        }

        setEtat({ phase: "prete", proposition: conversion.valeur });
      } catch {
        if (!abandon.signal.aborted) {
          setEtat({ phase: "nue", raison: "Relecture interrompue." });
        }
      }
    })();

    return () => abandon.abort();
  }, [attemptId, compteId, exercice.criteres.length]);

  /*
   * L'horloge visible et l'interruption automatique vivent dans le MÊME
   * intervalle : le seuil est franchi dans le rappel (un système externe qui
   * notifie), pas dans un effet de re-rendu — et l'écran affiche la seconde
   * écoulée pendant que le compte tourne.
   */
  useEffect(() => {
    if (etat.phase !== "correction") return;
    const debut = Date.now();
    const minuterie = setInterval(() => {
      const ecoulees = Math.round((Date.now() - debut) / 1000);
      if (ecoulees * 1000 >= DELAI_INTERRUPTION_MS) {
        clearInterval(minuterie);
        // On coupe le flux : côté serveur, `request.signal` interrompt à son
        // tour la génération. Le formulaire s'ouvre nu, avec la raison.
        abandonRef.current?.abort();
        setEtat({
          phase: "nue",
          raison:
            "La relecture par le tuteur a été interrompue après 25 secondes d'attente. Remplissez le bilan vous-même : rien n'a été écrit sans votre décision.",
        });
        return;
      }
      setSecondes(ecoulees);
    }, 1_000);
    return () => clearInterval(minuterie);
  }, [etat.phase]);

  function sortieManuelle() {
    abandonRef.current?.abort();
    setEtat({ phase: "nue", raison: null });
  }

  if (etat.phase === "correction") {
    const attenteLongue = secondes * 1000 >= DELAI_SORTIE_PROPOSEE_MS;
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <PointActif />
        <p className="mt-3 text-sm text-texte-attenue">
          {progression ?? "Le tuteur relit votre réponse…"}
        </p>
        {attenteLongue ? (
          <>
            <p className="mt-1 text-[0.6875rem] text-texte-discret" role="status">
              {secondes} s — plus long que d&apos;habitude. Vous pouvez remplir le bilan sans
              attendre.
            </p>
            <Bouton onClick={sortieManuelle} variante="principal" taille="petite" className="mt-4">
              Je ne sais pas encore
            </Bouton>
            <p className="mt-2 max-w-xs text-[0.6875rem] leading-relaxed text-texte-discret">
              Ouvre le bilan à remplir vous-même, critère par critère. Aucun appel au tuteur,
              et rien n&apos;est écrit à votre place.
            </p>
          </>
        ) : (
          <p className="mt-1 text-[0.6875rem] text-texte-discret">
            Son verdict sera une proposition : vous le relisez et vous décidez.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {etat.phase === "nue" && etat.raison && (
        <p className="rounded-md border border-bordure bg-surface-2 px-3 py-2 text-[0.6875rem] text-texte-attenue">
          {etat.raison}
        </p>
      )}

      <FormulaireBilan
        exercice={exercice}
        attemptId={attemptId}
        dureeSuggeree={dureeSuggeree}
        indicesUtilises={indicesUtilises}
        propositionInitiale={etat.phase === "prete" ? etat.proposition : undefined}
        criteresReplies={etat.phase === "prete"}
        navigation={navigation}
      />
    </div>
  );
}
