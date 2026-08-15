import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SqueletteContenu } from "@/components/layout/squelette";
import { CoquilleWorkspace } from "@/components/seances/coquille-workspace";
import { ActivityWorkspace } from "@/components/adaptive/activity-workspace";

/**
 * L'espace de production d'un projet — un écran de travail, pas un pôle.
 *
 * Il n'y a pas de page « Projets » à parcourir : un projet se pilote depuis sa
 * fiche dans l'Atelier, qui porte son suivi et ses compétences. Cette route
 * n'existe que pour le moment où l'on produit vraiment : plein écran, sans
 * navigation, avec une sortie qui ramène à la fiche.
 *
 * Sans `run`, il n'y a rien à montrer : on renvoie à l'Atelier plutôt que
 * d'inventer une liste que personne n'a demandée.
 */
export default async function PageProjet(props: {
  searchParams: Promise<{ run?: string; note?: string }>;
}) {
  const { run, note } = await props.searchParams;
  if (!run) redirect("/atelier");

  return (
    <CoquilleWorkspace
      surtitre="Projet"
      titre="Espace de production"
      sortie={{
        href: note ? `/atelier?note=${encodeURIComponent(note)}` : "/atelier",
        libelle: "Revenir à la fiche",
      }}
    >
      <Suspense fallback={<SqueletteContenu />}>
        <ActivityWorkspace runId={run} />
      </Suspense>
    </CoquilleWorkspace>
  );
}
