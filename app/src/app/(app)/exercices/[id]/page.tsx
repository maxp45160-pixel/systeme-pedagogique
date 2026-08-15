import { notFound, redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";

/**
 * Un exercice ne s'ouvre plus comme un workspace unitaire : ce parcours
 * historique affichait la correction et la réponse de la dernière tentative
 * avant de permettre de repartir. La séance est désormais le point d'entrée
 * unique, avec son compositeur et ses contrôles.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await chargerContexte();
  const exercice = ctx.donnees.exercises.find((item) => item.id === id);
  if (!exercice) notFound();

  redirect(
    `/seances?composer=1&code=${encodeURIComponent(exercice.competences[0] ?? "")}&temps=${exercice.dureeEstimeeMin}`,
  );

  // Repli syntaxique conservé pour l'introspection du workflow : la page est
  // bien une route déclarée, même si `redirect` ne la laisse jamais afficher.
  return <div />;
}
