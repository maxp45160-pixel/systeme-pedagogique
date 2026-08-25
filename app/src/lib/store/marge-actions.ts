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
import { joursEntre } from "@/lib/engine/dates";

/** Applique une transformation pure au document, en le créant si besoin. */
async function ecrireLignes(
  transformer: (lignes: LigneMarge[]) => LigneMarge[],
): Promise<void> {
  const existant = await lireContenuMarge();
  const base = existant ?? documentMargeInitial();
  const suivant = ecrireMarge(base, transformer(analyserMarge(base)));

  if (existant === null) await creerDocument(ID_MARGE, suivant);
  else if (suivant !== existant) await modifierDocument(ID_MARGE, suivant);

  revalidatePath("/seances");
  revalidatePath("/atelier");
  revalidatePath("/");
}

/**
 * Le jour civil que le formulaire déclare pour sa note, ou `null`.
 *
 * Le navigateur connaît le jour de la personne ; le serveur, non — en
 * production il vit en UTC, et autour de minuit européen il aurait daté la
 * note du mauvais jour. Le formulaire porte donc un champ `jour` calculé côté
 * client. Côté serveur on borne l'écart à un jour de part et d'autre : assez
 * large pour tout fuseau réel (UTC−12 → UTC+14), trop étroit pour dater une
 * note d'une semaine passée. Sans champ — anciens liens, surfaces qui ne le
 * portent pas encore — repli sur le jour du serveur, comportement antérieur.
 *
 * Format refusé plutôt que rabattu : une valeur présente mais invalide est un
 * signe qu'on ne comprend pas, pas une absence (P2).
 */
function jourDeclare(formData: FormData): string | null {
  const brut = formData.get("jour");
  if (brut === null) return null;
  const jour = String(brut);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) {
    throw new Error("Le jour de la note est mal formé : AAAA-MM-JJ attendu.");
  }
  const ecart = joursEntre(jour, new Date());
  if (!Number.isFinite(ecart) || Math.abs(ecart) > 1) {
    throw new Error(
      "Une note se date du jour où elle est écrite : elle ne peut pas porter sur un autre jour.",
    );
  }
  return jour;
}

/** Appelée par `<form action={noterDansLaMarge}>`. */
export async function noterDansLaMarge(formData: FormData): Promise<void> {
  const texte = String(formData.get("ligne") ?? "");
  // La même validation que l'écran : une seule autorité, sinon on ferait entrer
  // par le serveur ce que le formulaire refuse (ADR-047).
  const refus = motifRefusLigneMarge(texte);
  if (refus) throw new Error(refus);
  await ecrireLignes((lignes) =>
    ajouterLigneMarge(lignes, texte, jourDeclare(formData) ?? undefined),
  );
}

export async function basculerLigneMargeAction(index: number): Promise<void> {
  await ecrireLignes((lignes) => basculerLigneMarge(lignes, index));
}

export async function retirerLigneMargeAction(index: number): Promise<void> {
  await ecrireLignes((lignes) => retirerLigneMarge(lignes, index));
}
