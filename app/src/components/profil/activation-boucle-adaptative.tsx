"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modifierProfil } from "@/lib/store/referentiel-actions";
import { BandeauInfo, Bouton, Carte, EnTeteCarte } from "@/components/ui/primitives";

export function ActivationBoucleAdaptative({
  mode,
}: {
  mode: "legacy" | "adaptive-v1";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const adaptive = mode === "adaptive-v1";

  function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        await modifierProfil({ learningLoopMode: adaptive ? "legacy" : "adaptive-v1" });
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Activation impossible.");
      }
    });
  }

  return (
    <Carte>
      <EnTeteCarte
        titre="Boucle d'apprentissage"
        legende="Bêta activée explicitement par compte ; le parcours historique reste disponible."
      />
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              {adaptive ? "Moteur adaptatif v1" : "Boucle historique"}
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-texte-attenue">
              {adaptive
                ? "Le tableau de bord compare Explorer, S'entraîner et Produire à partir de ton check-in."
                : "Le tableau de bord recommande un exercice selon le classement actuel des compétences."}
            </p>
          </div>
          <Bouton
            variante={adaptive ? "secondaire" : "principal"}
            onClick={toggle}
            enChargement={pending}
          >
            {adaptive ? "Revenir à la boucle historique" : "Activer adaptive-v1"}
          </Bouton>
        </div>
        {error && (
          <BandeauInfo ton="danger" taille="compacte">
            <p className="text-danger">{error}</p>
          </BandeauInfo>
        )}
      </div>
    </Carte>
  );
}
