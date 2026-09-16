import type { EntreeUsageDomaine } from "@/lib/domain/usage-domaine";
import { validerSelectionCompetencesClassement } from "./classement-ressources";

export type DomaineBrouillonClassement = null | { mode: "existant"; id: string } | {
  mode: "nouveau"; nom: string; parentId?: string; usage?: EntreeUsageDomaine;
};
export interface BrouillonClassementRessource {
  analyseId: string;
  domaine: DomaineBrouillonClassement;
  codes: string[];
  propositions: number[];
  modifieLe: string;
  origine: "personne";
}
export interface EntreeBrouillonClassement {
  documentId: string;
  updatedAtAttendu: string;
  analyseId: string;
  domaine: DomaineBrouillonClassement;
  codes: string[];
  propositions: number[];
}
const objet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const texte = (v: unknown, max = 200): v is string => typeof v === "string" && !!v.trim() && v.length <= max && !/[\r\n]/.test(v);

function validerContenu(v: Record<string, unknown>) {
  if (!texte(v.analyseId)) throw new Error("Analyse du brouillon invalide.");
  const selection = validerSelectionCompetencesClassement(v.codes, v.propositions);
  let domaine: DomaineBrouillonClassement;
  const d = v.domaine;
  if (d === null) domaine = null;
  else if (objet(d) && d.mode === "existant" && texte(d.id)) domaine = { mode: "existant", id: d.id };
  else if (objet(d) && d.mode === "nouveau" && texte(d.nom, 80) && (d.parentId === undefined || texte(d.parentId))) {
    let usage: EntreeUsageDomaine | undefined;
    if (d.usage !== undefined) {
      if (!objet(d.usage) || !["continu", "module"].includes(String(d.usage.type))) throw new Error("Usage du brouillon invalide.");
      if ([d.usage.anneeAcademique, d.usage.periode].some((x) => x !== undefined && (typeof x !== "string" || x.length > 100 || /[\r\n]/.test(x)))) throw new Error("Cadre académique du brouillon invalide.");
      // L'année peut manquer dans un brouillon ; seule la confirmation réclame un usage complet.
      usage = { type: String(d.usage.type), ...(typeof d.usage.anneeAcademique === "string" && d.usage.anneeAcademique.trim() ? { anneeAcademique: d.usage.anneeAcademique.trim() } : {}), ...(typeof d.usage.periode === "string" && d.usage.periode.trim() ? { periode: d.usage.periode.trim() } : {}) };
      if (usage.type !== "module" && (usage.anneeAcademique || usage.periode)) throw new Error("Le cadre académique est réservé à un module.");
    }
    domaine = { mode: "nouveau", nom: d.nom.trim(), ...(typeof d.parentId === "string" ? { parentId: d.parentId } : {}), ...(usage ? { usage } : {}) };
  } else throw new Error("Domaine du brouillon invalide.");
  return { analyseId: v.analyseId, domaine, ...selection };
}

export function validerEntreeBrouillonClassement(brut: unknown): EntreeBrouillonClassement {
  if (!objet(brut) || !texte(brut.documentId) || !texte(brut.updatedAtAttendu)) throw new Error("Brouillon de classement invalide.");
  return { documentId: brut.documentId, updatedAtAttendu: brut.updatedAtAttendu, ...validerContenu(brut) };
}

/** Format texte du frontmatter, indépendant de Buffer pour la lecture partagée. */
export function encoderBrouillonClassement(brouillon: BrouillonClassementRessource): string {
  return encodeURIComponent(JSON.stringify(brouillon));
}

export function lireBrouillonClassement(value: unknown): BrouillonClassementRessource | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  try {
    if (typeof value !== "string" || value.length > 25000) throw new Error();
    const v: unknown = JSON.parse(decodeURIComponent(value));
    if (!objet(v) || v.origine !== "personne" || !texte(v.modifieLe, 50) || !Number.isFinite(Date.parse(v.modifieLe))) throw new Error();
    return { ...validerContenu(v), modifieLe: v.modifieLe, origine: "personne" };
  } catch { throw new Error("Le brouillon de classement conservé est invalide. Il n'a pas été remplacé par la proposition de l'IA."); }
}
