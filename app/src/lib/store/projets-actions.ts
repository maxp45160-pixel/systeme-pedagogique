"use server";

/**
 * Ouverture d'un projet composé explicitement.
 *
 * Le reste du cycle — démarrer, sauvegarder, jalonner, soumettre, abandonner —
 * vit dans `adaptive-actions.ts` et sert les trois familles. Seule l'ouverture
 * est propre au projet : c'est elle qui n'existait pas, la boucle ne sachant
 * proposer un projet que de sa propre initiative.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dorsaleCompte, nouvelId } from "./db";
import { verifier } from "./supabase-backend";
import { chargerContexte } from "./context";
import { parseLearningActivity, type LearningActivity } from "@/lib/domain/adaptive-learning";
import {
  criteresProjet,
  parseCompositionProjet,
  segmentProjet,
} from "@/lib/domain/composition-projet";
import { parsePropositionContenuActivite } from "@/lib/tutor/outils";
import { creerDepuisTemplate } from "@/lib/documents/markdown";
import { creerDocument } from "./documents";

function texte(formData: FormData, cle: string): string {
  const valeur = formData.get(cle);
  return typeof valeur === "string" ? valeur.trim() : "";
}

export async function ouvrirProjetCompose(formData: FormData): Promise<void> {
  const requestId = texte(formData, "requestId");
  if (!requestId) throw new Error("Ouverture de projet incomplète.");

  const { supabase, userId } = await dorsaleCompte();
  const ctx = await chargerContexte();

  /*
   * La composition est relue côté serveur, jamais reprise du client tel quel :
   * les codes doivent appartenir au référentiel du compte, et les critères sont
   * recalculés ici. Le formulaire ne transporte que des déclarations.
   */
  const composition = parseCompositionProjet(
    {
      skillCodes: formData.getAll("skillCodes").filter((v): v is string => typeof v === "string"),
      objectif: texte(formData, "objectif"),
      dureeMin: Number(texte(formData, "dureeMin")),
      capacite: texte(formData, "capacite"),
      visee: texte(formData, "visee"),
      contraintes: texte(formData, "contraintes")
        .split("\n")
        .map((ligne) => ligne.trim())
        .filter(Boolean),
    },
    new Set(ctx.referentiel.parCode.keys()),
  );

  let brut: unknown;
  try {
    brut = JSON.parse(texte(formData, "proposition"));
  } catch {
    throw new Error("Proposition illisible.");
  }
  const proposition = parsePropositionContenuActivite(brut, "produire");
  if (!proposition || proposition.famille !== "produire") {
    throw new Error("La proposition ne respecte plus le schéma fermé.");
  }

  const competences = composition.skillCodes.map((code) => {
    const skill = ctx.referentiel.parCode.get(code)!;
    return { code: skill.code, intitule: skill.intitule };
  });
  const maintenant = new Date().toISOString();
  const activityId = nouvelId("activity");
  const runId = nouvelId("run");

  /*
   * L'activité est validée par le domaine avant d'atteindre la base : c'est là
   * que le rattachement critère → compétence est vérifié (ADR-068). La garde
   * SQL le revérifiera à la clôture ; les deux sont volontairement redondantes.
   */
  const activite = parseLearningActivity({
    id: activityId,
    accountId: userId,
    title: proposition.titre,
    description: proposition.description,
    family: "produire",
    target: {
      skillCodes: composition.skillCodes,
      themeIds: [],
      goalIds: [],
      label: composition.objectif,
    },
    estimatedDurationMinutes: composition.dureeMin,
    minimumSegmentMinutes: segmentProjet(composition.dureeMin),
    cognitiveDemand: composition.capacite,
    proofMode: "soumission-finale",
    workspace: "mini-projet",
    requiredTools: ["editeur-markdown", "liens"],
    authorizedResources: [],
    evaluationContract: {
      scope: "soumission-finale",
      criteria: criteresProjet(competences, composition.visee),
      assessableMilestoneIds: [],
    },
    workspaceContent: {
      family: "produire",
      brief: proposition.brief,
      start: proposition.workspace.demarrage,
      artifactSections: proposition.workspace.canevasArtefact.map((section) => ({
        section: section.section,
        instruction: section.consigne,
      })),
      advice: proposition.workspace.conseilsRealisation,
      submissionInstruction: proposition.workspace.consigneSoumission,
      milestones: proposition.jalons.map((jalon, index) => ({
        id: `milestone-${index + 1}`,
        title: jalon.titre,
        instruction: jalon.consigne,
        expectedResult: jalon.resultatAttendu,
      })),
    },
    version: 1,
    origin: "tuteur",
    status: "active",
    createdAt: maintenant,
    updatedAt: maintenant,
  });

  const { data, error } = await supabase.rpc("accepter_activite_generee", {
    p_request_id: requestId,
    p_payload: {
      activity: {
        id: activite.id,
        version: activite.version,
        title: activite.title,
        description: activite.description,
        family: activite.family,
        target: activite.target,
        estimatedDurationMinutes: activite.estimatedDurationMinutes,
        minimumSegmentMinutes: activite.minimumSegmentMinutes,
        cognitiveDemand: activite.cognitiveDemand,
        proofMode: activite.proofMode,
        workspace: activite.workspace,
        requiredTools: activite.requiredTools,
        authorizedResources: activite.authorizedResources,
        evaluationContract: activite.evaluationContract,
        workspaceContent: activite.workspaceContent,
      },
      run: { id: runId, status: "planifiee" },
    },
  });
  verifier("ouverture transactionnelle du projet", error);

  const resultat = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : null;
  const runOuvert = typeof resultat?.runId === "string" ? resultat.runId : runId;

  /*
   * La fiche est la maison du projet.
   *
   * L'exécution porte le contrat, les événements et la preuve ; la fiche porte
   * le suivi, et c'est depuis l'Atelier qu'on pilote. Elle référence son
   * exécution en front-matter (`projet_run`), ce qui permet d'y rouvrir
   * l'espace de production sans dupliquer quoi que ce soit du contrat.
   */
  const documentId = nouvelId("doc");
  const squelette = creerDepuisTemplate("projet", documentId, activite.title, undefined, {
    role: "operationnel",
    contexte: composition.objectif.slice(0, 200),
    domaine: "transversal",
    projet_run: runOuvert,
  });
  await creerDocument(documentId, remplirFicheProjet(squelette, activite, runOuvert, competences));

  revalidatePath("/atelier");
  redirect(`/atelier?note=${encodeURIComponent(documentId)}`);
}

/**
 * L'énoncé du projet, écrit dans la fiche.
 *
 * Le sujet, les étapes et les critères existent déjà quand le projet s'ouvre.
 * Les laisser dans la seule exécution donnait une fiche à trois zones vides :
 * on y arrivait sans savoir ce qu'il y avait à faire. Ils sont donc inscrits
 * dans les sections que le type déclare, en Markdown ordinaire — la fiche
 * exportée se lit sans l'application.
 */
function remplirFicheProjet(
  squelette: string,
  activite: LearningActivity,
  runId: string,
  competences: readonly { code: string; intitule: string }[],
): string {
  const contenu = activite.workspaceContent;
  const jalons = contenu?.family === "produire" ? contenu.milestones : [];
  const sections = contenu?.family === "produire" ? contenu.artifactSections : [];

  const enonce = [
    contenu?.brief ?? activite.description,
    "",
    `*Durée estimée : ${activite.estimatedDurationMinutes} min, reprenable par segments de ${activite.minimumSegmentMinutes ?? 20} min.*`,
    "",
    "**Compétences visées**",
    "",
    ...competences.map(({ code, intitule }) => `- [[${code}]] — ${intitule}`),
    "",
    `[▶ Ouvrir l'espace de production](/projets?run=${encodeURIComponent(runId)})`,
  ].join("\n");

  const etapes = (jalons.length > 0
    ? jalons.flatMap((jalon, index) => [
      `${index + 1}. **${jalon.title}** — ${jalon.instruction}`,
      `   *Attendu :* ${jalon.expectedResult}`,
    ])
    : ["*Aucune étape n'a été proposée pour ce projet.*"]).join("\n");

  const criteres = [
    ...(sections.length > 0
      ? ["**Sections attendues du rendu**", "", ...sections.map((s) => `- **${s.section}** — ${s.instruction}`), ""]
      : []),
    "**Critères d'évaluation**",
    "",
    ...activite.evaluationContract.criteria.map((critere) => `- [[${critere.skillCode}]] — ${critere.label}`),
    "",
    "> Une compétence qu'aucun critère démontré ne porte ne reçoit aucune preuve.",
  ].join("\n");

  return remplacerSection(
    remplacerSection(remplacerSection(squelette, "Énoncé", enonce), "Étapes", etapes),
    "Critères d'évaluation",
    criteres,
  );
}

/** Écrit sous un titre de section existant, sans toucher aux autres. */
function remplacerSection(markdown: string, titre: string, contenu: string): string {
  const entete = `## ${titre}`;
  const debut = markdown.indexOf(entete);
  if (debut === -1) return markdown;
  const apres = debut + entete.length;
  const suivante = markdown.indexOf("\n## ", apres);
  const fin = suivante === -1 ? markdown.length : suivante;
  return `${markdown.slice(0, apres)}\n\n${contenu}\n${markdown.slice(fin)}`;
}
