import { prefixeParDefaut, slugifier } from "@/lib/domain/referentiel-compte";
import type { Referentiel } from "@/lib/domain/types";

/** Réservation documentaire ; seul referentiel_changes prouve la création SQL. */
export interface CreationDomaineDeleguee {
  version: 1;
  cle: string;
  compteId: string;
  documentId: string;
  analyseId: string;
  domaineId: string;
  nom: string;
  statut: "reservee" | "cree";
}

export function encoderCreationDomaineDeleguee(recu: CreationDomaineDeleguee): string {
  return encodeURIComponent(JSON.stringify(recu));
}

export function lireCreationDomaineDeleguee(value: unknown): CreationDomaineDeleguee | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  try {
    if (typeof value !== "string" || value.length > 6000) throw new Error();
    const v = JSON.parse(decodeURIComponent(value));
    const texte = (s: unknown, max = 200): s is string => typeof s === "string" && s === s.trim() && !!s && s.length <= max && !/[\r\n]/.test(s);
    if (!v || typeof v !== "object" || Array.isArray(v) || v.version !== 1
      || typeof v.cle !== "string" || !/^[a-f0-9]{64}$/.test(v.cle)
      || ![v.compteId, v.documentId, v.analyseId, v.domaineId].every((s) => texte(s))
      || !texte(v.nom, 80) || v.nom.length < 3 || slugifier(v.nom) !== v.domaineId
      || !["reservee", "cree"].includes(v.statut)) throw new Error();
    return { version: 1, cle: v.cle, compteId: v.compteId, documentId: v.documentId, analyseId: v.analyseId, domaineId: v.domaineId, nom: v.nom, statut: v.statut };
  } catch { throw new Error("La trace de création déléguée est invalide. Votre document reste conservé ; contrôlez son rangement."); }
}

/** Archives comprises : aucune fusion implicite, aucun code de compétence émis. */
export function prefixeCreationDeleguee(nom: string, referentiel: Referentiel): string {
  const comparable = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");
  if (referentiel.domaines.some((d) => d.id === slugifier(nom) || comparable(d.nom) === comparable(nom))) {
    throw new Error("Un domaine porte déjà ce nom ou cet identifiant, y compris dans les archives. Contrôlez le rangement.");
  }
  const prefixe = prefixeParDefaut(nom);
  if (!/^[A-Z]{2,5}$/.test(prefixe)) throw new Error("Le nom proposé ne permet pas de préparer ce domaine. Contrôlez le rangement.");
  if (referentiel.domaines.some((d) => d.prefixe === prefixe)) {
    throw new Error("Le préfixe de ce domaine est déjà utilisé. Contrôlez le rangement.");
  }
  return prefixe;
}
