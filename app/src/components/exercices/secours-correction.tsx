"use client";

import { useState } from "react";
import { ReglagesTuteur } from "@/components/tuteur/reglages-tuteur";
import { Bouton } from "@/components/ui/primitives";
import { decrireConfigClient, lireConfigTuteur, type ConfigTuteurClient } from "@/lib/tutor/cle-client";

/** Configuration et consentement restent deux gestes distincts. */
export function SecoursCorrection({ compteId, onDemander }: {
  compteId: string;
  onDemander: (config: ConfigTuteurClient) => void;
}) {
  const [config, setConfig] = useState(() => lireConfigTuteur(compteId, "secours"));
  const [reglages, setReglages] = useState(false);

  return (
    <div className="space-y-3 rounded-md border border-bordure p-3">
      <p className="text-sm font-medium">Obtenir un feedback avec un autre fournisseur</p>
      {config && (
        <>
          <p className="text-xs text-texte-attenue">
            Fournisseur de secours : {decrireConfigClient(config)}.
            En confirmant, vous lui transmettez l&apos;énoncé, les critères, le corrigé de référence
            et votre réponse enregistrée. Cet appel peut être facturé par ce fournisseur.
          </p>
          <Bouton taille="petite" onClick={() => onDemander(config)}>
            Envoyer au fournisseur de secours
          </Bouton>
        </>
      )}
      <Bouton variante="secondaire" taille="petite" onClick={() => setReglages(!reglages)}>
        {reglages ? "Fermer les réglages" : config ? "Modifier le fournisseur de secours" : "Configurer un fournisseur de secours"}
      </Bouton>
      {reglages && (
        <ReglagesTuteur
          compteId={compteId}
          usage="secours"
          compact
          surEnregistre={(suivante) => { setConfig(suivante); setReglages(false); }}
          surEfface={() => setConfig(null)}
        />
      )}
    </div>
  );
}
