"use server";

/**
 * Export du journal complet, tel qu'il est réellement stocké.
 *
 * Depuis que les comptes existent, la base Supabase est la source de vérité et
 * le dépôt git ne transporte plus les données : il faut donc un moyen de
 * récupérer une copie hors ligne sans dépendre de l'hébergeur.
 *
 * L'export lit par `lireTout()`, donc par la dorsale unique : il photographie
 * ce que l'utilisateur voit, pas une couche de stockage particulière.
 */

import { lireTout } from "./db";
import { compteCourant } from "@/lib/supabase/server";

/** Version du format, pour qu'une archive ancienne reste interprétable. */
const FORMAT = 1;

export interface Archive {
  format: number;
  exporteLe: string;
  origine: { type: "compte"; courriel: string | null };
  /** Nombre d'éléments par collection — permet de vérifier une archive d'un coup d'œil. */
  effectifs: Record<string, number>;
  donnees: Awaited<ReturnType<typeof lireTout>>;
}

export async function exporterJournal(): Promise<Archive> {
  const [compte, donnees] = await Promise.all([compteCourant(), lireTout()]);

  const effectifs: Record<string, number> = {};
  for (const [nom, valeur] of Object.entries(donnees)) {
    if (Array.isArray(valeur)) effectifs[nom] = valeur.length;
  }

  return {
    format: FORMAT,
    exporteLe: new Date().toISOString(),
    origine: { type: "compte", courriel: compte?.email ?? null },
    effectifs,
    donnees,
  };
}
