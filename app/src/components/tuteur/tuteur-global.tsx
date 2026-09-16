"use client";

/**
 * Le tuteur, accessible de partout — en tiroir, pas en navigation.
 *
 * Le bouton flottant ouvre le tiroir et garde la page visible derrière lui.
 * Les données pédagogiques initiales sont désormais chargées à la demande
 * lors du premier clic, afin de ne pas ralentir le chargement initial du layout.
 */

import { TiroirTuteur } from "@/components/tuteur/tiroir-tuteur";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { classesLienBouton } from "@/components/ui/primitives";

function useAssistantOuvert(piloteDepot: boolean) {
  const pathname = usePathname();
  const recherche = useSearchParams();
  return piloteDepot && pathname === "/app" && recherche.get("classique") !== "1";
}

export function AccesAssistantMobile() {
  const assistantOuvert = useAssistantOuvert(true);
  if (assistantOuvert) return null;
  return <div className="border-b border-bordure bg-surface px-4 py-2 lg:hidden">
    <Link href="/app" className={classesLienBouton("secondaire", "petite")}>Ouvrir l’assistant</Link>
  </div>;
}

export function TuteurGlobal({ piloteDepot = false }: { piloteDepot?: boolean }) {
  const assistantOuvert = useAssistantOuvert(piloteDepot);
  if (assistantOuvert) return null;
  return (
    <TiroirTuteur declencheur="flottant" libelle="Ouvrir le tuteur" />
  );
}
