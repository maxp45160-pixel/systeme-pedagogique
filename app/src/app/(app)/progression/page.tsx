import { redirect } from "next/navigation";

/**
 * La progression est une vue du pôle Séances (ADR-053) : `?vue=progression`.
 * Cette route redirige pour ne pas casser les liens existants — bookmarks,
 * historique, liens internes pas encore mis à jour. Le filtre de période est
 * relayé tel quel.
 */
export default async function PageProgression(props: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { periode } = await props.searchParams;
  redirect(
    periode
      ? `/seances?vue=progression&periode=${encodeURIComponent(periode)}`
      : "/seances?vue=progression",
  );
}
