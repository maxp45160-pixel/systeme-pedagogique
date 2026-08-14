/**
 * Lecture et écriture des sections `## …` d'une fiche.
 *
 * Ces fonctions ne connaissent ni l'Atelier ni React : elles manipulent du
 * Markdown. Elles vivaient dans le composant du workspace, où un analyseur de
 * lignes n'a rien à faire — et où personne ne pouvait les tester.
 *
 * Règle commune à tout ce fichier : **on n'efface jamais ce qu'on n'a pas
 * écrit**. Une section absente est ajoutée en fin de document, une section
 * présente voit son corps remplacé, et rien en dehors des sections visées ne
 * bouge — ni le front-matter, ni le titre, ni les sections inconnues.
 */

/** Comparaison insensible à la casse et aux espaces de bord, en français. */
function cleSection(valeur: string): string {
  return valeur.trim().toLocaleLowerCase("fr-FR");
}

export type ValeursSections = Record<string, string>;

function enLignes(contenuMd: string): string[] {
  return contenuMd.replace(/\r\n/g, "\n").split("\n");
}

/**
 * Repère les sections visées et leur étendue.
 *
 * La fin d'une section est le début de l'en-tête suivant, **quel qu'il soit** :
 * s'arrêter au prochain en-tête *visé* engloberait les sections intermédiaires
 * inconnues, qui seraient alors écrasées à la première écriture.
 */
function indicesSections(lignes: string[], sections: readonly string[]) {
  const cibles = new Set(sections.map(cleSection));
  const entetes = lignes.reduce<Array<{ nom: string; debut: number }>>((resultat, ligne, index) => {
    const correspondance = /^##\s+(.+?)\s*$/.exec(ligne);
    if (correspondance) resultat.push({ nom: correspondance[1].trim(), debut: index });
    return resultat;
  }, []);
  return entetes
    .filter((section) => cibles.has(cleSection(section.nom)))
    .map((section) => ({
      ...section,
      fin: entetes.find((entete) => entete.debut > section.debut)?.debut ?? lignes.length,
    }));
}

export function lireValeursSections(
  contenuMd: string,
  sections: readonly string[],
): ValeursSections {
  const lignes = enLignes(contenuMd);
  const resultat: ValeursSections = {};
  for (const section of sections) resultat[section] = "";

  for (const section of indicesSections(lignes, sections)) {
    const cible = sections.find((nom) => cleSection(nom) === cleSection(section.nom));
    if (cible) resultat[cible] = lignes.slice(section.debut + 1, section.fin).join("\n").trim();
  }
  return resultat;
}

export function mettreAJourSections(
  contenuMd: string,
  sections: readonly string[],
  valeurs: ValeursSections,
): string {
  const lignes = enLignes(contenuMd);
  const occurrences = indicesSections(lignes, sections);
  const nomsPresentes = new Set(occurrences.map((section) => cleSection(section.nom)));

  // À rebours : chaque remplacement décale les lignes suivantes.
  for (const occurrence of [...occurrences].reverse()) {
    const nom = sections.find((section) => cleSection(section) === cleSection(occurrence.nom));
    if (!nom) continue;
    const valeur = valeurs[nom]?.trim() ?? "";
    const corps = valeur ? ["", ...valeur.split("\n"), ""] : ["", ""];
    lignes.splice(occurrence.debut + 1, occurrence.fin - occurrence.debut - 1, ...corps);
  }

  const absentes = sections.filter((section) => !nomsPresentes.has(cleSection(section)));
  for (const section of absentes) {
    const valeur = valeurs[section]?.trim() ?? "";
    lignes.push("", `## ${section}`, "", ...(valeur ? valeur.split("\n") : []));
  }

  return lignes.join("\n");
}

/**
 * Ajoute des lignes à la fin d'une section, sans toucher à ce qui s'y trouve.
 *
 * Une ligne déjà présente n'est pas réécrite : rejouer l'écriture — un second
 * passage sur le même exercice, une composition relancée — ne doit pas empiler
 * les doublons. C'est ce qui rend l'appel sûr à répéter.
 */
export function ajouterDansSection(
  contenuMd: string,
  section: string,
  lignesAAjouter: readonly string[],
): string {
  const existant = lireValeursSections(contenuMd, [section])[section] ?? "";
  const dejaPresentes = new Set(existant.split("\n").map((ligne) => ligne.trim()));
  const nouvelles = lignesAAjouter
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0 && !dejaPresentes.has(ligne));
  if (nouvelles.length === 0) return contenuMd;

  return mettreAJourSections(contenuMd, [section], {
    [section]: [existant.trim(), ...nouvelles].filter(Boolean).join("\n"),
  });
}
