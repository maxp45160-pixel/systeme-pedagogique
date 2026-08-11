import { redirect } from "next/navigation";

/**
 * Compatibilité : le déroulé d'une séance vit désormais dans le workspace
 * `/seances?session=<id>` (ADR-061). Cette route redirige pour ne pas casser
 * les bookmarks et les liens internes pas encore mis à jour.
 */
export default async function PageSeance({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/seances?session=${encodeURIComponent(id)}`);
}
