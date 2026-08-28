import Link from "next/link";
import { ActionSeance } from "@/components/seances/action-seance";
import { TiroirTuteur } from "@/components/tuteur/tiroir-tuteur";
import { VueExercice } from "@/components/exercices/vue-exercice";
import {
  Carte,
  CorpsCarte,
  EnTeteCarte,
  Etiquette,
  classesLienBouton,
} from "@/components/ui/primitives";
import {
  consigneDeterministeIntervention,
  libelleEffetIntervention,
  libelleSourceIntervention,
  messageFinIntervention,
} from "@/lib/domain/intervention-rendus";
import type { ExecutionIntervention } from "@/lib/domain/intervention-execution";
import type { Exercise } from "@/lib/domain/types";
import type { EtatContexteTuteur } from "@/lib/tutor/etat-contexte";
import { formatDuree } from "@/lib/engine/dates";
import { terminerInterventionPourSeance } from "@/lib/store/seance-actions";

type RechercheIntervention = {
  evaluer?: string;
  bilan?: string;
  abandon?: string;
};

const STATUTS = {
  "a-faire": "À faire",
  "en-cours": "En cours",
  terminee: "Terminée",
  abandonnee: "Abandonnée",
} as const;

export interface RenduInterventionProps {
  execution: ExecutionIntervention;
  seanceId: string;
  plein: boolean;
  recherche?: RechercheIntervention;
  exercice?: Exercise;
  activiteSuivanteId?: string;
  seancePeutTerminer: boolean;
  compteId: string;
  codesCompetences: string[];
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  competencesModale: Parameters<typeof TiroirTuteur>[0]["competencesModale"];
  calibragesModale: Parameters<typeof TiroirTuteur>[0]["calibragesModale"];
  etatInitialTuteur?: EtatContexteTuteur;
}

function MetaIntervention({ execution }: { execution: ExecutionIntervention }) {
  const { intervention } = execution;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-texte-attenue">
      <Etiquette>{execution.rendu.label}</Etiquette>
      <Etiquette>{STATUTS[execution.statut]}</Etiquette>
      {intervention.estimatedDurationMinutes !== undefined && (
        <Etiquette>≈ {formatDuree(intervention.estimatedDurationMinutes)}</Etiquette>
      )}
      <span>{libelleSourceIntervention(intervention.source)}</span>
      <span aria-hidden>·</span>
      <span>{libelleEffetIntervention(intervention.expectedEffect)}</span>
    </div>
  );
}

function CarteGestuelle({
  execution,
  seanceId,
  compteId,
  codesCompetences,
  domainesExistants,
  competencesModale,
  calibragesModale,
}: Pick<RenduInterventionProps, "execution" | "seanceId" | "compteId" | "codesCompetences" | "domainesExistants" | "competencesModale" | "calibragesModale">) {
  const { intervention } = execution;
  const code = intervention.targetSkillCodes?.[0];
  const documentHref = intervention.source.kind === "document"
    ? `/atelier?document=${encodeURIComponent(intervention.source.ref)}`
    : undefined;
  const terminer = execution.statut === "a-faire" || execution.statut === "en-cours";

  return (
    <Carte accent>
      <EnTeteCarte titre={intervention.label} legende={execution.rendu.label} />
      <CorpsCarte>
        <MetaIntervention execution={execution} />
        {execution.rendu.kind === "feynman" && (
          <div className="space-y-3 text-sm">
            {consigneDeterministeIntervention(intervention) && (
              <p className="whitespace-pre-line border-l-2 border-primaire/30 pl-3 text-texte-attenue">
                {consigneDeterministeIntervention(intervention)}
              </p>
            )}
            <p>
              Le prompt Feynman reste déterministe et aucun document n&apos;est envoyé automatiquement.
            </p>
            <div className="flex flex-wrap gap-2">
              {code && (
                <Link href={`/expliquer?code=${encodeURIComponent(code)}`} className={classesLienBouton("secondaire", "petite")}>
                  Ouvrir l&apos;espace Feynman
                </Link>
              )}
            </div>
          </div>
        )}
        {execution.rendu.kind === "recall" && (
          <div className="space-y-3 text-sm">
            {consigneDeterministeIntervention(intervention) && (
              <p className="whitespace-pre-line border-l-2 border-primaire/30 pl-3 text-texte-attenue">
                {consigneDeterministeIntervention(intervention)}
              </p>
            )}
            <p>La restitution se fait d&apos;abord de mémoire, puis se vérifie contre la source réelle désignée par la séance.</p>
            {documentHref && (
              <Link href={documentHref} className={classesLienBouton("secondaire", "petite")}>
                Ouvrir la source du rappel
              </Link>
            )}
          </div>
        )}
        {execution.rendu.kind === "document" && (
          <div className="space-y-3 text-sm">
            <p>Ouvrez le document explicitement ; il n&apos;atteint le tuteur qu&apos;après ce geste et une relecture avant envoi.</p>
            {documentHref && (
              <Link href={documentHref} className={classesLienBouton("secondaire", "petite")}>
                Ouvrir le document
              </Link>
            )}
          </div>
        )}
        {execution.rendu.kind === "writing" && (
          <div className="space-y-3 text-sm">
            <p>Rédigez dans l&apos;espace documentaire existant, puis revenez ici pour déclarer le geste terminé.</p>
            {documentHref && (
              <Link href={documentHref} className={classesLienBouton("secondaire", "petite")}>
                Ouvrir l&apos;espace d&apos;écriture
              </Link>
            )}
          </div>
        )}
        {execution.rendu.kind === "tutor" && (
          <div className="space-y-3 text-sm">
            <p>Le tuteur reste fermé jusqu&apos;à votre demande explicite. Aucun document n&apos;est transmis automatiquement.</p>
            <TiroirTuteur
              compteId={compteId}
              codesCompetences={codesCompetences}
              domainesExistants={domainesExistants}
              competencesModale={competencesModale}
              calibragesModale={calibragesModale}
              competenceCiblee={code}
              libelle="Ouvrir le tuteur"
            />
          </div>
        )}
        {execution.statut === "terminee" && (
          <p className="mt-4 border-t border-bordure/60 pt-3 text-sm text-texte-attenue">
            {messageFinIntervention(intervention)}
          </p>
        )}
        {execution.statut === "abandonnee" && (
          <p className="mt-4 border-t border-bordure/60 pt-3 text-sm text-texte-attenue">
            Intervention abandonnée : aucune observation n&apos;a été produite.
          </p>
        )}
        {terminer && (
          <div className="mt-4 border-t border-bordure/60 pt-3">
            <ActionSeance
              action={terminerInterventionPourSeance.bind(null, intervention.id)}
              seanceId={seanceId}
              libelle="Déclarer l'intervention terminée"
              taille="petite"
            />
          </div>
        )}
      </CorpsCarte>
    </Carte>
  );
}

/**
 * Registre de rendu : ce composant ne choisit jamais le type d'intervention,
 * il exécute uniquement le chemin déclaré par `renduPourIntervention`.
 */
export function RenduIntervention(props: RenduInterventionProps) {
  const { execution, exercice } = props;
  if (execution.rendu.kind === "exercise") {
    if (!exercice) {
      return (
        <Carte accent>
          <EnTeteCarte titre={execution.intervention.label} legende="Exercice indisponible" />
          <CorpsCarte>
            <MetaIntervention execution={execution} />
            <p className="text-sm text-texte-attenue">La source de cet exercice n&apos;est plus disponible. Aucune activité de remplacement n&apos;est fabriquée.</p>
          </CorpsCarte>
        </Carte>
      );
    }
    return (
      <div>
        <MetaIntervention execution={execution} />
        <VueExercice
          params={Promise.resolve({ id: exercice.id })}
          searchParams={Promise.resolve(props.recherche ?? {})}
          navigation={{ seanceId: props.seanceId, plein: props.plein }}
          integree
          etatInitialTuteurFourni={props.etatInitialTuteur}
          activiteSuivanteId={props.activiteSuivanteId}
          seancePeutTerminer={props.seancePeutTerminer}
        />
      </div>
    );
  }
  return <CarteGestuelle {...props} />;
}
