/**
 * Découpage d'un texte markdown en blocs — la partie qui décide, sans rendu.
 *
 * Elle vivait dans `components/ui/markdown.tsx`, mêlée au JSX, donc hors de
 * portée de Vitest (`include: src/**\/*.test.ts`, environnement node). Elle en
 * sort pour une raison précise : elle portait une **boucle infinie**.
 *
 * Le défaut. Le bloc tableau n'acceptait une ligne commençant par « | » que
 * suivie d'un séparateur (`|---|---|`) ; la boucle paragraphe, elle, refusait
 * toute ligne commençant par « | ». Une ligne « | » orpheline n'était donc
 * consommée par personne et `i` n'avançait plus. Le navigateur gelait, l'onglet
 * mourait, et tout le site avec — la réponse du tuteur s'arrêtait net au milieu.
 *
 * Ce n'était pas un cas rare : le flux SSE livre la ligne d'en-tête d'un tableau
 * AVANT son séparateur. Tout tableau rédigé par le tuteur passait par cet état
 * au premier flush. Un `|x|` en début de ligne suffisait aussi.
 *
 * L'invariant qui l'empêche de revenir est explicite ci-dessous et testé :
 * **chaque tour de boucle consomme au moins une ligne.** Une ligne que personne
 * ne reconnaît devient du texte, jamais un blocage — un caractère mal rendu est
 * un défaut d'affichage, un onglet figé est une perte de travail.
 */

export type BlocMarkdown =
  | { genre: "code"; langue: string; corps: string }
  | { genre: "tableau"; entetes: string[]; corps: string[][] }
  | { genre: "titre"; texte: string }
  | { genre: "citation"; texte: string }
  | { genre: "liste"; ordonnee: boolean; items: string[] }
  | { genre: "paragraphe"; texte: string };

function estSeparateurTableau(ligne: string): boolean {
  return /^\|[\s|:-]+\|$/.test(ligne.trim());
}

function cellules(ligne: string): string[] {
  return ligne
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** Une ligne qui ouvre un bloc structuré interrompt le paragraphe en cours. */
function ouvreUnBloc(ligne: string): boolean {
  const t = ligne.trim();
  return (
    t === "" ||
    t.startsWith("```") ||
    t.startsWith("|") ||
    t.startsWith(">") ||
    /^#{1,4}\s/.test(ligne) ||
    /^\s*[-*]\s+/.test(ligne) ||
    /^\s*\d+\.\s+/.test(ligne)
  );
}

export function decouperEnBlocs(contenu: string): BlocMarkdown[] {
  const lignes = contenu.split("\n");
  const blocs: BlocMarkdown[] = [];
  let i = 0;

  while (i < lignes.length) {
    const depart = i;
    const ligne = lignes[i];

    // Bloc de code délimité par ```
    if (ligne.trim().startsWith("```")) {
      const langue = ligne.trim().slice(3).trim();
      const corps: string[] = [];
      i++;
      while (i < lignes.length && !lignes[i].trim().startsWith("```")) {
        corps.push(lignes[i]);
        i++;
      }
      i++; // ferme le bloc
      blocs.push({ genre: "code", langue, corps: corps.join("\n") });
      continue;
    }

    // Tableau : une ligne d'en-tête suivie d'un séparateur
    if (ligne.trim().startsWith("|") && estSeparateurTableau(lignes[i + 1] ?? "")) {
      const entetes = cellules(ligne);
      i += 2;
      const corps: string[][] = [];
      while (i < lignes.length && lignes[i].trim().startsWith("|")) {
        corps.push(cellules(lignes[i]));
        i++;
      }
      blocs.push({ genre: "tableau", entetes, corps });
      continue;
    }

    const titre = /^(#{1,4})\s+(.*)$/.exec(ligne);
    if (titre) {
      blocs.push({ genre: "titre", texte: titre[2] });
      i++;
      continue;
    }

    if (ligne.trim().startsWith(">")) {
      const corps: string[] = [];
      while (i < lignes.length && lignes[i].trim().startsWith(">")) {
        corps.push(lignes[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocs.push({ genre: "citation", texte: corps.join(" ") });
      continue;
    }

    if (/^\s*[-*]\s+/.test(ligne)) {
      const items: string[] = [];
      while (i < lignes.length && /^\s*[-*]\s+/.test(lignes[i])) {
        items.push(lignes[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocs.push({ genre: "liste", ordonnee: false, items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(ligne)) {
      const items: string[] = [];
      while (i < lignes.length && /^\s*\d+\.\s+/.test(lignes[i])) {
        items.push(lignes[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocs.push({ genre: "liste", ordonnee: true, items });
      continue;
    }

    if (ligne.trim() === "") {
      i++;
      continue;
    }

    // Paragraphe : accumule jusqu'à la prochaine ligne vide ou bloc structuré.
    const paragraphe: string[] = [];
    while (i < lignes.length && !ouvreUnBloc(lignes[i])) {
      paragraphe.push(lignes[i]);
      i++;
    }

    /*
     * LE FILET, et la raison d'être de ce module.
     *
     * `depart` n'a pas bougé : la ligne ouvre un bloc que la cascade ci-dessus
     * n'a pas su prendre — une ligne « | » sans séparateur, aujourd'hui ; ce
     * qu'une condition future ajoutera, demain. On la rend telle quelle et on
     * avance. Sans cette clause, la boucle ne se termine pas.
     */
    if (i === depart) {
      blocs.push({ genre: "paragraphe", texte: lignes[i] });
      i++;
      continue;
    }

    if (paragraphe.length > 0) {
      blocs.push({ genre: "paragraphe", texte: paragraphe.join(" ") });
    }
  }

  return blocs;
}
