"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supprimerExercice, archiverExercice } from "@/lib/store/actions";
import { Bouton } from "@/components/ui/primitives";
import { ModaleConfirmationSuppression } from "@/components/atelier/modale-confirmation-suppression";

export function BoutonRetirerExercice({
  exerciceId,
  titre,
  tentatives,
  destination,
  onRetire,
}: {
  exerciceId: string;
  titre: string;
  tentatives: number;
  destination?: string;
  onRetire?: () => void;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const mode = tentatives > 0 ? "archivage" : "suppression";

  return (
    <>
      <Bouton
        type="button"
        variante="danger"
        taille="petite"
        onClick={() => setOuvert(true)}
      >
        {mode === "archivage" ? "Archiver l’exercice" : "Supprimer l’exercice"}
      </Bouton>

      {ouvert && (
        <ModaleConfirmationSuppression
          titre={mode === "archivage" ? "Archiver l’exercice" : "Supprimer l’exercice"}
          nomElement={titre}
          typeElement="exercice"
          mode={mode}
          explication={
            mode === "archivage"
              ? `Cet exercice possède ${tentatives} tentative${tentatives > 1 ? "s" : ""}. Il sera retiré des exercices proposés, mais son historique restera conservé.`
              : "Cet exercice ne possède aucune tentative. Il sera supprimé définitivement de votre bibliothèque."
          }
          texteBoutonConfirmer={mode === "archivage" ? "Confirmer l’archivage" : "Supprimer définitivement"}
          onConfirmer={async () => {
            // Le mode est dérivé AVANT le clic (ADR-035) ; le serveur, lui,
            // refuse une suppression qui porterait des tentatives.
            if (mode === "archivage") {
              await archiverExercice(exerciceId);
            } else {
              await supprimerExercice(exerciceId);
            }
            setOuvert(false);
            if (onRetire) {
              onRetire();
            } else if (destination) {
              router.push(destination);
            } else {
              router.refresh();
            }
          }}
          onFermer={() => setOuvert(false)}
        />
      )}
    </>
  );
}
