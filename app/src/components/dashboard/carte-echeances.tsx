import type { Engagement } from "@/lib/domain/engagement";
import {
  couvertureCompetences,
  estOuvert,
  joursRestants,
  libelleCompte,
  triParUrgence,
} from "@/lib/domain/engagement";
import type { SkillState } from "@/lib/domain/types";
import { Carte, CodeCompetence, Etiquette } from "@/components/ui/primitives";
import { Depliant } from "@/components/ui/explication";
import { ActionsEcheance } from "./actions-echeance";

/**
 * Carte « À venir » — les engagements ouverts du compte, du plus proche au
 * plus lointain.
 *
 * Elle n'existe QUE s'il y a au moins un engagement ouvert : sur un compte
 * sans échéance déclarée, aucune grille de tirets ne remplace la carte (règle
 * compte neuf — l'absence se voit par l'absence de la carte).
 *
 * Le dépliant d'un engagement de type examen déplie la couverture dérivée des
 * états courants : niveau observé et dernière activité par compétence ciblée,
 * ou « rien encore observé » — jamais un zéro (A5 : calculé à la demande,
 * jamais stocké).
 */
export function CarteEcheances({
  engagements,
  etatsParCode,
  now,
}: {
  engagements: Engagement[];
  etatsParCode: Map<string, SkillState>;
  now: Date;
}) {
  const ouverts = triParUrgence(engagements.filter(estOuvert));
  if (ouverts.length === 0) return null;

  const aVenir = ouverts.filter((e) => joursRestants(e.echeanceLe, now) >= 0);
  const depasses = ouverts.filter((e) => joursRestants(e.echeanceLe, now) < 0);

  return (
    <Carte id="carte-echeances">
      <div className="border-b border-bordure px-5 py-3.5">
        <h2 className="font-serif text-[1.0625rem] font-medium tracking-tight">À venir</h2>
        <p className="mt-0.5 text-xs text-texte-attenue">
          Vos échéances déclarées, de la plus proche à la plus lointaine.
        </p>
      </div>
      <div className="px-5 py-3" data-testid="echeances-a-venir">
        <ul className="divide-y divide-bordure/60">
          {aVenir.map((engagement) => (
            <LigneEngagement key={engagement.id} engagement={engagement} etatsParCode={etatsParCode} now={now} />
          ))}
          {aVenir.length === 0 && (
            <li className="py-2 text-xs text-texte-discret">Aucune échéance à venir.</li>
          )}
        </ul>

        {depasses.length > 0 && (
          <Depliant resume={`Passé (${depasses.length})`} className="mt-2 border-t border-bordure/60 pt-2">
            <ul className="divide-y divide-bordure/60">
              {depasses.map((engagement) => (
                <LigneEngagement key={engagement.id} engagement={engagement} etatsParCode={etatsParCode} now={now} />
              ))}
            </ul>
          </Depliant>
        )}
      </div>
    </Carte>
  );
}

function LigneEngagement({
  engagement,
  etatsParCode,
  now,
}: {
  engagement: Engagement;
  etatsParCode: Map<string, SkillState>;
  now: Date;
}) {
  const jours = joursRestants(engagement.echeanceLe, now);
  const couverture =
    engagement.type === "examen" && engagement.codes.length > 0
      ? couvertureCompetences(engagement.codes, etatsParCode)
      : null;

  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-texte">{engagement.libelle}</span>
          <Etiquette ton={jours < 0 ? "alerte" : jours <= 3 ? "primaire" : "neutre"}>
            {libelleCompte(jours)}
          </Etiquette>
        </div>
        {engagement.codes.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {engagement.codes.map((code) => (
              <CodeCompetence key={code} code={code} />
            ))}
          </div>
        )}

        {couverture && (
          <Depliant resume="Où en sont les compétences visées ?" className="mt-1.5">
            <ul className="space-y-1 pl-3 pt-1 text-[0.6875rem] text-texte-attenue">
              {couverture.map((c) => (
                <li key={c.code}>· {c.phrase}</li>
              ))}
            </ul>
          </Depliant>
        )}
      </div>

      <ActionsEcheance id={engagement.id} />
    </li>
  );
}
