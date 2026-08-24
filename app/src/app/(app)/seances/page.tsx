import { Suspense } from "react";
import { redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { SqueletteContenu } from "@/components/layout/squelette";
import { chargerDonneesSeance } from "@/components/seances/donnees-seance";
import { VueSeanceDetail, type EtapeRecherche } from "@/components/seances/vue-seance-detail";
import { CahierInteractif } from "@/components/seances/cahier-interactif";
import { lireMarge } from "@/lib/store/marge";
import {
  extraireDocumentsOperationnels,
  jourDeLaSeance,
  joursDuCahier,
  jourValide,
} from "@/lib/domain/pages-cahier";
import { cleJour } from "@/lib/engine/dates";
import { lireApercusDocuments, lireApercusSnapshots } from "@/lib/store/documents";
import type { DocumentOperationnelDate } from "@/lib/domain/pages-cahier";
import { ConcepteurSeance, type PresetSeance } from "@/components/seances/concepteur-seance";
import { statutSeance, TEMPS_DECLARE_MAX } from "@/lib/domain/seance";
import { nombreExercicesConseille } from "@/lib/engine/caf";
import { dureeDeclaree } from "@/lib/domain/intention";

/*
 * Les aperçus documentaires ne servent au cahier qu'à lister les documents
 * opérationnels (projets) et à poser leur drapeau « figé ». La lecture des
 * snapshots — une requête de plus à chaque rendu du cahier — est donc
 * paresseuse : elle ne part que si AU MOINS un document opérationnel existe,
 * sinon son résultat serait jeté. Les corps Markdown ne voyagent de toute
 * façon jamais ici (`lireApercusDocuments` est déjà une lecture légère).
 */
async function chargerProjetsDuCahier(): Promise<DocumentOperationnelDate[]> {
  const apercus = await lireApercusDocuments();
  const operationnels = apercus.some((doc) => doc.frontMatter.role === "operationnel");
  const snapshots = operationnels ? await lireApercusSnapshots() : [];
  return extraireDocumentsOperationnels(apercus, snapshots);
}

/**
 * Pôle Bureau (ADR-061, étendu par ADR-062, refondu par ADR-079 et ADR-103).
 *
 * Une page est un jour, et le pôle a deux lectures de la même route :
 * le **Bureau** — aujourd'hui, où l'on travaille — et le **Cahier**
 * (`?vue=cahier`) — l'archive, où l'on relit. Le rendu initial serveur
 * rassemble toutes les données temporelles une fois ; la navigation entre les
 * jours comme entre les deux modes s'effectue ensuite côté client (0 ms).
 */
export default async function PageSeances(props: {
  searchParams: Promise<{
    session?: string;
    exercice?: string;
    evaluer?: string;
    bilan?: string;
    abandon?: string;
    sas?: string;
    q?: string;
    vue?: string;
    jour?: string;
    mois?: string;
    focus?: string;
    composer?: string;
    code?: string | string[];
    intention?: string;
    "sans-theme"?: string;
    temps?: string;
    amorce?: string;
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
        <VueSeanceDetail
          id={session}
          exerciceDemande={exercice}
          recherche={recherche}
          sas={recherche.sas === "1"}
        />
      </Suspense>
    );
  }

  /*
   * Plus d'`EntetePage` (ADR-103).
   *
   * Elle écrivait « Cahier » et une phrase d'explication au-dessus d'un héros
   * qui répétait déjà la date : deux en-têtes pour une page. Le Bureau porte
   * son propre titre — la date du jour — et le Cahier le sien. Une surface de
   * concentration n'a pas besoin qu'on lui rappelle son nom à chaque ouverture.
   *
   * La recherche n'est pas une page non plus : c'est le Cahier ouvert sur un
   * terme (`vueInitiale`), et il traverse toutes les dates comme avant.
   */
  return (
    <Suspense fallback={<SqueletteContenu />}>
      <ContenuBureau
        jourDemande={recherche.jour}
        moisDemande={recherche.mois}
        vueDemandee={recherche.vue}
        rechercheTexte={recherche.q}
        session={session}
        exercice={exercice}
        recherche={recherche}
        sasDemande={recherche.sas === "1"}
        {...(recherche.composer === "1"
          ? {
              composition: {
                codesParametres: recherche.code,
                intention: recherche.intention,
                sansTheme: recherche["sans-theme"],
                temps: recherche.temps,
                amorce: recherche.amorce,
              },
            }
          : {})}
      />
    </Suspense>
  );
}

export interface DemandeComposition {
  codesParametres?: string | string[];
  intention?: string;
  temps?: string;
  sansTheme?: string;
  amorce?: string;
}

/**
 * Le compositeur ouvert par un lien (`composer=1`).
 */
async function CompositeurDepuisLien({
  codesParametres,
  intention,
  temps,
  sansTheme,
  amorce,
}: DemandeComposition) {
  const donnees = await chargerDonneesSeance();
  const codesDemandes = (Array.isArray(codesParametres) ? codesParametres : codesParametres ? [codesParametres] : [])
    .filter((code, index, liste) => liste.indexOf(code) === index);
  const codesActifs = new Set(donnees.actifs.map((skill) => skill.code));
  const codesVises = codesDemandes.filter((code) => codesActifs.has(code));

  const intentionEcrite = Boolean(intention?.trim());
  const codeRepli = intentionEcrite ? undefined : donnees.recommandations[0]?.etat.skill.code;
  const codes = codesVises.length > 0 ? codesVises : codeRepli ? [codeRepli] : [];
  /*
   * La durée vient de l'URL (`temps`, posé par `urlComposition`) ou, à défaut,
   * est relue dans la phrase d'intention elle-même : un vieux lien sans
   * `temps` qui dit « séance de 15 minutes » doit quand même ouvrir sur 15.
   * Sans aucune des deux sources, `dureeInitiale` reste absent et le
   * compositeur garde son propre défaut — aucun chiffre n'est fabriqué ici.
   */
  const tempsUrl = Number(temps);
  const dureeUrl =
    Number.isFinite(tempsUrl) && tempsUrl > 0
      ? Math.min(TEMPS_DECLARE_MAX, Math.max(5, Math.round(tempsUrl)))
      : undefined;
  const dureeIntention = intention ? dureeDeclaree(intention) : undefined;
  const duree = dureeUrl ?? dureeIntention;
  const domaines = [...new Set(codes.flatMap((code) => {
    const skill = donnees.actifs.find((candidate) => candidate.code === code);
    return skill ? [skill.domaine] : [];
  }))];

  /*
   * Le nombre d'exercices suit la durée déclarée, il n'est plus codé en dur à
   * 3 : un lien « 15 min » qui composait trois exercices de ~20 min produisait
   * une séance de 60 min. Sans historique suffisant pour `nombreExercicesConseille`,
   * repli simple : un exercice par tranche de 15 min.
   */
  /*
   * Une seule durée résolue pour tout ce qui suit.
   *
   * Ni l'URL ni l'intention ne portent forcément une durée. Le repli à 45 min
   * vient du chantier de la capture d'intention ; sans lui, `duree` restait
   * `undefined` en entrée de `nombreExercicesConseille`, dont le paramètre est
   * un `number` — le conseil se calculait alors sur NaN, et le repli aussi.
   */
  const dureeCible = duree ?? 45;
  const conseilLien = nombreExercicesConseille(dureeCible, donnees.exercices, donnees.tentatives);
  const nombreExercicesLien =
    amorce === "1"
      ? 1
      : conseilLien?.nombre ?? Math.min(6, Math.max(1, Math.round(dureeCible / 15)));

  const preset: PresetSeance | undefined = codes.length > 0
    ? {
        libelle:
          amorce === "1"
            ? "Votre premier point de départ"
            : codes.length === 1
              ? `Compétence : ${codes[0]}`
              : "Séance ciblée",
        codesVises: codes,
        nombreExercices: nombreExercicesLien,
        dureeCibleMin: dureeCible,
        ...(domaines.length === 1 ? { domaine: domaines[0] } : {}),
      }
    : undefined;

  return (
    <ConcepteurSeance
      {...donnees}
      preset={preset}
      contexteInitial={intention}
      {...(duree !== undefined ? { dureeInitiale: duree } : {})}
      sansThemeInitial={sansTheme === "1"}
      amorceInitiale={amorce === "1"}
      ouvertParDefaut
      retourEnFermant
      libelle={amorce === "1" ? "Préparer mon premier test" : "Composer une séance"}
    />
  );
}

/**
 * Le pôle, ouvert sur l'un de ses deux modes.
 *
 * Toutes les données sont assemblées ici une seule fois, puis confiées
 * au conteneur interactif pour une navigation instantanée côté client.
 * Le Bureau ouvre toujours sur la page du jour : un marque-page qui ramenait
 * la lecture plusieurs jours en arrière était une friction, pas un confort.
 * Seuls les liens explicites (`?jour=`, `?session=`) ouvrent ailleurs — et
 * `joursDuCahier` garantit qu'aujourd'hui a toujours une page.
 */
async function ContenuBureau({
  jourDemande,
  moisDemande,
  vueDemandee,
  rechercheTexte,
  session,
  exercice,
  recherche,
  sasDemande = false,
  composition,
}: {
  jourDemande?: string;
  moisDemande?: string;
  /** `cahier` ouvre l'archive ; toute autre valeur ouvre le Bureau. */
  vueDemandee?: string;
  /** Terme de recherche : implique le mode Cahier. */
  rechercheTexte?: string;
  session?: string;
  exercice?: string;
  recherche?: EtapeRecherche;
  /** L'URL porte `sas=1` : la séance dépliée ouvre sur son sas (ADR-103). */
  sasDemande?: boolean;
  /** Présente quand `composer=1` : le compositeur s'ouvre au-dessus de la page. */
  composition?: DemandeComposition;
}) {
  const [ctx, donnees, marge, projets] = await Promise.all([
    chargerContexte(),
    chargerDonneesSeance(),
    lireMarge(),
    chargerProjetsDuCahier(),
  ]);

  const jours = joursDuCahier({
    seances: ctx.donnees.sessions,
    notes: marge,
    projets,
    aujourdHui: ctx.now,
  });

  const seanceOuverte = session
    ? ctx.donnees.sessions.find((candidate) => candidate.id === session)
    : undefined;

  /*
   * Travailler ouvre le plein écran (ADR-103, amende ADR-079).
   *
   * Une séance qui attend un geste ne se déroule plus encastrée dans la page
   * du jour : le déroulé complet posait ses propres en-tête, barre
   * d'avancement et boutons de sortie SOUS ceux de la page, et les deux jeux
   * se contredisaient. La page du jour garde la séance — sa carte, son
   * avancement, ses activités — et « Continuer » entre dans le travail.
   *
   * Une séance close, elle, reste dépliable sur place : relire ne demande
   * aucun geste, donc rien ne justifie de quitter la page.
   */
  if (seanceOuverte) {
    const statutOuvert = statutSeance(seanceOuverte);
    if (statutOuvert === "en-cours" || statutOuvert === "planifiee") {
      const suite = new URLSearchParams({ session: seanceOuverte.id, focus: "1" });
      if (exercice) suite.set("exercice", exercice);
      if (sasDemande) suite.set("sas", "1");
      redirect(`/seances?${suite.toString()}`);
    }
  }
  const jour =
    jourValide(jourDemande) ??
    (seanceOuverte ? jourDeLaSeance(seanceOuverte) : null) ??
    cleJour(ctx.now);

  const terme = rechercheTexte?.trim();

  return (
    <CahierInteractif
      jourInitial={jour}
      moisInitial={moisDemande}
      vueInitiale={vueDemandee === "cahier" || terme ? "cahier" : "bureau"}
      {...(terme ? { recherche: terme } : {})}
      jours={jours}
      /*
       * Le regroupement `entrees` vient de `master` (« regrouper les entrées
       * du cahier en un seul objet ») et il est adopté tel quel : cinq
       * paramètres qui voyagent toujours ensemble méritent un objet.
       *
       * `nombresDeFeuilletsMap` ne survit pas : les feuillets ont été retirés
       * avec l'habillage du cahier — une page est un jour, rendue d'un tenant.
       */
      entrees={{
        seances: ctx.donnees.sessions,
        tentatives: ctx.donnees.attempts,
        donnees,
        notes: marge,
        projets,
      }}
      aujourdHuiIso={ctx.now.toISOString()}
      compteId={ctx.donnees.user.id}
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
                  sas={sasDemande}
                  plein={false}
                />
              ),
            }
          : undefined
      }
    />
  );
}
