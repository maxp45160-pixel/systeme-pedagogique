import type { ReactNode } from "react";

/**
 * Rendu markdown minimal, écrit sur mesure.
 *
 * Ne gère que ce que les énoncés et corrections utilisent réellement :
 * titres, paragraphes, gras, code en ligne, blocs de code, listes, citations
 * et tableaux. Aucune dépendance, aucun HTML brut injecté — le texte reste
 * du texte, ce qui écarte tout risque d'injection depuis un contenu généré
 * par le tuteur.
 */

/** Applique gras et code en ligne à l'intérieur d'une ligne. */
function enligne(texte: string, pfx: string = "in"): ReactNode[] {
  const sorties: ReactNode[] = [];
  // Découpe sur **gras** et `code`, en conservant les délimiteurs.
  const morceaux = texte.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (let idx = 0; idx < morceaux.length; idx++) {
    const m = morceaux[idx];
    if (!m) continue;
    if (m.startsWith("**") && m.endsWith("**")) {
      sorties.push(<strong key={`${pfx}-b-${idx}`}>{m.slice(2, -2)}</strong>);
    } else if (m.startsWith("`") && m.endsWith("`") && m.length > 2) {
      sorties.push(<code key={`${pfx}-c-${idx}`}>{m.slice(1, -1)}</code>);
    } else {
      sorties.push(m);
    }
  }
  return sorties;
}

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

export function Markdown({ contenu }: { contenu: string }) {
  const lignes = contenu.split("\n");
  const blocs: ReactNode[] = [];
  let i = 0;
  let blocIdx = 0;

  while (i < lignes.length) {
    const ligne = lignes[i];
    const keyBloc = `b-${blocIdx++}`;

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
      blocs.push(
        <pre key={keyBloc} data-langue={langue || undefined}>
          <code>{corps.join("\n")}</code>
        </pre>,
      );
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
      blocs.push(
        <div key={keyBloc} className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                {entetes.map((h, hIdx) => (
                  <th key={`th-${hIdx}`}>{enligne(h, `${keyBloc}-h-${hIdx}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corps.map((r, rIdx) => (
                <tr key={`tr-${rIdx}`}>
                  {r.map((c, cIdx) => (
                    <td key={`td-${cIdx}`}>{enligne(c, `${keyBloc}-c-${rIdx}-${cIdx}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Titre
    const titre = /^(#{1,4})\s+(.*)$/.exec(ligne);
    if (titre) {
      blocs.push(<h3 key={keyBloc}>{enligne(titre[2], `${keyBloc}-h`)}</h3>);
      i++;
      continue;
    }

    // Citation
    if (ligne.trim().startsWith(">")) {
      const corps: string[] = [];
      while (i < lignes.length && lignes[i].trim().startsWith(">")) {
        corps.push(lignes[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocs.push(<blockquote key={keyBloc}>{enligne(corps.join(" "), `${keyBloc}-q`)}</blockquote>);
      continue;
    }

    // Liste à puces
    if (/^\s*[-*]\s+/.test(ligne)) {
      const items: string[] = [];
      while (i < lignes.length && /^\s*[-*]\s+/.test(lignes[i])) {
        items.push(lignes[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocs.push(
        <ul key={keyBloc}>
          {items.map((t, itemIdx) => (
            <li key={`li-${itemIdx}`}>{enligne(t, `${keyBloc}-li-${itemIdx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Liste numérotée
    if (/^\s*\d+\.\s+/.test(ligne)) {
      const items: string[] = [];
      while (i < lignes.length && /^\s*\d+\.\s+/.test(lignes[i])) {
        items.push(lignes[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocs.push(
        <ol key={keyBloc}>
          {items.map((t, itemIdx) => (
            <li key={`li-${itemIdx}`}>{enligne(t, `${keyBloc}-li-${itemIdx}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Ligne vide
    if (ligne.trim() === "") {
      i++;
      continue;
    }

    // Paragraphe : accumule jusqu'à la prochaine ligne vide ou bloc structuré
    const paragraphe: string[] = [];
    while (
      i < lignes.length &&
      lignes[i].trim() !== "" &&
      !lignes[i].trim().startsWith("```") &&
      !lignes[i].trim().startsWith("|") &&
      !lignes[i].trim().startsWith(">") &&
      !/^#{1,4}\s/.test(lignes[i]) &&
      !/^\s*[-*]\s+/.test(lignes[i]) &&
      !/^\s*\d+\.\s+/.test(lignes[i])
    ) {
      paragraphe.push(lignes[i]);
      i++;
    }
    if (paragraphe.length > 0) {
      blocs.push(<p key={keyBloc}>{enligne(paragraphe.join(" "), `${keyBloc}-p`)}</p>);
    }
  }

  return <div className="prose-exo">{blocs}</div>;
}
