"use client";

/**
 * Actions d'un engagement affiché : « Marquer comme passé » et « Reporter ».
 *
 * Le report demande la nouvelle date AVANT tout geste : il clôture l'ancien
 * engagement « reporte » et crée le remplaçant — l'ancien n'est jamais réécrit
 * ni effacé. Toute écriture passe par les Server Functions de
 * `engagement-actions.ts`, qui revalident côté serveur.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BandeauInfo, Bouton } from "@/components/ui/primitives";
import { cloreEngagement, reporterEngagement } from "@/lib/store/engagement-actions";

export function ActionsEcheance({ id }: { id: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [reportOuvert, setReportOuvert] = useState(false);
  const [nouvelleDate, setNouvelleDate] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  function executer(action: () => Promise<unknown>) {
    setErreur(null);
    demarrer(async () => {
      try {
        await action();
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Action impossible.");
      }
    });
  }

  if (reportOuvert) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          value={nouvelleDate}
          onChange={(e) => setNouvelleDate(e.target.value)}
          aria-label="Nouvelle date"
          className="rounded-md border border-bordure-controle bg-surface px-2 py-1 text-xs outline-none focus:border-primaire"
        />
        <Bouton
          taille="petite"
          variante="principal"
          disabled={!nouvelleDate || enCours}
          enChargement={enCours}
          onClick={() => executer(() => reporterEngagement(id, nouvelleDate))}
        >
          Reporter
        </Bouton>
        <Bouton taille="petite" variante="discret" onClick={() => setReportOuvert(false)}>
          Annuler
        </Bouton>
        {erreur && (
          <BandeauInfo ton="danger" taille="compacte" className="w-full">
            {erreur}
          </BandeauInfo>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <Bouton
          taille="petite"
          variante="discret"
          disabled={enCours}
          title="L'échéance a eu lieu : elle sort des échéances à venir"
          onClick={() => executer(() => cloreEngagement(id))}
        >
          Passé
        </Bouton>
        <Bouton
          taille="petite"
          variante="discret"
          disabled={enCours}
          title="Décale la date : l'engagement initial est conservé, un remplaçant est créé"
          onClick={() => setReportOuvert(true)}
        >
          Reporter
        </Bouton>
      </div>
      {erreur && <span className="text-[0.6875rem] text-alerte">{erreur}</span>}
    </div>
  );
}
