/**
 * Ce qu'un document est, et si on a le droit de le réécrire.
 *
 * Le test « est-ce une preuve ? » vivait en double, recopié dans la page
 * serveur de l'Atelier et dans le composant qui réanalyse le Markdown après un
 * enregistrement. Une seule implémentation, puisque c'est la réponse à cette
 * question qui décide si l'éditeur s'ouvre.
 */

/** Une trace de production : elle atteste d'un fait daté, elle ne se réécrit pas. */
export function estDocumentPreuve(document: { id: string; type?: string | null }): boolean {
  return document.type === "preuve" || document.id.startsWith("preuve-");
}

/**
 * La fiche d'un exercice, produite par `construireFicheExercice`.
 *
 * Son énoncé, sa correction et ses compétences sont une copie de l'exercice qui
 * vit en base. La rendre modifiable dans l'éditeur Markdown laissait corriger
 * un énoncé **dans la fiche seulement** : l'exercice servi restait celui de la
 * table, et les deux textes divergeaient sans que rien ne le dise. Un exercice
 * se corrige par son propre chemin (ADR-047), qui écrit la source.
 */
export function estFicheExercice(document: { id: string; type?: string | null }): boolean {
  return document.type === "exercice" || document.id.startsWith("exercice-");
}

/**
 * Les documents dérivés d'une donnée qui vit ailleurs.
 *
 * Le corpus documentaire contient deux sortes de textes : ceux qu'on écrit —
 * notes, cours, fiches de travail — et ceux qu'un passage a produits à partir
 * d'une source en base. Les seconds sont en lecture seule, sans quoi on
 * modifierait la copie en croyant modifier l'original.
 */
export function documentEnLectureSeule(document: { id: string; type?: string | null }): boolean {
  return estDocumentPreuve(document) || estFicheExercice(document);
}
