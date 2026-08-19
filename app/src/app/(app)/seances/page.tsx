import { Suspense } from "react";
import { chargerContexte } from "@/lib/store/context";
import { SqueletteContenu } from "@/components/layout/squelette";
import { EntetePage } from "@/components/layout/entete-page";
import { chargerDonneesSeance } from "@/components/seances/donnees-seance";
import { VueSeanceDetail, type EtapeRecherche } from "@/components/seances/vue-seance-detail";
import { CahierSeances, RechercheCahier } from "@/components/seances/cahier-seances";
import { CahierInteractif } from "@/components/seances/cahier-interactif";
import { lireMarge } from "@/lib/store/marge";
import {
  construirePage,
  extraireDocumentsOperationnels,
  feuilletsDeLaPage,
  feuilletsParJour,
  jourDeLaSeance,
  joursDuCahier,
  jourValide,
  pageDOuverture,
  rangDOuverture,
  rangValide,
} from "@/lib/domain/pages-cahier";
import { lireApercusDocuments, lireApercusSnapshots } from "@/lib/store/documents";
import { ConcepteurSeance, type PresetSeance } from "@/components/seances/concepteur-seance";
import { TEMPS_DECLARE_MAX } from "@/lib/domain/seance";

/**
 * Pôle Cahier (ADR-061, étendu par ADR-062, refondu par ADR-079).
 *
 * Le cahier a des pages, et une page est un jour.
 * Le rendu initial serveur rassemble toutes les données temporelles, puis
 * la navigation entre les feuillets s'effectue instantanément côté client (0 ms).
 */
export default async function PageSeances(props: {
  searchParams: Promise<{
    session?: string;
    exercice?: string;
    correction?: string;
    evaluer?: string;
    bilan?: string;
    abandon?: string;
    q?: string;
    jour?: string;
    f?: string;
    mois?: string;
    focus?: string;
    composer?: string;
    code?: string | string[];
    theme?: string;
    intention?: string;
    temps?: string;
  }>;
}) {
  const recherche = await props.searchParams;
  const { session, exercice } = recherche;

  /*
   * Le plein écran est un MODE de la séance, pas une route : `focus=1` le
   * demande explicitement. Sans lui, une séance ouverte se déroule sur la page
   * du jour où elle a lieu — travailler ne fait plus sortir du cahier.
   */
  if (session && recherche.focus === "1") {
    return (
      <Suspense fallback={<SqueletteContenu />}>
        <VueSeanceDetail id={session} exerciceDemande={exercice} recherche={recherche} />
      </Suspense>
    );
  }

  /*
   * La recherche est l'index du cahier, pas une page : elle traverse les jours.
   * Elle garde donc la liste chronologique, et ne tourne pas de page.
   */
  if (recherche.q?.trim()) {
    return (
      <>
        <EntetePage titre="Cahier" sousTitre="Tous les résultats, toutes dates confondues." />
        <Suspense fallback={<SqueletteContenu />}>
          <ResultatsRecherche recherche={recherche.q} />
        </Suspense>
      </>
    );
  }

  return (
    <>
      <EntetePage
        titre="Cahier"
        sousTitre="Faites une séance, puis retrouvez ici l’essentiel de ce que vous en avez tiré."
      />
      <Suspense fallback={<SqueletteContenu />}>
        <ContenuCahier
          jourDemande={recherche.jour}
          feuilletDemande={recherche.f}
          moisDemande={recherche.mois}
          session={session}
          exercice={exercice}
          recherche={recherche}
          {...(recherche.composer === "1"
            ? {
                composition: {
                  codesParametres: recherche.code,
                  themeDemande: recherche.theme,
                  intention: recherche.intention,
                  temps: recherche.temps,
                },
              }
            : {})}
        />
      </Suspense>
    </>
  );
}

export interface DemandeComposition {
  codesParametres?: string | string[];
  themeDemande?: string;
  intention?: string;
  temps?: string;
}

/**
 * Le compositeur ouvert par un lien (`composer=1`).
 */
async function CompositeurDepuisLien({
  codesParametres,
  themeDemande,
  intention,
  temps,
}: DemandeComposition) {
  const donnees = await chargerDonneesSeance();
  const themeInitial = themeDemande
    ? donnees.themes.find((theme) => theme.id === themeDemande && !theme.archive)
    : undefined;
  const codesDemandes = (Array.isArray(codesParametres) ? codesParametres : codesParametres ? [codesParametres] : [])
    .filter((code, index, liste) => liste.indexOf(code) === index);
  const codesActifs = new Set(donnees.actifs.map((skill) => skill.code));
  const codesVises = codesDemandes.filter((code) => codesActifs.has(code));

  const intentionEcrite = Boolean(intention?.trim());
  const codeRepli = intentionEcrite ? undefined : donnees.recommandations[0]?.etat.skill.code;
  const codes = codesVises.length > 0 ? codesVises : codeRepli ? [codeRepli] : [];
  const duree = Math.min(
    TEMPS_DECLARE_MAX,
    Math.max(5, Math.round(Number(temps) || 45)),
  );
  const domaines = [...new Set(codes.flatMap((code) => {
    const skill = donnees.actifs.find((candidate) => candidate.code === code);
    return skill ? [skill.domaine] : [];
  }))];

  const preset: PresetSeance | undefined = !themeInitial && codes.length > 0
    ? {
        libelle: codes.length === 1 ? `Compétence : ${codes[0]}` : "Séance ciblée",
        codesVises: codes,
        nombreExercices: 3,
        dureeCibleMin: duree,
        ...(domaines.length === 1 ? { domaine: domaines[0] } : {}),
      }
    : undefined;

  return (
    <ConcepteurSeance
      {...donnees}
      preset={preset}
      themeInitial={themeInitial}
      contexteInitial={intention}
      ouvertParDefaut
      retourEnFermant
      libelle="Composer une séance"
    />
  );
}

async function ResultatsRecherche({ recherche }: { recherche: string }) {
  const [ctx, donnees, apercusDocs, snapshots] = await Promise.all([
    chargerContexte(),
    chargerDonneesSeance(),
    lireApercusDocuments(),
    lireApercusSnapshots(),
  ]);
  const projets = extraireDocumentsOperationnels(apercusDocs, snapshots);
  return (
    <div className="space-y-4">
      <RechercheCahier recherche={recherche} />
      <CahierSeances
        seances={ctx.donnees.sessions}
        donnees={donnees}
        recherche={recherche}
        projets={projets}
      />
    </div>
  );
}

/**
 * Le cahier, ouvert sur une page.
 *
 * Toutes les données sont assemblées ici une seule fois, puis confiées
 * au conteneur interactif pour un feuilletage instantané côté client.
 */
async function ContenuCahier({
  jourDemande,
  feuilletDemande,
  moisDemande,
  session,
  exercice,
  recherche,
  composition,
}: {
  jourDemande?: string;
  feuilletDemande?: string;
  moisDemande?: string;
  session?: string;
  exercice?: string;
  recherche?: EtapeRecherche;
  /** Présente quand `composer=1` : le compositeur s'ouvre au-dessus de la page. */
  composition?: DemandeComposition;
}) {
  const [ctx, donnees, marge, apercusDocs, snapshots] = await Promise.all([
    chargerContexte(),
    chargerDonneesSeance(),
    lireMarge(),
    lireApercusDocuments(),
    lireApercusSnapshots(),
  ]);

  const projets = extraireDocumentsOperationnels(apercusDocs, snapshots);

  const jours = joursDuCahier({
    seances: ctx.donnees.sessions,
    notes: marge,
    projets,
    aujourdHui: ctx.now,
  });

  const seanceOuverte = session
    ? ctx.donnees.sessions.find((candidate) => candidate.id === session)
    : undefined;
  const jourExplicite = jourValide(jourDemande) ?? (seanceOuverte ? jourDeLaSeance(seanceOuverte) : null);
  const jour = jourExplicite ?? pageDOuverture(null, jours, ctx.now);

  const entreesDuCahier = { seances: ctx.donnees.sessions, notes: marge, projets };
  const nombresDeFeuillets = feuilletsParJour(jours, entreesDuCahier);
  const feuilletsDuJour = feuilletsDeLaPage(construirePage(jour, entreesDuCahier));

  const rangDeLaSeance = seanceOuverte
    ? feuilletsDuJour.findIndex(
        (feuillet) => feuillet.type === "seance" && feuillet.seance.id === seanceOuverte.id,
      ) + 1
    : 0;
  const rang = rangDOuverture(
    rangDeLaSeance > 0 ? rangDeLaSeance : rangValide(feuilletDemande),
    feuilletsDuJour.length,
  );

  return (
    <CahierInteractif
      compteId={ctx.donnees.user.id}
      jourInitial={jour}
      jourExplicite={jourExplicite !== null}
      feuilletInitial={rang}
      moisInitial={moisDemande}
      jours={jours}
      nombresDeFeuilletsMap={Array.from(nombresDeFeuillets.entries())}
      seances={ctx.donnees.sessions}
      tentatives={ctx.donnees.attempts}
      donnees={donnees}
      notes={marge}
      projets={projets}
      aujourdHuiIso={ctx.now.toISOString()}
      compositeur={composition ? <CompositeurDepuisLien {...composition} /> : undefined}
      seanceDeployee={
        seanceOuverte
          ? {
              id: seanceOuverte.id,
              contenu: (
                <VueSeanceDetail
                  id={seanceOuverte.id}
                  exerciceDemande={exercice}
                  recherche={recherche}
                  plein={false}
                />
              ),
            }
          : undefined
      }
    />
  );
}
