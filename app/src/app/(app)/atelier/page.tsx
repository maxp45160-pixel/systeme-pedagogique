import { notFound } from "next/navigation";
import { EntetePage } from "@/components/layout/entete-page";
import { WorkspaceNoteOperationnelle } from "@/components/atelier/workspace-note-operationnelle";
import { EspaceDocumentaire, type ElementAtelier } from "@/components/atelier/espace-documentaire";
import { definitionTypeDocument } from "@/lib/documents/types-documents";
import { lireApercusDocuments, lireApercusSnapshots, lireDocument } from "@/lib/store/documents";
import { reconstruireIndexDepuisApercus } from "@/lib/documents/index";
import { analyserDocumentMarkdown } from "@/lib/documents/markdown";
import { regrouperTentativesParExercice } from "@/lib/documents/workspace";
import { chargerContexte } from "@/lib/store/context";
import { chargerThemes } from "@/lib/store/themes";
import { construireGraphe } from "@/lib/domain/graphe";
import { construireVuesAtelier } from "@/lib/documents/vue-atelier";
import { lireChangementsReferentiel } from "@/lib/store/referentiel";
import { calibragesPourModale, competencesPourModale } from "@/components/exercices/proprietes-generation";
import { cheminsDepuisDefinition } from "@/lib/documents/chemins-atelier";
import { paletteDomaines } from "@/lib/ui/couleurs-domaines";
import { chargerDonneesSeance } from "@/components/seances/donnees-seance";

const LIBELLES_PALIERS: Record<string, string> = {
  fondamentaux: "Fondamentaux",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

export default async function PageAtelier(props: {
  searchParams: Promise<{ document?: string; dossier?: string; mode?: string; note?: string }>;
}) {
  const { document: documentDemande, dossier: dossierDemande, mode, note } = await props.searchParams;

  /*
   * L'espace de travail d'une note opérationnelle occupe l'écran entier et n'a
   * besoin que de sa fiche. On coupe court avant le chargement du corpus, du
   * contexte et du graphe : les payer pour ne rien en afficher ralentirait
   * l'ouverture sans rien apporter.
   */
  if (note) {
    const fiche = await lireDocument(note).catch(() => null);
    if (!fiche) notFound();
    // Seule la branche « séance » a besoin du classement et du stock
    // d'exercices : les autres se composent d'elles-mêmes.
    const estSeance = analyserDocumentMarkdown(fiche.id, fiche.contenuMd).type === "seance";
    return (
      <WorkspaceNoteOperationnelle
        id={fiche.id}
        contenuInitial={fiche.contenuMd}
        updatedAtInitial={fiche.updatedAt}
        donneesSeance={estSeance ? await chargerDonneesSeance() : undefined}
      />
    );
  }

  const [aperçus, snapshots, contexte, themes, contenuInitial, changementsReferentiel, donneesSeance] = await Promise.all([
    lireApercusDocuments(),
    lireApercusSnapshots(),
    chargerContexte(),
    chargerThemes(),
    documentDemande ? lireDocument(documentDemande).catch(() => null) : Promise.resolve(null),
    lireChangementsReferentiel(),
    chargerDonneesSeance(),
  ]);
  const referentiel = contexte.referentiel;
  const exercices = contexte.donnees.exercises;
  const domainesVisibles = new Set(
    referentiel.domaines
      .filter(
        (domaine) =>
          !domaine.archive &&
          referentiel.skills.some((skill) => skill.domaine === domaine.id && !skill.archive),
      )
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
    ...themes.flatMap((theme) => theme.codes),
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
    contexte.preuvesEffectives,
    changementsReferentiel,
    codesAvecDependances,
    themes,
  );
  const vuesCompetences = new Map(vues.competences.map((vue) => [vue.code, vue]));
  const vuesThemes = new Map(vues.themes.map((vue) => [vue.id, vue]));
  const vuesExercices = new Map(vues.exercices.map((vue) => [vue.id, vue]));
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
    const cheminsParDefaut = cheminsDepuisDefinition(definition, vue.frontMatter);
    // `transversal` est une absence de domaine déclarée, pas un domaine.
    const domaineDeclare = vue.frontMatter.domaine ?? vue.frontMatter.domain;
    const domaineId =
      typeof domaineDeclare === "string" && domaineDeclare !== "transversal"
        ? domaineDeclare
        : undefined;
    /*
     * Une fiche qui déclare son domaine sans déclarer de rôle est une
     * production du système — la fiche d'un exercice mené, typiquement. Elle se
     * range dans son domaine, exactement là où la projection qu'elle remplace
     * se trouvait : on la cherchera à cet endroit, pas dans un dossier
     * transversal. Les notes capturées, elles, ont un rôle et gardent la racine
     * que leur donne `cheminsDepuisDefinition`.
     */
    const domaineConnu = domaineId ? referentiel.domainesParId.get(domaineId) : undefined;
    const chemins =
      domaineConnu && !vue.frontMatter.role && definition
        ? {
            dossier: `${domaineConnu.archive ? "Domaines archivés" : "Domaines"}/${domaineConnu.nom}/${definition.dossierParDefaut}`,
            dossiersSecondaires: [],
          }
        : cheminsParDefaut;
    return {
      id: document.id,
      titre: vue.titre,
      type: vue.type ?? "document",
      typeLibelle: definition?.libelle ?? vue.type ?? "Document",
      categorie: definition?.categorie ?? "connaissance",
      domaineId,
      dossier: chemins.dossier,
      dossiersSecondaires: chemins.dossiersSecondaires,
      contenuMd,
      contenuCharge: Boolean(contenuMd),
      updatedAt: contenuInitial?.id === document.id ? contenuInitial.updatedAt : document.updatedAt,
      schemaCompatible: vue.schemaCompatible,
      frontMatter: vue.frontMatter,
      liens: document.liens,
      sortants: index.sortants.get(document.id) ?? [],
      entrants: index.entrants.get(document.id) ?? [],
      snapshots: snapshotsParDocument.get(document.id) ?? [],
      tentatives: [],
      source: "document",
      lectureSeule: false,
    };
  });

  const projectionsThemes: ElementAtelier[] = themes
    .filter((theme) => !theme.archive)
    .map((theme) => ({
      id: `theme:${theme.id}`,
      titre: theme.libelle,
      type: "theme",
      typeLibelle: "Thème",
      categorie: "connaissance",
      dossier: "Transversal/Thèmes",
      contenuMd: [
        `# ${theme.libelle}`,
        "",
        "> Projection en lecture seule du thème enregistré.",
        "",
        theme.intention ? `> Intention : ${theme.intention}` : "",
        theme.codes.length ? "## Compétences couvertes" : "",
        ...theme.codes.map((code) => `- [[${code}]]`),
      ].filter(Boolean).join("\n"),
      contenuCharge: true,
      frontMatter: {},
      liens: theme.codes.map((cible) => ({ cible })),
      sortants: theme.codes,
      entrants: [],
      snapshots: [],
      tentatives: [],
      source: "projection",
      lectureSeule: true,
      vuePedagogique: vuesThemes.get(theme.id),
    }));

  const projectionsDomaines: ElementAtelier[] = vues.domaines
    .filter((vue) => domainesVisibles.has(vue.id) || vue.domaine.archive)
    .map((vue) => ({
    id: `domaine:${vue.id}`,
    titre: "Vue d’ensemble",
    type: "domaine",
    typeLibelle: "Domaine",
    categorie: "connaissance",
    domaineId: vue.id,
    dossier: vue.domaine.archive ? `Domaines archivés/${vue.nom}` : `Domaines/${vue.nom}`,
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
    vuePedagogique: vue,
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
    dossier: `${domainesArchives.has(skill.domaine) ? "Domaines archivés" : "Domaines"}/${referentiel.domainesParId.get(skill.domaine)?.nom ?? skill.domaine}/Compétences/${LIBELLES_PALIERS[skill.palier] ?? skill.palier}`,
    dossiersSecondaires: domainesArchives.has(skill.domaine) ? [] : ["Transversal/Compétences"],
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
      dossier: `${domainesArchives.has(exercice.domaine) ? "Domaines archivés" : "Domaines"}/${referentiel.domainesParId.get(exercice.domaine)?.nom ?? exercice.domaine}/Exercices`,
      dossiersSecondaires: domainesArchives.has(exercice.domaine) ? [] : ["Transversal/Exercices"],
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
    ...projectionsThemes,
  ];
  const cleAtelier = [
    documentDemande ?? "",
    dossierDemande ?? "",
    mode ?? "",
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
    themes,
    index,
  );
  const couleursDomaines = paletteDomaines(graphe.noeuds.map((noeud) => noeud.domaineId));

  return (
    <>
      <EntetePage
        titre="Atelier"
        sousTitre="Un corpus documentaire relié à tes compétences, tes productions et tes preuves."
      />
      <EspaceDocumentaire
        key={cleAtelier}
        elements={elementsAtelier}
        couleursDomaines={couleursDomaines}
        documentDemande={documentDemande}
        dossierDemande={dossierDemande}
        modeInitial={mode === "referentiel" ? "referentiel" : undefined}
        graphe={{
          donnees: graphe,
          compteId: contexte.donnees.user.id,
        }}
        generation={{
          competences: competencesPourModale(referentiel.actifs),
          calibrages: calibragesPourModale(referentiel.actifs, contexte.calibrations),
        }}
        rectificationActive={contexte.donnees.user.learningLoopMode === "adaptive-v1"}
        donneesSeance={donneesSeance}
      />
    </>
  );
}
