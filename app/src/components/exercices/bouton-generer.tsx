"use client";

import { useState } from "react";
import { Bouton, cx } from "@/components/ui/primitives";
import { ModaleExercice } from "./modale-exercice";
import type { CalibrageModale, CompetenceModale } from "@/lib/domain/proprietes-generation";

export function BoutonGenerer({
  competences,
  competenceInitiale,
  themeInitial,
  calibrages,
  compteId,
  libelle = "Générer un exercice",
  variante = "principal",
  className,
  pleineLargeur = false,
  surEnregistre,
  competencesCibles,
  ouvrirDansCahierApresAcceptation = false,
}: {
  competences: CompetenceModale[];
  competenceInitiale: string;
  /** Thème pré-rempli — voir `ModaleExercice`. */
  themeInitial?: string;
  /** Calibrages de toutes les compétences actives, indexés par code. */
  calibrages: Record<string, CalibrageModale>;
  compteId: string;
  libelle?: string;
  variante?: "principal" | "secondaire";
  className?: string;
  pleineLargeur?: boolean;
  surEnregistre?: (id: string) => void;
  /** Génération groupée — voir `ModaleExercice`. */
  competencesCibles?: string[];
  /** Réservé à la prochaine action : accepter ouvre une séance focus. */
  ouvrirDansCahierApresAcceptation?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <Bouton
        onClick={() => setOuvert(true)}
        variante={variante}
        className={cx(pleineLargeur && "w-full", className)}
      >
        {libelle}
      </Bouton>

      {ouvert && (
        <ModaleExercice
          onFermer={() => setOuvert(false)}
          competences={competences}
          competenceInitiale={competenceInitiale}
          themeInitial={themeInitial}
          calibrages={calibrages}
          compteId={compteId}
          surEnregistre={(id) => {
            setOuvert(false);
            surEnregistre?.(id);
          }}
          competencesCibles={competencesCibles}
          ouvrirDansCahierApresAcceptation={ouvrirDansCahierApresAcceptation}
        />
      )}
    </>
  );
}
