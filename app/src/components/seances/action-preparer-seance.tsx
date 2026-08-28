"use client";

/**
 * « Préparer et démarrer » — l'entrée d'une séance protocole qui attend
 * encore des exercices (ADR-131).
 *
 * La préparation est une Server Action LONGUE (le tuteur écrit les manquants,
 * dizaines de secondes) : elle vit ici, côté client, avec son état affiché —
 * pas dans `demarrerSeance`, qui resterait suspendue sans rien dire. Au succès
 * seulement, la séance démarre et la navigation part ; en cas d'échec, le
 * message reste sous le bouton, l'écran ne bouge pas.
 *
 * La config tuteur (`localStorage`) n'est lisible que côté client : c'est ce
 * composant qui la porte vers l'action, comme partout (ADR-116).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bouton } from "@/components/ui/primitives";
import { demarrerSeance } from "@/lib/store/seance-actions";
import { preparerSeancePlanifieeAction } from "@/lib/store/protocole-actions";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";

export function ActionPreparerSeance({
  seanceId,
  compteId,
  libelle = "Préparer et démarrer",
  taille = "normale",
  instantanee = false,
  className,
}: {
  seanceId: string;
  /** Présent : la clé personnelle du compte est proposée au tuteur si écrite. */
  compteId?: string;
  libelle?: string;
  taille?: "normale" | "compacte" | "petite";
  /** Vrai : la préparation n'appelle pas le tuteur (ADR-133) — pas d'annonce d'attente. */
  instantanee?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"repos" | "preparation" | "demarrage">("repos");
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Bouton
        type="button"
        variante="principal"
        taille={taille}
        disabled={phase !== "repos"}
        enChargement={phase !== "repos"}
        className={className}
        onClick={() => {
          setErreur(null);
          setPhase("preparation");
          void (async () => {
            try {
              const config = compteId
                ? (lireConfigTuteur(compteId) ?? undefined)
                : undefined;
              await preparerSeancePlanifieeAction({ seanceId }, config);
              setPhase("demarrage");
              const destination = await demarrerSeance(seanceId);
              router.push(destination);
              router.refresh();
            } catch (cause) {
              setPhase("repos");
              setErreur(
                cause instanceof Error ? cause.message : "La préparation a échoué.",
              );
            }
          })();
        }}
      >
        {phase === "demarrage" ? "Ouverture…" : libelle}
      </Bouton>
      {phase === "preparation" && !instantanee && (
        <span className="text-[0.6875rem] text-texte-discret">
          Le tuteur écrit les exercices manquants — quelques dizaines de secondes.
        </span>
      )}
      {erreur && (
        <span role="alert" className="max-w-xs text-[0.6875rem] text-alerte">
          {erreur}
        </span>
      )}
    </span>
  );
}
