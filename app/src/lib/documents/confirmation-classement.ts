import { Buffer } from "node:buffer";
import { validerCorrectionsClassement, type CorrectionCompetenceClassement } from "./corrections-classement";

export interface ConfirmationClassement {
  cle: string;
  base: string;
  analyseId: string;
  terminee: boolean;
  tentativeId?: string;
  domaineId?: string;
  codes?: string[];
  choixPrealable?: string;
  corrections?: CorrectionCompetenceClassement[];
}

/** Lecture unique du reçu serveur, pour sa reprise et les corrections montrées à la personne. */
export function lireConfirmationClassement(v: unknown): ConfirmationClassement | null {
  if (v === undefined || v === null || v === "") return null;
  try {
    if (typeof v !== "string" || v.length > 30000 || !/^[A-Za-z0-9_-]+$/.test(v)) throw new Error();
    const c = JSON.parse(Buffer.from(v, "base64url").toString("utf8"));
    const texte = (s: unknown): s is string => typeof s === "string" && !!s.trim() && s.length <= 200 && !/[\r\n]/.test(s);
    const hash = (s: unknown): s is string => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
    if (!c || typeof c !== "object" || Array.isArray(c) || !hash(c.cle) || !hash(c.base) || !texte(c.analyseId) || typeof c.terminee !== "boolean"
      || (c.choixPrealable !== undefined && !hash(c.choixPrealable)) || (c.tentativeId !== undefined && !texte(c.tentativeId))
      || (c.domaineId !== undefined && !texte(c.domaineId)) || (c.codes !== undefined && (!Array.isArray(c.codes) || !c.codes.every(texte)))) throw new Error();
    const corrections = validerCorrectionsClassement(c.corrections);
    return {
      cle: c.cle, base: c.base, analyseId: c.analyseId, terminee: c.terminee,
      ...(c.choixPrealable !== undefined ? { choixPrealable: c.choixPrealable } : {}),
      ...(c.tentativeId !== undefined ? { tentativeId: c.tentativeId } : {}),
      ...(c.domaineId !== undefined ? { domaineId: c.domaineId } : {}),
      ...(c.codes !== undefined ? { codes: c.codes } : {}),
      ...(corrections.length ? { corrections } : {}),
    };
  } catch { throw new Error("La confirmation de classement conservée est invalide. Les corrections humaines n'ont pas été remplacées par la proposition de l'IA."); }
}
