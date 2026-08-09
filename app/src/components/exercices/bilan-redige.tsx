/**
 * Le retour rédigé du tuteur (ADR-046), rendu au même endroit deux fois.
 *
 * Deux écrans l'affichent : le formulaire de bilan, au moment où le verdict
 * arrive, et la fiche de l'exercice terminé, quand on revient le relire. Le
 * dupliquer aurait produit deux rendus qui divergent — c'est le motif qui
 * revient dans tout cet audit, un même geste écrit à deux endroits.
 *
 * Composant serveur par défaut : il n'a aucun état, il affiche du texte.
 */

import type { VerdictTuteur } from "@/lib/domain/types";

export function BilanRedigeVue({
  bilan,
  titre = "Le retour du tuteur",
  legende = "Aucune note ici — c'est une lecture de ta réponse, pas une mesure.",
}: {
  bilan: VerdictTuteur["bilan"];
  titre?: string;
  legende?: string;
}) {
  return (
    <div className="rounded-md border border-primaire/30 bg-surface-2 px-3 py-2.5">
      <p className="text-xs font-medium text-primaire">{titre}</p>
      <p className="mt-0.5 text-[0.625rem] text-texte-discret">{legende}</p>

      <div className="mt-2.5 space-y-2.5">
        <Section titre="Ce qui est acquis" texte={bilan.pointsForts} />
        <Section titre="Ce qui bloque, et pourquoi" texte={bilan.pointsBloquants} />

        {bilan.aRetravailler.length > 0 && (
          <div>
            <EnTete>À retravailler</EnTete>
            <ul className="mt-1 space-y-0.5">
              {bilan.aRetravailler.map((point, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs">
                  <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-primaire" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ titre, texte }: { titre: string; texte: string }) {
  if (!texte) return null;
  return (
    <div>
      <EnTete>{titre}</EnTete>
      <p className="mt-0.5 whitespace-pre-wrap text-xs">{texte}</p>
    </div>
  );
}

function EnTete({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
      {children}
    </p>
  );
}
