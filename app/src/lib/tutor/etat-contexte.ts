import type { SectionContexte } from "@/lib/tutor/contexte";

/**
 * État du contexte pédagogique, assemblé par le serveur et reçu en props.
 *
 * Il était auparavant récupéré au montage par un `fetch("/api/tutor")`, ce qui
 * refaisait — dans une requête HTTP distincte, donc hors du `cache()` de React
 * — le `chargerContexte()` que la page venait déjà de payer.
 */
export interface EtatContexteTuteur {
  cleConfiguree: boolean;
  modele: string;
  manifeste: SectionContexte[];
  caracteresTotal: number;
}
