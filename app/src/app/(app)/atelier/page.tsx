import { notFound } from "next/navigation";
import { EntetePage } from "@/components/layout/entete-page";
import { WorkspaceDocument } from "@/components/atelier/workspace-document";
import { EspaceDocumentaire, type ElementAtelier } from "@/components/atelier/espace-documentaire";
import { definitionTypeDocument } from "@/lib/documents/types-documents";
import { lireApercusDocuments, lireApercusSnapshots, lireDocument } from "@/lib/store/documents";
import { lirePiecesJointes } from "@/lib/store/document-attachments";
import { reconstruireIndexDepuisApercus } from "@/lib/documents/index";
import { analyserDocumentMarkdown } from "@/lib/documents/markdown";
import { documentEnLectureSeule, estDocumentPreuve } from "@/lib/documents/nature-document";
import { regrouperTentativesParExercice } from "@/lib/documents/workspace";
import { chargerContexte } from "@/lib/store/context";
import { dorsaleCompte } from "@/lib/store/db";
import { construireGraphe } from "@/lib/domain/graphe";
import { construireGrapheDomaines } from "@/lib/domain/graphe-domaines";
import { domainesPortants } from "@/lib/domain/hierarchie-domaines";
import { construireVuesAtelier } from "@/lib/documents/vue-atelier";
import { construireProgressionsDomaines } from "@/lib/documents/progression-domaine";
import { lireChangementsReferentiel } from "@/lib/store/referentiel";
import { calibragesPourModale, competencesPourModale } from "@/lib/domain/proprietes-generation";
import {
  rangerDocument,
  rangementDomaine,
} from "@/lib/documents/rangement-atelier";
import { paletteDomaines } from "@/lib/ui/couleurs-domaines";
import { chargerDonneesSeance } from "@/components/seances/donnees-seance";
import { lireTraceProtocole } from "@/lib/store/protocole-actions";
import { RelectureAuChargement } from "@/components/referentiel/relecture-au-chargement";
import { chargerLotPropositions } from "@/lib/store/relecture-referentiel";

export default async function PageAtelier(props: {
  searchParams: Promise<{ document?: string; note?: string; retour?: string; creation?: string; vue?: string; lecture?: string }>;
}) {
  const { document: documentDemande, note, retour, creation, vue: vueDemandee, lecture } = await props.searchParams;
  /*
   * `vue=progression` ouvre la vue domaine directement en lecture longitudinale.
   * Toute autre valeur est ignorée : seul un mode qui existe mérite d'être initialisé.
   */
  const modeProgressionDemande = vueDemandee === "progression";

  /*
   * L'espace de travail documentaire unifié occupe l'écran entier.
   * On coupe court avant le chargement du corpus global pour une réactivité maximale.
   */
  if (note) {
    const fiche = await lireDocument(note).catch(() => null);
    if (!fiche) notFound();
    const analyse = analyserDocumentMarkdown(fiche.id, fiche.contenuMd);
    const estSupport = analyse.frontMatter.role === "support";
    const estSeance = analyse.type === "seance";
    const estCours = analyse.type === "cours";

    /*
     * La trace du protocole (ADR-130) est dérivée à la lecture : séances liées
     * dans `sessions`, journal dans la fiche. Elle ne charge que pour une fiche
     * cours — les autres supports n'ont pas de protocole.
     */
    const [pieces, donneesSeance, traceProtocole] = await Promise.all([
      estSupport ? lirePiecesJointes(fiche.id).catch(() => []) : Promise.resolve([]),
      estSeance ? chargerDonneesSeance() : Promise.resolve(undefined),
      estSupport && estCours
        ? lireTraceProtocole(fiche.id).catch(() => undefined)
        : Promise.resolve(undefined),
    ]);
    // Les repères locaux et la clé du tuteur sont isolés par compte (garde-fou
    // post-ADR-029) : l'espace de travail a besoin de savoir qui est connecté.
    const { userId } = await dorsaleCompte();

    return (
      <WorkspaceDocument
        id={fiche.id}
        contenuInitial={fiche.contenuMd}
        updatedAtInitial={fiche.updatedAt}
        piecesInitiales={pieces}
        donneesSeance={donneesSeance}
        retour={retour}
        compteId={userId}
        traceProtocole={traceProtocole}
        /*
         * Dépôt de cours (ADR-129) : `?lecture=1` n'est posé que par le flux
         * « Déposer mon cours », qui vient d'attacher le PDF. Toute autre
         * valeur est ignorée — le paramètre ne relance jamais une lecture.
         */
        lectureAutomatique={lecture === "1"}
      />
    );
  }

  const [aperçus, snapshots, contexte, contenuInitial, changementsReferentiel, donneesSeance, lotPropositions] = await Promise.all([
    lireApercusDocuments(),
    lireApercusSnapshots(),
    chargerContexte(),
    documentDemande ? lireDocument(documentDemande).catch(() => null) : Promise.resolve(null),
    lireChangementsReferentiel(),
    chargerDonneesSeance(),
    chargerLotPropositions(),
  ]);
  const relectureDue = lotPropositions.relectureDue;
  const referentiel = contexte.referentiel;
  const exercices = contexte.donnees.exercises;

  /*
    `document` désigne aussi une sélection projetée de l'Atelier : une vue,
    un domaine ou une compétence. Ces éléments n'ont pas de ligne dans la
    table des documents, mais ils doivent rester ouvrables depuis les liens de
    l'application. Seul un identifiant absent de la projection et du corpus
    mérite le 404 d'un lien réellement périmé.
  */
  /*
   * Les projections de l'Atelier portent un préfixe de type dans leur
   * identifiant (`domaine:logistique`, `exercice:xyz`) — c'est l'espace de
   * noms du graphe, et c'est cet identifiant-là que `ouvrirElement` écrit dans
   * l'URL. Seul `document:` était retiré ici : un rechargement sur une fiche de
   * domaine ou d'exercice comparait donc « domaine:logistique » à des
   * identifiants nus, ne trouvait rien, et rendait un 404 sur une page qui
   * existait. Constaté le 22/08/2026 sur un `router.refresh()`.
   */
  const identifiantDocument = documentDemande?.replace(/^(document|domaine|exercice):/, "");
  const selectionAtelierExiste = Boolean(
    documentDemande &&
      (["domaines", "ressources", "graphe", "domaines-archives"].includes(documentDemande) ||
        referentiel.domaines.some((domaine) => domaine.id === identifiantDocument) ||
        referentiel.skills.some((skill) => skill.code === identifiantDocument) ||
        exercices.some((exercice) => exercice.id === identifiantDocument) ||
        aperçus.some((apercu) => apercu.id === identifiantDocument || apercu.id === documentDemande)),
  );
  if (documentDemande && !contenuInitial && !selectionAtelierExiste) notFound();
  /*
   * Un domaine est visible s'il MONTRE une compétence, pas s'il en a créé une.
   *
   * Le test portait sur `skill.domaine === domaine.id`, c'est-à-dire le
   * namespace de création. Depuis ADR-107 ce n'est plus là qu'on lit la
   * visibilité — et un sous-domaine né d'une scission n'a aucune compétence
   * dont `domaine` vaut son identifiant : les compétences gardent leur
   * namespace, seul leur tag a bougé. « Gestion kanban » existait en base avec
   * neuf compétences et n'apparaissait nulle part (constaté le 24/08/2026).
   */
  const portants = domainesPortants(referentiel.domaines, referentiel.actifs);
  const domainesVisibles = new Set(
    referentiel.domaines
      .filter((domaine) => !domaine.archive && portants.has(domaine.id))
      .map((domaine) => domaine.id),
  );
  const exercicesVisibles = exercices.filter(
    (exercice) =>
      !exercice.archive &&
      domainesVisibles.has(exercice.domaine) &&
      exercice.competences.some((code) => referentiel.codesActifs.has(code)),
  );
  const domainesArchives = new Set(
    referentiel.domaines.filter((domaine) => domaine.archive).map((domaine) => domaine.id),
  );
  const exercicesArchives = exercices.filter(
    (exercice) => !exercice.archive && domainesArchives.has(exercice.domaine),
  );
  const index = reconstruireIndexDepuisApercus(aperçus, [
    ...referentiel.skills.map((skill) => skill.code),
    ...exercices.flatMap((exercice) => [exercice.id, `exercice:${exercice.id}`]),
  ]);
  const tentativesParExercice = regrouperTentativesParExercice(contexte.donnees.attempts);
  const codesAvecDependances = new Set<string>([
    ...exercices.flatMap((exercice) => exercice.competences),
    ...contexte.donnees.sessions.flatMap((session) => session.skillCodes),
    ...referentiel.skills.flatMap((skill) => [...skill.prerequis, ...(skill.remplacePar ? [skill.remplacePar] : [])]),
    ...index.entrants.keys(),
  ]);
  const vues = construireVuesAtelier(
    referentiel,
    contexte.etats,
    exercices,
    contexte.donnees.attempts,
    index,
    contexte.observationsEffectives,
    changementsReferentiel,
    codesAvecDependances,
    contexte.carteIndividuelle.competencesLocales,
  );
  const vuesCompetences = new Map(vues.competences.map((vue) => [vue.code, vue]));
  const vuesExercices = new Map(vues.exercices.map((vue) => [vue.id, vue]));

  /*
   * La lecture longitudinale par domaine — la même que celle que rendait
   * `/progression?domaine=`, calculée en une passe serveur et portée par les
   * fiches de domaine. C'est maintenant la surface unique pour cette question.
   */
  const progressionsDomaines = construireProgressionsDomaines({
    referentiel,
    etats: contexte.etats,
    observations: contexte.observationsEffectives,
    exercices,
    tentatives: contexte.donnees.attempts,
    dureesEstimees: contexte.dureesEstimees,
    now: contexte.now,
  });
  const snapshotsParDocument = new Map<string, Array<{ id: string; version: number; captureReason: string; capturedAt: string }>>();
  for (const snapshot of snapshots) {
    const items = snapshotsParDocument.get(snapshot.documentId) ?? [];
    items.push({ id: snapshot.id, version: snapshot.version, captureReason: snapshot.captureReason, capturedAt: snapshot.capturedAt });
    snapshotsParDocument.set(snapshot.documentId, items);
  }

  const documents: ElementAtelier[] = index.documents.map((document) => {
    const contenuMd = contenuInitial?.id === document.id ? contenuInitial.contenuMd : "";
    const vue = contenuMd ? analyserDocumentMarkdown(document.id, contenuMd) : document;
    const definition = document.type ? definitionTypeDocument(document.type) : null;
    // `transversal` est une absence de domaine déclarée, pas un domaine.
    const domaineDeclare = vue.frontMatter.domaine ?? vue.frontMatter.domain;
    const domaineId =
      typeof domaineDeclare === "string" && domaineDeclare !== "transversal"
        ? domaineDeclare
        : undefined;
    const domaineConnu = domaineId ? referentiel.domainesParId.get(domaineId) : undefined;
    const estPreuve = estDocumentPreuve({ id: document.id, type: vue.type });
    /*
     * Les rattachements sont lus, jamais devinés : ce sont les codes du
     * référentiel du compte que la fiche cite réellement. Une ressource qui
     * n'en cite aucun reste « à trier », et l'Atelier le dit plutôt que de la
     * ranger arbitrairement quelque part.
     */
    const competencesCitees = (index.sortants.get(document.id) ?? []).filter((cible) =>
      referentiel.codesActifs.has(cible),
    );
    const rangement = rangerDocument({
      estPreuve,
      domaineConnu: domaineConnu?.id,
      role: vue.frontMatter.role,
      competencesCitees,
    });
    // Une preuve garde le titre de l'exercice qui l'a produite ; à défaut, un
    // libellé lisible — jamais son identifiant technique.
    const titreAffiche =
      estPreuve && (!vue.titre || vue.titre === document.id) ? "Preuve de travail" : vue.titre;
    const toutesSortants = index.sortants.get(document.id) ?? [];
    const estArchiveParDomaine = domaineConnu ? Boolean(domaineConnu.archive) : false;
    const estArchiveParCompetences =
      toutesSortants.length > 0 &&
      toutesSortants.every((cible) => {
        const skill = referentiel.parCode.get(cible);
        return skill ? Boolean(skill.archive) : false;
      });
    const estArchive = Boolean(vue.frontMatter.archive) || estArchiveParDomaine || estArchiveParCompetences;

    return {
      id: document.id,
      titre: titreAffiche,
      type: vue.type ?? "document",
      typeLibelle: definition?.libelle ?? (estPreuve ? "Preuve" : vue.type ?? "Document"),
      categorie: definition?.categorie ?? (estPreuve ? "action" : "connaissance"),
      domaineId,
      rangement,
      contenuMd,
      contenuCharge: Boolean(contenuMd),
      updatedAt: contenuInitial?.id === document.id ? contenuInitial.updatedAt : document.updatedAt,
      schemaCompatible: vue.schemaCompatible,
      frontMatter: { ...vue.frontMatter, archive: estArchive },
      liens: document.liens,
      sortants: index.sortants.get(document.id) ?? [],
      entrants: index.entrants.get(document.id) ?? [],
      snapshots: snapshotsParDocument.get(document.id) ?? [],
      tentatives: [],
      source: "document",
      lectureSeule: documentEnLectureSeule({ id: document.id, type: vue.type }),
    };
  });

  const projectionsDomaines: ElementAtelier[] = vues.domaines
    .filter((vue) => domainesVisibles.has(vue.id) || vue.domaine.archive)
    .map((vue) => ({
    id: `domaine:${vue.id}`,
    titre: "Vue d’ensemble",
    type: "domaine",
    typeLibelle: "Domaine",
    categorie: "connaissance",
    domaineId: vue.id,
    rangement: rangementDomaine(vue.id),
    contenuMd: `# ${vue.nom}\n\n${vue.description}`,
    contenuCharge: true,
    frontMatter: { id: vue.id, type: "domaine" },
    liens: vue.competences.map(({ code }) => ({ cible: code })),
    sortants: vue.competences.map(({ code }) => code),
    entrants: [],
    snapshots: [],
    tentatives: [],
    source: "projection",
    lectureSeule: true,
    vuePedagogique: { ...vue, progression: progressionsDomaines[vue.id] },
    }));

  const competencesAtelier = referentiel.skills.filter((skill) =>
    referentiel.codesActifs.has(skill.code) || (domainesArchives.has(skill.domaine) && !skill.archive),
  );
  const projectionsCompetences: ElementAtelier[] = competencesAtelier.map((skill) => ({
    id: skill.code,
    titre: skill.intitule,
    type: "competence",
    typeLibelle: "Compétence",
    categorie: "action",
    domaineId: skill.domaine,
    rangement: rangementDomaine(skill.domaine),
    contenuMd: [
      `# ${skill.intitule}`,
      "",
      "> Projection en lecture seule du référentiel actuel.",
      "",
      `- Code : \`${skill.code}\``,
      `- Domaine : ${skill.domaine}`,
      `- Palier : ${skill.palier}`,
      skill.prerequis.length ? `- Prérequis : ${skill.prerequis.join(", ")}` : "",
    ].filter(Boolean).join("\n"),
    contenuCharge: true,
    frontMatter: {},
    liens: skill.prerequis.map((cible) => ({ cible })),
    sortants: skill.prerequis,
    entrants: [],
    snapshots: [],
    tentatives: [],
    source: "projection",
    lectureSeule: true,
    vuePedagogique: vuesCompetences.get(skill.code),
  }));

  /*
   * Un exercice qui a sa fiche n'est plus projeté.
   *
   * La projection est un pis-aller : elle montre un exercice que le corpus ne
   * contient pas encore. Dès qu'une fiche existe — écrite à la fin du premier
   * passage — la garder ferait deux entrées pour un même exercice dans l'arbre,
   * l'une annotable et l'autre non.
   */
  const exercicesAvecFiche = new Set(
    index.documents
      .map((document) => document.frontMatter.exercice)
      .filter((valeur): valeur is string => typeof valeur === "string"),
  );
  const projectionsExercices: ElementAtelier[] = [...exercicesVisibles, ...exercicesArchives]
    .filter((exercice) => !exercicesAvecFiche.has(exercice.id))
    .map((exercice) => ({
      id: `exercice:${exercice.id}`,
      titre: exercice.titre,
      type: "exercice",
      typeLibelle: "Exercice",
      categorie: "action",
      domaineId: exercice.domaine,
      rangement: rangementDomaine(exercice.domaine),
      contenuMd: [
        `# ${exercice.titre}`,
        "",
        "> Projection en lecture seule de l’exercice existant.",
        "",
        exercice.enonce,
      ].join("\n"),
      contenuCharge: true,
      frontMatter: {},
      liens: exercice.competences.map((cible) => ({ cible })),
      sortants: exercice.competences,
      entrants: [],
      snapshots: [],
      tentatives: tentativesParExercice.get(exercice.id) ?? [],
      source: "projection",
      lectureSeule: true,
      vuePedagogique: vuesExercices.get(exercice.id),
    }));

  const elementsAtelier = [
    ...projectionsDomaines,
    ...projectionsCompetences,
    ...projectionsExercices,
    ...documents,
  ];
  const cleAtelier = [
    documentDemande ?? "",
    creation ?? "",
    ...elementsAtelier.map(({ id, updatedAt }) => `${id}:${updatedAt ?? ""}`),
  ].join("|");

  /*
   * Le graphe est construit ici plutôt qu'en ligne dans le JSX : l'arbre teinte
   * ses fiches à partir du même ensemble de domaines que lui. Deux ensembles
   * différents donneraient deux palettes décalées pour un même domaine, et
   * l'utilisateur perdrait le repère qu'on vient de lui donner.
   */
  const graphe = construireGraphe(
    contexte.referentiel,
    contexte.etats,
    contexte.donnees.exercises,
    index,
  );
  const couleursDomaines = paletteDomaines(graphe.noeuds.map((noeud) => noeud.domaineId));

  /*
   * La carte des domaines — l'échelon au-dessus du graphe de compétences.
   * Construite ici pour la même raison que lui : un seul ensemble de domaines
   * alimente les deux échelles, donc une seule palette.
   */
  const grapheDomaines = construireGrapheDomaines(
    contexte.referentiel,
    contexte.etats,
    contexte.donnees.exercises,
  );

  return (
    <>
      <EntetePage
        titre="Mes cours"
        sousTitre="Vos cours, vos notes et vos travaux, rangés par sujet."
      />
      {/*
        La relecture du référentiel part ici quand il a bougé (ADR-108).

        Elle ne rend rien, n'affiche rien, et ne bloque rien : le lot attend au
        passage suivant, signalé par l'avis du tableau de bord. C'est la réponse
        retenue à la question ouverte n°1 de l'ADR — « à l'ouverture si périmé »,
        plutôt qu'après chaque commande (trop coûteux) ou sur bouton seul (ce qui
        ne serait plus « sans avoir rien à faire »).
      */}
      <RelectureAuChargement due={relectureDue} />
      <EspaceDocumentaire
        key={cleAtelier}
        elements={elementsAtelier}
        couleursDomaines={couleursDomaines}
        documentDemande={documentDemande}
        vueDemandee={modeProgressionDemande ? "progression" : undefined}
        graphe={{
          donnees: graphe,
          domaines: grapheDomaines,
          compteId: contexte.donnees.user.id,
        }}
        aClasser={vues.aClasser}
        generation={{
          competences: competencesPourModale(referentiel.actifs),
          calibrages: calibragesPourModale(referentiel.actifs, contexte.calibrations),
        }}
        donneesSeance={donneesSeance}
        domainesExistants={referentiel.domaines
          .filter((domaine) => !domaine.archive)
          .map(({ id, nom, prefixe }) => ({ id, nom, prefixe }))}
        creationInitiale={creation}
      />
    </>
  );
}
