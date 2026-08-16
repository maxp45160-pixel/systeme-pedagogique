import { Suspense } from "react";
import { chargerContexte } from "@/lib/store/context";
import { SqueletteContenu } from "@/components/layout/squelette";
import { EntetePage } from "@/components/layout/entete-page";
import { chargerDonneesSeance } from "@/components/seances/donnees-seance";
import { VueSeanceDetail, type EtapeRecherche } from "@/components/seances/vue-seance-detail";
import { OngletsSeancesOuvertes } from "@/components/seances/file-seances";
import { CahierSeances, RechercheCahier } from "@/components/seances/cahier-seances";
import { PageCahier } from "@/components/seances/page-cahier";
import { MarquePage } from "@/components/seances/marque-page";
import { lireMarge } from "@/lib/store/marge";
import {
  jourDeLaSeance,
  joursDuCahier,
  jourValide,
  moisValide,
  pageDOuverture,
} from "@/lib/domain/pages-cahier";
import { moisAffiche } from "@/components/seances/calendrier-cahier";
import { ConcepteurSeance, type PresetSeance } from "@/components/seances/concepteur-seance";
import { TEMPS_DECLARE_MAX } from "@/lib/domain/seance";

/**
 * Pôle Cahier (ADR-061, étendu par ADR-062, refondu par ADR-079).
 *
 * Le cahier a des pages, et une page est un jour. Ce n'était pas le cas : le
 * hub déroulait tout l'historique d'un coup, et le workspace était un calque
 * plein écran qui le **remplaçait** — travailler, c'était sortir du cahier.
 *
 * Les paramètres, par ordre d'autorité :
 *
 *  - `focus=1` avec `session` — le plein écran, un MODE de concentration ;
 *  - `q` — l'index : la recherche traverse les jours et ne tourne pas de page ;
 *  - `composer=1` — le compositeur, ouvert AU-DESSUS de la page. Ce n'est pas
 *    une route à part : elle rendait sa propre coquille, et la refermer sans
 *    composer laissait sur un écran vide sans retour ;
 *  - `jour` / `mois` — la page ouverte, et le mois du calendrier ;
 *  - `session` sans `focus` — la séance se déroule sur la page de son jour.
 *
 * Sans rien : le marque-page rouvre la dernière page consultée.
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
        <EntetePage titre="Cahier" sousTitre="Ce que la recherche retrouve, tous jours confondus." />
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
        sousTitre="Travaille une séance, puis retrouve l’essentiel de ce que tu en as tiré."
      />
      <Suspense fallback={<SqueletteContenu />}>
        <ContenuCahier
          jourDemande={recherche.jour}
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
 *
 * ⚠️ **Ce n'était plus une page, c'était un cul-de-sac.** La route rendait sa
 * propre coquille — un titre et un bouton — puis ouvrait la modale par-dessus.
 * Refermer la modale sans composer laissait donc face à un écran quasi vide,
 * sans cahier, sans page, sans retour : le seul geste restant était de rouvrir
 * ce qu'on venait de fermer.
 *
 * Le compositeur s'ouvre désormais **au-dessus du cahier**, dont la page reste
 * dessous. Fermer rend la main au cahier au lieu de laisser nulle part, et
 * `retourEnFermant` ramène en plus à l'écran d'où l'on venait — le tableau de
 * bord, un exercice, une fiche — puisque c'est de là qu'on a demandé à
 * composer.
 */
async function CompositeurDepuisLien({
  codesParametres,
  themeDemande,
  intention,
  temps,
}: DemandeComposition) {
  const donnees = await chargerDonneesSeance();
  /*
   * Un thème demandé passe avant les codes : il porte une portée nommée, que
   * `ConcepteurSeance` sait déjà préférer au reste (`themeDuThemeInitial`).
   * Un identifiant inconnu ou archivé n'est pas une erreur — on retombe sur le
   * chemin par codes plutôt que d'ouvrir un écran vide.
   */
  const themeInitial = themeDemande
    ? donnees.themes.find((theme) => theme.id === themeDemande && !theme.archive)
    : undefined;
  const codesDemandes =(Array.isArray(codesParametres) ? codesParametres : codesParametres ? [codesParametres] : [])
    .filter((code, index, liste) => liste.indexOf(code) === index);
  const codesActifs = new Set(donnees.actifs.map((skill) => skill.code));
  const codesVises = codesDemandes.filter((code) => codesActifs.has(code));
  /*
   * Le repli sur la première recommandation ne joue QUE si aucune intention
   * n'accompagne la demande.
   *
   * Il jouait toujours, et il mentait : une phrase sans code — « je bloque en
   * maths » — ouvrait le compositeur sur la compétence en tête du classement,
   * sans rapport avec la phrase, sous le titre « le sujet est déjà choisi ».
   * Le texte de la personne servait de décor pendant que le système visait
   * autre chose.
   *
   * Quand une intention est écrite, c'est ELLE le sujet : mieux vaut ouvrir le
   * compositeur sans cible imposée — il demandera quoi travailler — que d'en
   * imposer une que rien ne relie à ce qui a été dit (P6, ne rien inventer).
   */
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
  // `themeDuPreset` prime sur `themeDuThemeInitial` dans le compositeur : un
  // preset construit ici masquerait le thème demandé.
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
  const [ctx, donnees] = await Promise.all([chargerContexte(), chargerDonneesSeance()]);
  return (
    <div className="space-y-4">
      <RechercheCahier recherche={recherche} />
      <CahierSeances seances={ctx.donnees.sessions} donnees={donnees} recherche={recherche} />
    </div>
  );
}

/**
 * Le cahier, ouvert sur une page.
 *
 * L'ordre de lecture : les onglets qui dépassent (ce qui est ouvert ailleurs),
 * la page elle-même, puis la recherche tout en bas — c'est l'index d'un cahier,
 * et un index se consulte quand on n'a pas trouvé en feuilletant.
 */
async function ContenuCahier({
  jourDemande,
  moisDemande,
  session,
  exercice,
  recherche,
  composition,
}: {
  jourDemande?: string;
  moisDemande?: string;
  session?: string;
  exercice?: string;
  recherche?: EtapeRecherche;
  /** Présente quand `composer=1` : le compositeur s'ouvre au-dessus de la page. */
  composition?: DemandeComposition;
}) {
  const [ctx, donnees, marge] = await Promise.all([
    chargerContexte(),
    chargerDonneesSeance(),
    lireMarge(),
  ]);

  const jours = joursDuCahier({
    seances: ctx.donnees.sessions,
    notes: marge,
    aujourdHui: ctx.now,
  });

  /*
   * Le jour affiché, par ordre d'autorité : celui demandé, celui de la séance
   * ouverte, puis le jour courant. Ouvrir une séance amène donc sur SA page —
   * c'est ce qui raccroche le travail au cahier.
   */
  const seanceOuverte = session
    ? ctx.donnees.sessions.find((candidate) => candidate.id === session)
    : undefined;
  const jourExplicite = jourValide(jourDemande) ?? (seanceOuverte ? jourDeLaSeance(seanceOuverte) : null);
  const jour = jourExplicite ?? pageDOuverture(null, jours, ctx.now);

  return (
    <div className="space-y-8">
      {/*
        Le marque-page ne redirige que si aucun jour n'était demandé : demander
        une page explicitement doit toujours l'emporter sur la mémoire.
      */}
      <MarquePage
        compteId={ctx.donnees.user.id}
        jour={jour}
        jours={jours}
        reprendre={jourExplicite === null}
      />

      {composition && <CompositeurDepuisLien {...composition} />}

      <OngletsSeancesOuvertes
        seances={ctx.donnees.sessions}
        tentatives={ctx.donnees.attempts}
        jourAffiche={jour}
      />

      <PageCahier
        jour={jour}
        jours={jours}
        mois={moisAffiche(moisValide(moisDemande), jour)}
        seances={ctx.donnees.sessions}
        tentatives={ctx.donnees.attempts}
        donnees={donnees}
        notes={marge}
        aujourdHui={ctx.now}
        {...(seanceOuverte
          ? {
              seanceDeployee: {
                id: seanceOuverte.id,
                contenu: (
                  <VueSeanceDetail
                    id={seanceOuverte.id}
                    exerciceDemande={exercice}
                    recherche={recherche}
                    plein={false}
                  />
                ),
              },
            }
          : {})}
      />

      <section className="space-y-2 border-t border-bordure pt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
          Chercher dans tout le cahier
        </h2>
        <RechercheCahier />
      </section>
    </div>
  );
}
