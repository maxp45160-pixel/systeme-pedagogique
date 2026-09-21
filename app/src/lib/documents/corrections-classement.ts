import { composerIntitule, motifsNonAtomique, motifsRefusStructure, type IntituleStructure, type VerbeAction } from "@/lib/domain/atomicite";
import { MAX_COMPETENCES_ORGANISATION_DEPOT, type CompetenceProposeeDepot } from "./depot";

/** Déclaration humaine attachée à un indice de l'analyse, jamais une réécriture de sa source. */
export interface CorrectionCompetenceClassement extends IntituleStructure {
  indice: number;
}

export function validerCorrectionsClassement(brut: unknown): CorrectionCompetenceClassement[] {
  if (brut === undefined) return [];
  if (!Array.isArray(brut) || brut.length > MAX_COMPETENCES_ORGANISATION_DEPOT) throw new Error("Corrections de compétences invalides.");
  const indices = new Set<number>();
  const corrections = brut.map((v: unknown) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Correction de compétence invalide.");
    const c = v as Record<string, unknown>;
    if (Object.keys(c).some((cle) => !["indice", "verbeAction", "objet", "precision"].includes(cle))
      || typeof c.indice !== "number" || !Number.isInteger(c.indice) || c.indice < 0 || c.indice >= MAX_COMPETENCES_ORGANISATION_DEPOT
      || typeof c.verbeAction !== "string" || typeof c.objet !== "string" || (c.precision !== undefined && typeof c.precision !== "string")
      || [c.verbeAction, c.objet, c.precision].some((s) => typeof s === "string" && /[\r\n\x00-\x1f]/.test(s))) throw new Error("Correction de compétence invalide : seuls le geste, l'objet et la précision sont modifiables.");
    if (indices.has(c.indice)) throw new Error("Une proposition ne peut pas recevoir plusieurs corrections.");
    indices.add(c.indice);
    const correction: CorrectionCompetenceClassement = {
      indice: c.indice, verbeAction: c.verbeAction.trim().toLocaleLowerCase("fr-FR"), objet: c.objet.trim(),
      ...(typeof c.precision === "string" && c.precision.trim() ? { precision: c.precision.trim() } : {}),
    };
    const motifs = [...motifsRefusStructure(correction), ...motifsNonAtomique(composerIntitule(correction)).map((m) => m.message)];
    if (motifs.length) throw new Error(`Intitulé corrigé invalide : ${motifs.join(" ")}`);
    return correction;
  });
  return corrections.sort((a, b) => a.indice - b.indice);
}

/** Les corrections décochées restent disponibles dans le brouillon, sans être créées. */
export function appliquerCorrectionsClassement(
  propositions: readonly CompetenceProposeeDepot[],
  corrections: readonly CorrectionCompetenceClassement[] = [],
): CompetenceProposeeDepot[] {
  const parIndice = new Map(corrections.map((c) => [c.indice, c]));
  for (const { indice } of corrections) {
    if (propositions[indice]?.mode !== "nouvelle") throw new Error("Une correction ne désigne pas une proposition nouvelle de cette analyse.");
  }
  return propositions.map((p, indice) => {
    const c = parIndice.get(indice);
    if (!c || p.mode !== "nouvelle") return p;
    return { ...p, verbeAction: c.verbeAction as VerbeAction, objet: c.objet, precision: c.precision, intitule: composerIntitule(c) };
  });
}
