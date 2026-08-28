import { cleParCompte, ecrireLocal, lireLocal } from "./stockage-local";
import { ETAPES_CONTEXTE, type EtapeContexte } from "@/lib/domain/contexte-orchestration";

const USAGE = "assistant-preparer-periode-v1";

export interface EtatAssistantContexte {
  version: 1;
  etapesAcquittees: EtapeContexte[];
}

const ETAT_INITIAL: EtatAssistantContexte = { version: 1, etapesAcquittees: [] };

export function cleAssistantContexte(compteId: string): string {
  return cleParCompte(USAGE, compteId);
}

export function lireEtatAssistantContexte(compteId: string): EtatAssistantContexte {
  const brut = lireLocal<unknown>(cleAssistantContexte(compteId));
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return ETAT_INITIAL;
  const valeur = brut as Record<string, unknown>;
  if (valeur.version !== 1 || !Array.isArray(valeur.etapesAcquittees)) return ETAT_INITIAL;
  const etapesAcquittees = valeur.etapesAcquittees.filter(
    (etape): etape is EtapeContexte => typeof etape === "string" && ETAPES_CONTEXTE.includes(etape as EtapeContexte),
  );
  return { version: 1, etapesAcquittees: [...new Set(etapesAcquittees)] };
}

export function acquitterEtapeAssistantContexte(compteId: string, etape: EtapeContexte): EtatAssistantContexte {
  const actuel = lireEtatAssistantContexte(compteId);
  const prochain: EtatAssistantContexte = {
    version: 1,
    etapesAcquittees: actuel.etapesAcquittees.includes(etape)
      ? actuel.etapesAcquittees
      : [...actuel.etapesAcquittees, etape],
  };
  ecrireLocal(cleAssistantContexte(compteId), prochain);
  return prochain;
}
