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
import { classesBouton, cx } from "@/components/ui/primitives";
import { FormulaireBilan, type PropositionBilan } from "./formulaire-bilan";

type Etat =
  | { phase: "correction" }
  | { phase: "prete"; proposition: PropositionBilan }
  | { phase: "nue"; raison: string | null };

export function BilanAssiste({
  exercice,
  attemptId,
  dureeSuggeree,
  indicesUtilises,
  compteId,
}: {
  exercice: Exercise;
  attemptId: string;
  dureeSuggeree: number;
  indicesUtilises: number;
  compteId: string;
}) {
  const [etat, setEtat] = useState<Etat>({ phase: "correction" });
  const [progression, setProgression] = useState<string | null>(null);
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
              "Le tuteur n'a pas pu relire ta réponse. Remplis le bilan à la main.",
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

  if (etat.phase === "correction") {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <span className="size-1.5 animate-pulse rounded-full bg-primaire" aria-hidden />
        <p className="mt-3 text-sm text-texte-attenue">
          {progression ?? "Le tuteur relit ta réponse…"}
        </p>
        <p className="mt-1 text-[0.6875rem] text-texte-discret">
          Son verdict sera une proposition : tu le relis et tu décides.
        </p>
        <button
          type="button"
          onClick={() => {
            abandonRef.current?.abort();
            setEtat({ phase: "nue", raison: null });
          }}
          className={cx(classesBouton("secondaire", "petite"), "mt-4")}
        >
          Remplir sans le tuteur
        </button>
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
      />
    </div>
  );
}
