import { redirect } from "next/navigation";

/**
 * La progression est fusionnée dans `/competences` (lot 4) : elle y est un
 * panneau du pôle Suivi, pas un écran séparé — la navigation à trois pôles ne
 * la référence plus.
 *
 * Cette route redirige vers la vue « Progression ». Elle est conservée pour ne
 * pas casser les liens existants — bookmarks, historique de navigation, liens
 * internes pas encore mis à jour. Même geste que `/competences/referentiel`.
 *
 * Le filtre de période survit à la fusion : il est porté par le panneau, et
 * `?periode=` est relayé tel quel.
 */
export default async function PageProgression(props: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { periode } = await props.searchParams;
  redirect(
    periode
      ? `/competences?vue=progression&periode=${encodeURIComponent(periode)}`
      : "/competences?vue=progression",
  );
}
