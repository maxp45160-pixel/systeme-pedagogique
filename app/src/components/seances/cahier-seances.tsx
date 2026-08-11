import Link from "next/link";
import { Bouton, Carte, CodeCompetence, EnTeteCarte, EtatVide, Etiquette } from "@/components/ui/primitives";
import { formatDateCourte, formatDuree, cleJour } from "@/lib/engine/dates";
import { statutSeance } from "@/lib/domain/seance";
import type { Exercise, ExerciseAttempt, LearningSession } from "@/lib/domain/types";
import {
  ConcepteurSeance,
  type DonneesSeance,
  type PresetSeance,
} from "@/components/seances/concepteur-seance";
import { ajouterNoteSession } from "@/lib/store/actions";

/**
 * Cahier chronologique léger (ADR-061) — le remplaçant d'Historique + Journal.
 * Les traces détaillées restent repliées par exercice : le carnet se relit
 * comme un cahier, sans faire disparaître la réponse, le bilan ou le tuteur.
 */
export function CahierSeances({
  seances,
  donnees,
}: {
  seances: LearningSession[];
  donnees: DonneesSeance;
}) {
  const realisees = seances
    .filter((s) => statutSeance(s) === "terminee")
    .sort((a, b) => b.date.localeCompare(a.date));

  if (realisees.length === 0) {
    return (
      <Carte>
        <EtatVide
          titre="Aucune séance réalisée"
          message="Compose ta première séance : une fois terminée, elle rejoint ce cahier."
        />
      </Carte>
    );
  }

  const parJour = new Map<string, LearningSession[]>();
  for (const seance of realisees) {
    const cle = cleJour(seance.date);
    const liste = parJour.get(cle);
    if (liste) liste.push(seance);
    else parJour.set(cle, [seance]);
  }

  return (
    <div className="space-y-6">
      {[...parJour.entries()].map(([cle, liste]) => (
        <div key={cle}>
          <h3 className="mb-2 font-serif text-base font-medium tracking-tight">
            {formatDateCourte(liste[0].date)}
          </h3>
          <div className="space-y-3">
            {liste.map((seance) => (
              <LigneCahier key={seance.id} seance={seance} donnees={donnees} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LigneCahier({ seance, donnees }: { seance: LearningSession; donnees: DonneesSeance }) {
  const preset = presetDepuisSeance(seance);
  const exercicesParId = new Map(donnees.exercices.map((exercice) => [exercice.id, exercice]));
  const activites = seance.activites.filter((activite) => activite.type === "exercice");

  return (
    <Carte>
      <EnTeteCarte
        titre={`${seance.activites.length} activité${seance.activites.length > 1 ? "s" : ""}`}
        legende={seance.dureeMin !== undefined ? formatDuree(seance.dureeMin) : "durée non notée"}
      />
      <div className="px-5 py-4">
        {seance.skillCodes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {seance.skillCodes.map((code) => <CodeCompetence key={code} code={code} />)}
          </div>
        )}

        {seance.besoinDeclare?.intention && (
          <p className="mt-2 text-xs italic text-texte-attenue">« {seance.besoinDeclare.intention} »</p>
        )}

        {seance.resultat && <p className="mt-1 text-xs text-texte-discret">{seance.resultat}</p>}

        {activites.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium">Ce qui a été travaillé</p>
            {activites.map((activite) => (
              <TraceExercice
                key={activite.ref}
                exercice={exercicesParId.get(activite.ref)}
                libelle={activite.libelle}
                tentative={tentativeDeSeance(seance, activite.ref, donnees.tentatives)}
              />
            ))}
          </div>
        )}

        <form action={ajouterNoteSession.bind(null, seance.id)} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor={`note-${seance.id}`}>Note personnelle</label>
          <input
            id={`note-${seance.id}`}
            name="note"
            type="text"
            defaultValue={seance.notePersonnelle ?? ""}
            placeholder="Ce que je retiens, ce que je veux revoir…"
            className="min-w-0 flex-1 rounded-md border border-bordure-controle bg-surface px-3 py-2 text-xs placeholder:text-texte-discret"
          />
          <Bouton type="submit" variante="secondaire" taille="petite">Annoter</Bouton>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={detailSeanceUrl(seance.id, activites[0]?.ref)}
            className="text-xs font-medium text-primaire hover:underline"
          >
            Voir le détail de la séance
          </Link>
          {preset && <ConcepteurSeance {...donnees} preset={preset} libelle="Refaire cette séance" />}
        </div>
      </div>
    </Carte>
  );
}

function TraceExercice({
  exercice,
  libelle,
  tentative,
}: {
  exercice?: Exercise;
  libelle: string;
  tentative?: ExerciseAttempt;
}) {
  const resultat = tentative ? libelleResultat(tentative) : "Trace non retrouvée";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-bordure-controle bg-surface-2 px-3 py-2">
      <span className="min-w-0 text-xs font-medium">{exercice?.titre ?? libelle}</span>
      <Etiquette ton={tentative?.statut === "terminee" ? "succes" : tentative?.statut === "abandonnee" ? "danger" : "info"}>
        {resultat}
      </Etiquette>
    </div>
  );
}

/**
 * Rattache une trace existante à l'activité sans ajouter de relation stockée.
 * Une séance composée prend la première tentative menée après son démarrage ;
 * une ancienne séance automatique prend celle dont la clôture est la plus
 * proche de sa date, car elle était écrite au même geste que la tentative.
 */
function tentativeDeSeance(
  seance: LearningSession,
  exerciceId: string,
  tentatives: ExerciseAttempt[],
): ExerciseAttempt | undefined {
  const candidates = tentatives.filter((tentative) => tentative.exerciseId === exerciceId);
  if (candidates.length === 0) return undefined;

  if (seance.genereAutomatiquement) {
    const dateSeance = new Date(seance.date).getTime();
    return [...candidates]
      .filter((tentative) => tentative.statut !== "en-cours")
      .sort((a, b) => {
        const ecartA = Math.abs(new Date(a.fin ?? a.debut).getTime() - dateSeance);
        const ecartB = Math.abs(new Date(b.fin ?? b.debut).getTime() - dateSeance);
        return ecartA - ecartB;
      })[0];
  }

  const depuisDebut = candidates
    .filter((tentative) => tentative.debut >= seance.date && tentative.statut !== "en-cours")
    .sort((a, b) => a.debut.localeCompare(b.debut));
  return depuisDebut.find((tentative) => tentative.statut === "terminee") ?? depuisDebut[0];
}

function libelleResultat(tentative: ExerciseAttempt): string {
  if (tentative.statut === "abandonnee") return "Abandonné";
  if (tentative.statut === "en-cours") return "En cours";
  return tentative.resultat === "reussi" ? "Réussi" : tentative.resultat === "partiel" ? "Partiel" : "Non abouti";
}

function detailSeanceUrl(seanceId: string, exerciceId?: string): string {
  const params = new URLSearchParams({ session: seanceId });
  if (exerciceId) params.set("exercice", exerciceId);
  return `/seances?${params.toString()}`;
}

/** Reconstruction d'une demande de composition à partir du blueprint conservé. */
export function presetDepuisSeance(seance: LearningSession): PresetSeance | undefined {
  const blueprint = seance.blueprint;
  if (!blueprint) return undefined;
  return {
    codesVises: blueprint.cibles.map((cible) => cible.code),
    nombreExercices: blueprint.nombreExercices,
    dureeCibleMin: blueprint.dureeCibleMin,
    domaine: blueprint.portee.type === "mono" ? blueprint.portee.domaine : undefined,
  };
}
