import { redirect } from "next/navigation";

/**
 * Compatibilité des anciens liens : la fiche canonique vit désormais dans
 * l'Atelier, avec le radar, les relations et la prochaine action.
 */
export default async function PageCompetence(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  redirect(`/atelier?document=${encodeURIComponent(code)}`);
}
