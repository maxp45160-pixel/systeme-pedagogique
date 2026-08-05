import { memo, type ReactNode } from "react";
import { decouperEnBlocs } from "@/lib/ui/markdown-blocs";
import { latexVersTexte, segmenterFormulesEnLigne } from "@/lib/ui/formule";

/**
 * Rendu markdown minimal, écrit sur mesure.
 *
 * Ne gère que ce que les énoncés et corrections utilisent réellement :
 * titres, paragraphes, gras, code en ligne, blocs de code, listes, citations
 * et tableaux. Aucune dépendance, aucun HTML brut injecté — le texte reste
 * du texte, ce qui écarte tout risque d'injection depuis un contenu généré
 * par le tuteur.
 *
 * Le **découpage** vit dans `lib/ui/markdown-blocs.ts` : il portait une boucle
 * infinie que le JSX rendait intestable (Vitest ne prend que `*.test.ts`, en
 * environnement node). Ce fichier ne décide plus rien — il rend.
 */

/** Applique gras et code en ligne à l'intérieur d'un fragment de prose. */
function emphase(texte: string, pfx: string): ReactNode[] {
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

/**
 * Rendu d'une ligne : formules en ligne d'abord, emphase ensuite.
 *
 * L'ordre compte — une formule est du code mathématique, pas de la prose : un
 * `_` ou un `*` à l'intérieur doit rester un indice, jamais de l'italique.
 */
function enligne(texte: string, pfx: string = "in"): ReactNode[] {
  return segmenterFormulesEnLigne(texte).flatMap((segment, idx) =>
    segment.formule ? (
      <span key={`${pfx}-f-${idx}`} className="formule">
        {segment.texte}
      </span>
    ) : (
      emphase(segment.texte, `${pfx}-${idx}`)
    ),
  );
}

export const Markdown = memo(function Markdown({ contenu }: { contenu: string }) {
  const blocs = decouperEnBlocs(contenu).map((bloc, idx) => {
    const cle = `b-${idx}`;
    switch (bloc.genre) {
      case "code":
        return (
          <pre key={cle} data-langue={bloc.langue || undefined}>
            <code>{bloc.corps}</code>
          </pre>
        );

      case "tableau":
        return (
          <div key={cle} className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  {bloc.entetes.map((h, hIdx) => (
                    <th key={`th-${hIdx}`}>{enligne(h, `${cle}-h-${hIdx}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bloc.corps.map((r, rIdx) => (
                  <tr key={`tr-${rIdx}`}>
                    {r.map((c, cIdx) => (
                      <td key={`td-${cIdx}`}>{enligne(c, `${cle}-c-${rIdx}-${cIdx}`)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "titre":
        return <h3 key={cle}>{enligne(bloc.texte, `${cle}-h`)}</h3>;

      case "citation":
        return <blockquote key={cle}>{enligne(bloc.texte, `${cle}-q`)}</blockquote>;

      case "liste": {
        const items = bloc.items.map((t, itemIdx) => (
          <li key={`li-${itemIdx}`}>{enligne(t, `${cle}-li-${itemIdx}`)}</li>
        ));
        return bloc.ordonnee ? <ol key={cle}>{items}</ol> : <ul key={cle}>{items}</ul>;
      }

      case "formule":
        return (
          <div key={cle} className="formule-affichee">
            {latexVersTexte(bloc.latex)}
          </div>
        );

      case "paragraphe":
        return <p key={cle}>{enligne(bloc.texte, `${cle}-p`)}</p>;
    }
  });

  return <div className="prose-exo">{blocs}</div>;
});
