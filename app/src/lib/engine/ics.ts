/**
 * Export .ics d'une séance planifiée (ADR-053).
 *
 * Une fonction pure, rien de plus : pas d'intégration calendrier dans ce lot
 * (hors périmètre du plan §5). Le déroulé de la séance vit dans l'application ;
 * ce fichier ne produit qu'un texte conforme à RFC 5545, que l'utilisateur
 * peut enregistrer et importer où il veut.
 *
 * La date/heure est portée en temps universel (UTC) et marquée comme telle :
 * un .ics qui omet délibérément le fuseau ferait démarrer l'événement à une
 * heure différente chez celui qui l'importe selon sa propre zone locale.
 */

/** Échappe les caractères réservés du format .ics (RFC 5545, §3.3.11). */
function echapperTexte(texte: string): string {
  return texte
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formaterHorodatage(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export interface EvenementIcs {
  titre: string;
  /** Début de l'événement. */
  debut: Date;
  /** Fin de l'événement. Peut être avant `debut` si la durée estimée est nulle. */
  fin: Date;
  description?: string;
}

/**
 * Construit le texte brut d'un événement .ics.
 *
 * `créé le` et `dernière modification` sont posées à `debut` : leur précision
 * n'importe pas au destinataire, et lire l'horloge ici casserait la pureté de
 * la fonction. L'appelant fournit une seule date, celle de l'événement.
 */
export function construireIcs(evenement: EvenementIcs): string {
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Systeme Pedagogique//Seances//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${formaterHorodatage(evenement.debut)}-seance@systeme-pedagogique`,
    `DTSTAMP:${formaterHorodatage(evenement.debut)}`,
    `DTSTART:${formaterHorodatage(evenement.debut)}`,
    `DTEND:${formaterHorodatage(evenement.fin)}`,
    `SUMMARY:${echapperTexte(evenement.titre)}`,
    ...(evenement.description
      ? [`DESCRIPTION:${echapperTexte(evenement.description)}`]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lignes.join("\r\n") + "\r\n";
}
