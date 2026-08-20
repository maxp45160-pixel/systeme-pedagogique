"use server";

/**
 * Ouverture d'un projet composé explicitement.
 *
 * ## Ce qui a changé le 15/08/2026 (ADR-070)
 *
 * Un projet ouvrait auparavant une `LearningActivity` et un `ActivityRun` dans
 * sept tables dédiées, avec commande transactionnelle, versionnement optimiste
 * et snapshots d'artefacts — puis écrivait *en plus* une fiche dans l'Atelier.
 * La fiche portait déjà l'énoncé, les étapes et les critères ; l'exécution
 * portait le contrat et une observation qui n'a jamais été produite.
 *
 * **La fiche suffit.** Un projet est une note opérationnelle de type `projet`,
 * exactement comme une séance est une note opérationnelle de type `seance` : le
 * type documentaire déclare déjà ses sections, `WorkspaceNoteOperationnelle`
 * sait déjà l'ouvrir en plein écran, et l'Atelier la range sans rien apprendre
 * de nouveau. Zéro table.
 *
 * Ce que cette version ne fait pas, et l'assume : elle ne transforme pas un
 * projet en observation. Le contrat d'évaluation reste écrit dans la fiche, lisible,
 * mais aucune mesure n'en est dérivée. Cette question se tranchera quand un
 * projet aura été mené jusqu'au bout au moins une fois — pas avant.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nouvelId } from "./db";
import { chargerContexte } from "./context";
import {
  criteresProjet,
  parseCompositionProjet,
  segmentProjet,
  type CompetenceCiblee,
  type CompositionProjet,
} from "@/lib/domain/composition-projet";
import { parsePropositionContenuActivite } from "@/lib/tutor/outils";
import { creerDepuisTemplate } from "@/lib/documents/markdown";
import { creerDocument } from "./documents";

function texte(formData: FormData, cle: string): string {
  const valeur = formData.get(cle);
  return typeof valeur === "string" ? valeur.trim() : "";
}

export async function ouvrirProjetCompose(formData: FormData): Promise<void> {
  const ctx = await chargerContexte();

  /*
   * La composition est relue côté serveur, jamais reprise du client telle
   * quelle : les codes doivent appartenir au référentiel du compte, et les
   * critères sont recalculés ici. Le formulaire ne transporte que des
   * déclarations.
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

  const competences: CompetenceCiblee[] = composition.skillCodes.map((code) => {
    const skill = ctx.referentiel.parCode.get(code)!;
    return { code: skill.code, intitule: skill.intitule };
  });

  /*
   * Le front-matter porte la composition, pas ses conséquences.
   *
   * `visee` et les codes suffisent à recalculer les critères à tout moment
   * (`criteresProjet` est pure) : les stocker en double serait stocker du
   * dérivable. Ils sont écrits en clair dans la section « Critères » pour être
   * lus, pas pour être relus par le moteur.
   */
  const documentId = nouvelId("doc");
  const squelette = creerDepuisTemplate("projet", documentId, proposition.titre, undefined, {
    role: "operationnel",
    contexte: composition.objectif.slice(0, 200),
    domaine: "transversal",
    projet_visee: composition.visee,
    projet_duree_min: String(composition.dureeMin),
    projet_competences: composition.skillCodes.join(", "),
  });
  await creerDocument(documentId, remplirFicheProjet(squelette, proposition, composition, competences));

  revalidatePath("/atelier");
  redirect(`/atelier?note=${encodeURIComponent(documentId)}`);
}

/**
 * L'énoncé du projet, écrit dans la fiche.
 *
 * Le sujet, les étapes et les critères existent déjà quand le projet s'ouvre.
 * Les laisser ailleurs donnait une fiche à trois zones vides : on y arrivait
 * sans savoir ce qu'il y avait à faire. Ils sont donc inscrits dans les
 * sections que le type déclare, en Markdown ordinaire — la fiche exportée se
 * lit sans l'application.
 */
function remplirFicheProjet(
  squelette: string,
  proposition: Extract<ReturnType<typeof parsePropositionContenuActivite>, { famille: "produire" }>,
  composition: CompositionProjet,
  competences: readonly CompetenceCiblee[],
): string {
  const enonce = [
    proposition.brief,
    "",
    `*Durée estimée : ${composition.dureeMin} min, reprenable par segments de ${segmentProjet(composition.dureeMin)} min.*`,
    "",
    "**Compétences visées**",
    "",
    ...competences.map(({ code, intitule }) => `- [[${code}]] — ${intitule}`),
  ].join("\n");

  const jalons = proposition.jalons;
  const etapes = (jalons.length > 0
    ? jalons.flatMap((jalon, index) => [
      `${index + 1}. **${jalon.titre}** — ${jalon.consigne}`,
      `   *Attendu :* ${jalon.resultatAttendu}`,
    ])
    : ["*Aucune étape n'a été proposée pour ce projet.*"]).join("\n");

  const sections = proposition.workspace.canevasArtefact;
  const criteres = [
    ...(sections.length > 0
      ? ["**Sections attendues du rendu**", "", ...sections.map((s) => `- **${s.section}** — ${s.consigne}`), ""]
      : []),
    "**Critères d'évaluation**",
    "",
    ...criteresProjet(competences, composition.visee).map(
      (critere) => `- [[${critere.skillCode}]] — ${critere.label}`,
    ),
    "",
    "> Ces critères se lisent : ils ne produisent aucune mesure automatique.",
    "> Ce que le travail démontre reste à établir à la relecture.",
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
