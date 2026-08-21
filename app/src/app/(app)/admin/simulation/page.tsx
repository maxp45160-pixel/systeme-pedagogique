import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntetePage } from "@/components/layout/entete-page";
import { SimulateurParcours } from "@/components/admin/simulateur-parcours";
import { estAdministrateur } from "@/lib/store/acces";

export const metadata: Metadata = {
  title: "Simulation de parcours — Système pédagogique",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Outil d'inspection : déroule dix-huit mois d'un apprenant fictif contre le
 * moteur réel et montre ce que le produit fabrique sur la durée. Réservé à
 * l'administration, comme le cockpit : ce n'est pas une vue d'apprentissage.
 *
 * Aucune donnée de compte n'est lue, rien n'est écrit : le parcours est calculé
 * dans le navigateur et disparaît au rechargement.
 */
export default async function PageSimulation() {
  if (!(await estAdministrateur())) notFound();

  return (
    <>
      <EntetePage
        titre="Simulation de parcours"
        sousTitre="Un apprenant fictif, dix-huit mois de physique, et ce que le moteur en fait."
      />
      <SimulateurParcours />
    </>
  );
}
