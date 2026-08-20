/** Extrait une échéance simple d'un besoin écrit en langage naturel. */
export function extraireEcheanceBesoin(
  texte: string,
  maintenant = new Date(),
): string | undefined {
  const versIsoLocal = (date: Date) => [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ].join("-");
  const normalise = texte.trim().toLocaleLowerCase("fr-FR");
  const relatif = normalise.match(/\b(?:dans|d['’]ici)\s+(un|une|\d+)\s+(jour|jours|semaine|semaines|mois)\b/);
  if (relatif) {
    const quantite = relatif[1] === "un" || relatif[1] === "une" ? 1 : Number(relatif[1]);
    if (!Number.isInteger(quantite) || quantite < 1) return undefined;
    const unite = relatif[2];
    const date = new Date(maintenant);
    if (unite.startsWith("jour")) date.setDate(date.getDate() + quantite);
    else if (unite.startsWith("semaine")) date.setDate(date.getDate() + quantite * 7);
    else date.setMonth(date.getMonth() + quantite);
    return versIsoLocal(date);
  }

  if (/\bdemain\b/.test(normalise)) {
    const date = new Date(maintenant);
    date.setDate(date.getDate() + 1);
    return versIsoLocal(date);
  }

  const dateExplicite = normalise.match(/\b(?:le|pour le)\s+(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (dateExplicite) {
    const annee = dateExplicite[3]
      ? (dateExplicite[3].length === 2 ? 2000 + Number(dateExplicite[3]) : Number(dateExplicite[3]))
      : maintenant.getFullYear();
    const mois = Number(dateExplicite[2]);
    const jour = Number(dateExplicite[1]);
    const date = new Date(annee, mois - 1, jour);
    if (date.getFullYear() !== annee || date.getMonth() !== mois - 1 || date.getDate() !== jour) {
      return undefined;
    }
    return [annee.toString().padStart(4, "0"), dateExplicite[2].padStart(2, "0"), dateExplicite[1].padStart(2, "0")].join("-");
  }

  return undefined;
}
