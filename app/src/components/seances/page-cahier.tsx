import type { ReactNode, Ref } from "react";
import Link from "next/link";
import { Carte, CodeCompetence, EnTeteCarte, Etiquette, classesLienBouton } from "@/components/ui/primitives";
import { cleJour, formatDuree } from "@/lib/engine/dates";
import { statutSeance, tentativeDeSeance } from "@/lib/domain/seance";
import {
  construirePage,
  feuilletsDeLaPage,
  folioDuFeuillet,
  rangDOuverture,
  voisinsDuFeuillet,
  type DocumentOperationnelDate,
  type Feuillet,
  type PositionFeuillet,
} from "@/lib/domain/pages-cahier";
import type { ExerciseAttempt, LearningSession } from "@/lib/domain/types";
import type { LigneMarge } from "@/lib/documents/marge";
import type { DonneesSeance } from "@/components/seances/concepteur-seance";
import { CarteSeance } from "@/components/seances/file-seances";
import { LigneCahier } from "@/components/seances/cahier-seances";
import { MargeCahier } from "@/components/seances/marge-cahier";
import { CalendrierCahier } from "@/components/seances/calendrier-cahier";
import { TournePage, type TournePageHandle } from "@/components/seances/tourne-page";

/**
 * Un feuillet du cahier : un jour, et ce qu'on en lit d'un seul tenant.
 */
export function PageCahier({
  jour,
  jours,
  rang,
  nombresDeFeuillets,
  mois,
  seances,
  tentatives,
  donnees,
  notes,
  projets = [],
  aujourdHui,
  seanceDeployee,
  onChangerFeuillet,
  onChangerMois,
  refTourne,
}: {
  jour: string;
  jours: string[];
  /** Le rang demandé dans l'URL, brut : il peut être périmé, on le borne ici. */
  rang: number | null;
  /** Combien de feuillets porte chaque jour — construit une fois par le serveur. */
  nombresDeFeuillets: ReadonlyMap<string, number>;
  /** Le mois ouvert dans le calendrier — pas forcément celui de la page. */
  mois: string;
  seances: LearningSession[];
  tentatives: ExerciseAttempt[];
  donnees: DonneesSeance;
  notes: LigneMarge[];
  projets?: DocumentOperationnelDate[];
  aujourdHui: Date;
  /** La séance ouverte en plein travail, rendue à sa place dans le déroulé. */
  seanceDeployee?: { id: string; contenu: ReactNode };
  onChangerFeuillet: (cible: PositionFeuillet, sens?: "avant" | "arriere") => void;
  onChangerMois: (mois: string) => void;
  refTourne?: Ref<TournePageHandle>;
}) {
  const page = construirePage(jour, { seances, notes, projets });
  const feuillets = feuilletsDeLaPage(page);
  const rangOuvert = rangDOuverture(rang, feuillets.length);
  const feuillet = feuillets[rangOuvert - 1];

  const nombreDe = (cible: string) => Math.max(1, nombresDeFeuillets.get(cible) ?? 1);
  const { precedent, suivant } = voisinsDuFeuillet({ jour, rang: rangOuvert }, jours, nombreDe);
  const { folio, total } = folioDuFeuillet({ jour, rang: rangOuvert }, jours, nombresDeFeuillets);

  const cleAujourdHui = cleJour(aujourdHui);
  const estAujourdHui = jour === cleAujourdHui;

  return (
    <div className="cahier-relie">
      {/* Le dos toilé : ce à quoi le feuillet tient. Purement décoratif. */}
      <div className="reliure" aria-hidden />

      <TournePage ref={refTourne}>
        <div className="pile-feuillets relative">
          {/*
            Le ruban : bouton vers la page du jour tant qu'on lit ailleurs, simple
            repère cousu une fois qu'on y est.
          */}
          {estAujourdHui ? (
            <span className="ruban-marque-page" title="La page du jour" aria-hidden>
              <span>Aujourd’hui</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onChangerFeuillet({ jour: cleAujourdHui, rang: 1 }, cleAujourdHui > jour ? "avant" : "arriere")}
              className="ruban-marque-page cursor-pointer"
              title="Revenir à la page du jour"
            >
              <span>Aujourd’hui</span>
            </button>
          )}

          {/*
            La clé porte le feuillet, pas le jour : passer du feuillet 1 au 2 d'un
            même jour rejoue l'apparition, sinon le contenu changerait sans que
            rien ne dise qu'on a tourné.
          */}
          <div
            key={`${jour}-${rangOuvert}`}
            data-feuillet={`${jour}-${rangOuvert}`}
            className="page-cahier reliee apparition relative min-h-[28rem] px-4 py-5 pb-10 sm:pl-14 sm:pr-6"
          >
            <EnTeteFeuillet
              feuillet={feuillet}
              precedent={precedent}
              suivant={suivant}
              estAujourdHui={estAujourdHui}
              onChangerFeuillet={onChangerFeuillet}
              calendrier={
                <CalendrierCahier
                  jour={jour}
                  mois={mois}
                  jours={jours}
                  aujourdHui={aujourdHui}
                  onChangerJour={(j) =>
                    onChangerFeuillet({ jour: j, rang: 1 }, j > jour ? "avant" : "arriere")
                  }
                  onChangerMois={onChangerMois}
                />
              }
            />

            <div className="space-y-6 pt-5">
              {feuillet.type === "seance" ? (
                seanceDeployee?.id === feuillet.seance.id ? (
                  <div>{seanceDeployee.contenu}</div>
                ) : (
                  <SeanceDuFeuillet
                    seance={feuillet.seance}
                    tentatives={tentatives}
                    donnees={donnees}
                  />
                )
              ) : (
                <ClotureDuJour
                  feuillet={feuillet}
                  donnees={donnees}
                  notes={notes}
                  estAujourdHui={estAujourdHui}
                />
              )}
            </div>

            {/*
              Le folio compte les feuillets du cahier entier, jamais des pixels :
              c'est le seul repère qui ne bouge pas quand un autre jour se remplit.
            */}
            <p className="chiffres absolute bottom-3 right-4 font-mono text-[0.6875rem] text-texte-discret sm:right-6">
              {folio} / {total}
            </p>
          </div>
        </div>
      </TournePage>
    </div>
  );
}

/** Le lien d'un feuillet. Le rang 1 reste implicite : une URL n'a pas à porter un défaut. */
function lienFeuillet(position: PositionFeuillet): string {
  const base = `/seances?jour=${encodeURIComponent(position.jour)}`;
  return position.rang > 1 ? `${base}&f=${position.rang}` : base;
}

/**
 * L'en-tête d'un feuillet.
 */
function EnTeteFeuillet({
  feuillet,
  precedent,
  suivant,
  estAujourdHui,
  calendrier,
  onChangerFeuillet,
}: {
  feuillet: Feuillet<LigneMarge, DocumentOperationnelDate>;
  precedent: PositionFeuillet | null;
  suivant: PositionFeuillet | null;
  estAujourdHui: boolean;
  calendrier: ReactNode;
  onChangerFeuillet: (cible: PositionFeuillet, sens?: "avant" | "arriere") => void;
}) {
  const premierDuJour = feuillet.rang === 1;

  return (
    <div className="flex min-h-[5.25rem] flex-wrap items-start justify-between gap-3 border-b border-bordure pb-3">
      <div className="min-w-0">
        {premierDuJour ? (
          <>
            <h2 className="souligne inline-block font-serif text-2xl font-medium tracking-tight first-letter:capitalize">
              {libelleJour(feuillet.jour)}
            </h2>
            {estAujourdHui && <p className="mt-2 text-xs text-texte-discret">La page du jour.</p>}
          </>
        ) : (
          <>
            <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-texte-discret">
              Suite
            </p>
            <p className="font-serif text-base font-medium text-texte-discret first-letter:capitalize">
              {libelleJour(feuillet.jour)}
            </p>
            <h2 className="mt-0.5 font-serif text-xl font-medium tracking-tight">
              {titreDuFeuillet(feuillet)}
            </h2>
          </>
        )}

        {feuillet.total > 1 && (
          <PointsDeFeuillets
            jour={feuillet.jour}
            rang={feuillet.rang}
            total={feuillet.total}
            onChangerFeuillet={onChangerFeuillet}
          />
        )}
      </div>

      <nav aria-label="Feuillets du cahier" className="flex shrink-0 items-center gap-2">
        {precedent ? (
          <button
            type="button"
            onClick={() => onChangerFeuillet(precedent, "arriere")}
            aria-label="Feuillet précédent"
            title="Feuillet précédent"
            className={`${classesLienBouton("secondaire", "petite")} cursor-pointer`}
          >
            ←
          </button>
        ) : (
          <span
            aria-disabled
            title="Début du cahier"
            className={`${classesLienBouton("secondaire", "petite")} pointer-events-none opacity-40`}
          >
            ←
          </span>
        )}
        {suivant ? (
          <button
            type="button"
            onClick={() => onChangerFeuillet(suivant, "avant")}
            aria-label="Feuillet suivant"
            title="Feuillet suivant"
            className={`${classesLienBouton("secondaire", "petite")} cursor-pointer`}
          >
            →
          </button>
        ) : (
          <span
            aria-disabled
            title="Dernier feuillet"
            className={`${classesLienBouton("secondaire", "petite")} pointer-events-none opacity-40`}
          >
            →
          </span>
        )}
        {calendrier}
      </nav>
    </div>
  );
}

/** Combien de feuillets porte ce jour, et où l'on en est — un point par feuillet. */
function PointsDeFeuillets({
  jour,
  rang,
  total,
  onChangerFeuillet,
}: {
  jour: string;
  rang: number;
  total: number;
  onChangerFeuillet: (cible: PositionFeuillet, sens?: "avant" | "arriere") => void;
}) {
  return (
    <p className="mt-2 flex items-center gap-2 text-xs text-texte-discret">
      <span>
        Feuillet {rang} sur {total}
      </span>
      <span className="flex items-center gap-1">
        {Array.from({ length: total }, (_, index) => {
          const cible = index + 1;
          const ouvert = cible === rang;
          const classesPoint = `size-1.5 rounded-full transition-colors cursor-pointer ${
            ouvert ? "bg-primaire" : "bg-bordure-forte hover:bg-primaire/60"
          }`;

          return (
            <button
              key={cible}
              type="button"
              onClick={() => onChangerFeuillet({ jour, rang: cible }, cible > rang ? "avant" : "arriere")}
              aria-current={ouvert ? "page" : undefined}
              aria-label={`Feuillet ${cible} sur ${total}`}
              title={`Feuillet ${cible}`}
              className={classesPoint}
            />
          );
        })}
      </span>
    </p>
  );
}

/**
 * Une séance sur son feuillet : la carte de relecture si elle est refermée, la
 * carte d'action si elle attend encore quelque chose.
 */
function SeanceDuFeuillet({
  seance,
  tentatives,
  donnees,
}: {
  seance: LearningSession;
  tentatives: ExerciseAttempt[];
  donnees: DonneesSeance;
}) {
  const statut = statutSeance(seance);
  if (statut === "terminee" || statut === "abandonnee") {
    return <LigneCahier seance={seance} donnees={donnees} />;
  }
  return <CarteSeance seance={seance} tentatives={tentatives} />;
}

/**
 * Le feuillet de clôture : ce que le jour porte en dehors de ses séances.
 */
function ClotureDuJour({
  feuillet,
  donnees,
  notes,
  estAujourdHui,
}: {
  feuillet: Extract<Feuillet<LigneMarge, DocumentOperationnelDate>, { type: "cloture" }>;
  donnees: DonneesSeance;
  notes: LigneMarge[];
  estAujourdHui: boolean;
}) {
  const vide =
    feuillet.traces.length === 0 && feuillet.projets.length === 0 && feuillet.notes.length === 0;

  return (
    <>
      {feuillet.projets.length > 0 && (
        <section className="space-y-3">
          <TitreDeSection>
            Projet{feuillet.projets.length > 1 ? "s" : ""} &amp; travaux de ce jour
          </TitreDeSection>
          <div className="space-y-3">
            {feuillet.projets.map((projet) => (
              <ProjetDuFeuillet key={projet.id} projet={projet} jour={feuillet.jour} />
            ))}
          </div>
        </section>
      )}

      {feuillet.traces.length > 0 && (
        <section className="space-y-1">
          <TitreDeSection>Aussi ce jour-là</TitreDeSection>
          <ul className="divide-y divide-bordure/60">
            {feuillet.traces.map((trace) => (
              <TraceHorsSeance key={trace.id} seance={trace} donnees={donnees} />
            ))}
          </ul>
        </section>
      )}

      {estAujourdHui ? (
        <section className="space-y-2">
          <TitreDeSection>En marge</TitreDeSection>
          <MargeCahier lignes={notes} compteId={donnees.compteId} compacte />
        </section>
      ) : feuillet.notes.length > 0 ? (
        <section className="space-y-1">
          <TitreDeSection>Noté ce jour-là</TitreDeSection>
          <ul className="space-y-1.5">
            {feuillet.notes.map((note, index) => (
              <li
                key={`${index}-${note.texte}`}
                className={`text-sm ${note.faite ? "text-texte-discret line-through" : ""}`}
              >
                {note.texte}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {vide && !estAujourdHui && (
        <p className="py-6 text-sm italic text-texte-discret">Rien n’a été écrit ce jour-là.</p>
      )}
    </>
  );
}

function ProjetDuFeuillet({ projet, jour }: { projet: DocumentOperationnelDate; jour: string }) {
  const retourUrl = `/seances?jour=${encodeURIComponent(jour)}`;
  return (
    <Carte>
      <EnTeteCarte
        titre={projet.titre}
        legende={projet.dureeMin ? formatDuree(projet.dureeMin) : "Projet"}
        action={
          <Etiquette ton={projet.fige ? "succes" : "primaire"}>
            {projet.fige ? "Version figée" : "En cours"}
          </Etiquette>
        }
      />
      <div className="px-5 py-4 space-y-3">
        {projet.competences.length > 0 && (
          <div>
            <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
              Compétence{projet.competences.length > 1 ? "s" : ""} visée{projet.competences.length > 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {projet.competences.map((code) => (
                <CodeCompetence key={code} code={code} />
              ))}
            </div>
          </div>
        )}
        {projet.contexte && (
          <p className="text-xs text-texte-attenue line-clamp-2">{projet.contexte}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-bordure/40">
          <span className="text-xs text-texte-discret">
            {projet.fige ? "Projet archivé" : "Espace de travail ouvert"}
          </span>
          <Link
            href={`/atelier?note=${encodeURIComponent(projet.id)}&retour=${encodeURIComponent(retourUrl)}`}
            className={classesLienBouton("principal", "petite")}
          >
            Ouvrir le projet →
          </Link>
        </div>
      </div>
    </Carte>
  );
}

/** L'intitulé d'une rubrique du feuillet — discret, il ne concurrence pas la date. */
function TitreDeSection({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
      {children}
    </h3>
  );
}

/** Un exercice clos hors séance : une ligne, pas une carte. */
function TraceHorsSeance({
  seance,
  donnees,
}: {
  seance: LearningSession;
  donnees: DonneesSeance;
}) {
  const activite = seance.activites.find((item) => item.type === "exercice");
  const exercice = activite ? donnees.exercices.find((item) => item.id === activite.ref) : undefined;
  const tentative = activite
    ? tentativeDeSeance(seance, activite.ref, donnees.tentatives)
    : undefined;

  const resultat = tentative?.statut === "abandonnee"
    ? { texte: "Abandonné", ton: "danger" as const }
    : tentative?.resultat === "reussi"
      ? { texte: "Réussi", ton: "succes" as const }
      : tentative?.resultat === "partiel"
        ? { texte: "Partiel", ton: "info" as const }
        : { texte: "Non abouti", ton: undefined };

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <span className="text-sm">{exercice?.titre ?? activite?.libelle ?? "Exercice"}</span>
        {typeof seance.dureeMin === "number" && (
          <span className="ml-2 text-xs text-texte-discret">{formatDuree(seance.dureeMin)}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Etiquette ton={resultat.ton}>{resultat.texte}</Etiquette>
        <Link
          href={`/seances?session=${encodeURIComponent(seance.id)}`}
          className="text-xs font-medium text-primaire hover:underline"
        >
          Détail
        </Link>
      </div>
    </li>
  );
}

/**
 * Le titre d'un feuillet de suite.
 */
function titreDuFeuillet(feuillet: Feuillet<LigneMarge, DocumentOperationnelDate>): string {
  if (feuillet.type === "cloture") return "Clôture du jour";
  const intention = feuillet.seance.besoinDeclare?.intention?.trim();
  if (intention) return intention;
  const activites = feuillet.seance.activites.length;
  return `Séance — ${activites} activité${activites > 1 ? "s" : ""}`;
}

function libelleJour(jour: string): string {
  return new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
