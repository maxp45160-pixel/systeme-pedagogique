"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiverExercice,
  desarchiverExercice,
  supprimerExercice,
} from "@/lib/store/actions";
import { modeRetraitExercice } from "@/lib/domain/exercice";
import { Bouton } from "@/components/ui/primitives";

/**
 * Retrait d'un exercice — calque exact de la gestion du référentiel (ADR-027).
 *
 * LA RÈGLE EST AFFICHÉE AVANT LE CLIC, pas découverte après :
 *
 *   0 tentative   → « Supprimer », et l'exercice disparaît vraiment ;
 *   ≥1 tentative  → « Archiver », et les preuves produites restent.
 *
 * Aucun choix n'est offert entre les deux — le mode est **dérivé** du nombre de
 * tentatives. Un bouton « supprimer » qui archive en douce, ou qui efface une
 * entrée de journal sans le dire, serait trompeur dans un sens comme dans
 * l'autre.
 */
export function RetraitExercice({
  exerciceId,
  titre,
  tentatives,
  archive,
}: {
  exerciceId: string;
  titre: string;
  tentatives: number;
  archive: boolean;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [confirme, setConfirme] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const mode = modeRetraitExercice(tentatives);

  function agir(action: () => Promise<void>) {
    setErreur(null);
    demarrer(async () => {
      try {
        await action();
        setConfirme(false);
        router.refresh();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Opération impossible.");
      }
    });
  }

  if (archive) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Bouton
          disabled={enCours}
          onClick={() => agir(() => desarchiverExercice(exerciceId))}
          variante="secondaire"
          taille="petite"
        >
          Remettre dans le flux
        </Bouton>
        {erreur && <span className="text-[0.6875rem] text-alerte">{erreur}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {confirme ? (
        <div className="flex items-center gap-1.5">
          <Bouton
            disabled={enCours}
            onClick={() =>
              agir(() =>
                mode === "suppression"
                  ? supprimerExercice(exerciceId)
                  : archiverExercice(exerciceId),
              )
            }
            variante="secondaire"
            taille="petite"
          >
            Confirmer
          </Bouton>
          <button
            type="button"
            onClick={() => setConfirme(false)}
            className="text-[0.6875rem] text-texte-attenue hover:text-texte"
          >
            Annuler
          </button>
        </div>
      ) : (
        <Bouton disabled={enCours} onClick={() => setConfirme(true)} variante="discret" taille="petite">
          {mode === "suppression" ? "Supprimer" : "Archiver"}
        </Bouton>
      )}

      {/*
        L'annonce du geste, avant qu'il ne se produise — le cœur d'ADR-027.
        La personne doit savoir si elle efface un énoncé que rien ne cite, ou
        si elle range un exercice qui a produit des preuves — et que ces
        preuves, elles, ne partiront pas.
      */}
      {confirme && (
        <p className="mt-1 max-w-xs rounded-md border border-info/30 bg-info-faible px-3 py-2 text-left text-xs text-texte-attenue">
          {mode === "suppression" ? (
            <>
              <span className="font-medium">Suppression définitive.</span> «&nbsp;{titre}&nbsp;»
              n&apos;a jamais été tenté : l&apos;énoncé disparaît, rien n&apos;est perdu.
            </>
          ) : (
            <>
              <span className="font-medium">Archivage, pas suppression.</span> Cet exercice porte{" "}
              {tentatives} tentative{tentatives > 1 ? "s" : ""} : les preuves qu&apos;elles ont
              produites restent en base, et le journal continue de citer le titre. L&apos;exercice
              sort seulement du flux — tu pourras le remettre.
            </>
          )}
        </p>
      )}

      {erreur && <span className="text-[0.6875rem] text-alerte">{erreur}</span>}
    </div>
  );
}
