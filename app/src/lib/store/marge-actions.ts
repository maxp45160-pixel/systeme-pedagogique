"use server";

/**
 * Écritures de la marge du cahier.
 *
 * La marge est un document du corpus (`lib/documents/marge.ts`) : ces fonctions
 * ne font que le lire, appliquer une transformation pure, et le réécrire. Toute
 * la logique de format vit dans le module de domaine, testé sans base.
 *
 * Comme partout ici : `dorsaleCompte()` redirige sans session, RLS reste la
 * barrière d'autorisation (ADR-015), et chaque écriture appelle
 * `revalidatePath("/", "layout")` (ADR-024) — `modifierDocument` ne revalide que
 * l'Atelier, or la marge s'affiche aussi dans le cahier et le workspace.
 *
 * La lecture vit dans `marge.ts`, qui n'est pas `"use server"` : elle n'a aucune
 * raison d'être exposée comme Server Action appelable depuis le client.
 */

import { revalidatePath } from "next/cache";
import { creerDocument, modifierDocument } from "./documents";
import { lireContenuMarge } from "./marge";
import {
  ajouterLigneMarge,
  analyserMarge,
  basculerLigneMarge,
  documentMargeInitial,
  ecrireMarge,
  ID_MARGE,
  motifRefusLigneMarge,
  retirerLigneMarge,
  type LigneMarge,
} from "@/lib/documents/marge";

/** Applique une transformation pure au document, en le créant si besoin. */
async function ecrireLignes(
  transformer: (lignes: LigneMarge[]) => LigneMarge[],
): Promise<void> {
  const existant = await lireContenuMarge();
  const base = existant ?? documentMargeInitial();
  const suivant = ecrireMarge(base, transformer(analyserMarge(base)));

  if (existant === null) await creerDocument(ID_MARGE, suivant);
  else if (suivant !== existant) await modifierDocument(ID_MARGE, suivant);

  revalidatePath("/", "layout");
}

/** Appelée par `<form action={noterDansLaMarge}>`. */
export async function noterDansLaMarge(formData: FormData): Promise<void> {
  const texte = String(formData.get("ligne") ?? "");
  // La même validation que l'écran : une seule autorité, sinon on ferait entrer
  // par le serveur ce que le formulaire refuse (ADR-047).
  const refus = motifRefusLigneMarge(texte);
  if (refus) throw new Error(refus);
  await ecrireLignes((lignes) => ajouterLigneMarge(lignes, texte));
}

export async function basculerLigneMargeAction(index: number): Promise<void> {
  await ecrireLignes((lignes) => basculerLigneMarge(lignes, index));
}

export async function retirerLigneMargeAction(index: number): Promise<void> {
  await ecrireLignes((lignes) => retirerLigneMarge(lignes, index));
}
