"use server";

/**
 * L'application d'un ajustement du moteur — ADR-085.
 *
 * La proposition est **recalculée côté serveur** avant d'être écrite, et le
 * formulaire ne transmet que le nom du paramètre. C'est délibéré : accepter les
 * valeurs venues du client reviendrait à laisser n'importe qui poser le seuil
 * qu'il veut, bornes et fenêtre d'observation comprises. Ici, l'écran ne fait
 * que dire « applique ce que tu viens de me montrer » — et le serveur vérifie
 * que c'est toujours ce qu'il proposerait.
 *
 * Même principe qu'ADR-047 pour la marge : le serveur n'accepte pas ce que le
 * formulaire refuse, et une seule autorité tient la règle.
 */

import { revalidatePath } from "next/cache";
import { estAdministrateur } from "./acces";
import { chargerMetriquesMoteur } from "./auto-evaluation";
import { inscrireAjustement, lireJournalReglages } from "./reglages-moteur";
import { proposerAjustements } from "@/lib/engine/reglages";

export async function appliquerAjustementMoteur(formData: FormData): Promise<void> {
  // Le journal du moteur est un objet d'exploitation, pas d'apprentissage : il
  // vit dans `/admin`, et l'écriture suit la même porte que la lecture.
  if (!(await estAdministrateur())) {
    throw new Error("Réservé à l'administration.");
  }

  const parametre = String(formData.get("parametre") ?? "");
  const [metriques, journal] = await Promise.all([
    chargerMetriquesMoteur(),
    lireJournalReglages(),
  ]);

  const proposition = proposerAjustements({
    metriques,
    journal,
    maintenant: new Date(),
  });

  // Rien à appliquer, ou l'écran montrait autre chose que ce que le moteur
  // propose maintenant — une mesure a pu bouger entre l'affichage et le clic.
  if (!proposition || proposition.parametre !== parametre) {
    throw new Error(
      "La proposition a changé depuis son affichage. Rechargez avant d'appliquer.",
    );
  }

  await inscrireAjustement(proposition);
  revalidatePath("/", "layout");
}
