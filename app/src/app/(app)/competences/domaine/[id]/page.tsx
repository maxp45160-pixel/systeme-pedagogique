import { redirect } from "next/navigation";

/** Redirige une ancienne fiche domaine vers sa gestion contextuelle dans l'Atelier. */
export default async function PageDomaine(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  redirect(`/atelier?document=${encodeURIComponent(`domaine:${decodeURIComponent(id)}`)}&mode=referentiel`);
}
