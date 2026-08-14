import { memo, type ReactNode } from "react";
import { decouperEnBlocs } from "@/lib/ui/markdown-blocs";
import { latexVersTexte, segmenterFormulesEnLigne } from "@/lib/ui/formule";
import { parserFrontMatter } from "@/lib/documents/markdown";

/**
 * Rendu markdown minimal, écrit sur mesure.
 *
 * Ne gère que ce que les énoncés et corrections utilisent réellement :
 * titres, paragraphes, gras, italique, wikiliens, code en ligne, blocs de code, listes, citations
 * et tableaux. Aucune dépendance, aucun HTML brut injecté — le texte reste
 * du texte, ce qui écarte tout risque d'injection depuis un contenu généré
 * par le tuteur.
 *
 * Le **découpage** vit dans `lib/ui/markdown-blocs.ts` : il portait une boucle
 * infinie que le JSX rendait intestable (Vitest ne prend que `*.test.ts`, en
 * environnement node). Ce fichier ne décide plus rien — il rend.
 */

/** Applique wikiliens, gras, italique et code en ligne à l'intérieur d'un fragment de prose. */
function emphase(texte: string, pfx: string): ReactNode[] {
  const sorties: ReactNode[] = [];
  // Découpe sur [[wikiliens]], **gras**, *italique*, et `code`, en conservant les délimiteurs.
  const morceaux = texte.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  for (let idx = 0; idx < morceaux.length; idx++) {
    const m = morceaux[idx];
    if (!m) continue;
    if (m.startsWith("[[") && m.endsWith("]]") && m.length > 4) {
      const contenu = m.slice(2, -2).trim();
      const [cible, libelle] = contenu.split("|", 2);
      const texteAffiche = (libelle || cible).trim();
      sorties.push(
        <span
          key={`${pfx}-w-${idx}`}
          className="inline-flex items-center gap-0.5 rounded bg-primaire/10 px-1.5 py-0.5 font-mono text-xs font-medium text-primaire border border-primaire/20"
          title={`Référence : ${cible}`}
        >
          <span className="text-primaire/50 font-sans text-[0.6875rem]">[[</span>
          <span>{texteAffiche}</span>
          <span className="text-primaire/50 font-sans text-[0.6875rem]">]]</span>
        </span>,
      );
    } else if (m.startsWith("**") && m.endsWith("**")) {
      sorties.push(<strong key={`${pfx}-b-${idx}`}>{m.slice(2, -2)}</strong>);
    } else if (m.startsWith("*") && m.endsWith("*") && m.length > 2) {
      sorties.push(<em key={`${pfx}-i-${idx}`}>{m.slice(1, -1)}</em>);
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

/** Comparaison de titres insensible à la casse et aux espaces de bord. */
function memeTitre(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase("fr-FR") === b.trim().toLocaleLowerCase("fr-FR");
}

export const Markdown = memo(function Markdown({
  contenu,
  titresReplies,
}: {
  contenu: string;
  /**
   * Titres dont le contenu est masqué jusqu'à un geste explicite.
   *
   * Sert à la correction dans la fiche d'un exercice : elle doit être là — on
   * l'a demandée — sans s'offrir au regard de qui rouvre l'exercice pour le
   * refaire. Même précaution que le parcours d'exercice, qui dévoile la
   * correction acte par acte plutôt que d'un bloc.
   */
  titresReplies?: readonly string[];
}) {
  const { corps } = parserFrontMatter(contenu);
  const contenuNettoye = corps.trim();
  const rendus = decouperEnBlocs(contenuNettoye).map((bloc, idx) => {
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

  if (!titresReplies?.length) return <div className="prose-exo">{rendus}</div>;

  /*
   * Regroupement par titre, uniquement quand un repli est demandé.
   *
   * Le découpage ne produit qu'une suite plate de blocs : un titre ne contient
   * rien, il précède. On reconstitue donc la portée d'un titre — jusqu'au titre
   * suivant — pour pouvoir la replier d'un seul tenant.
   */
  const blocs = decouperEnBlocs(contenuNettoye);
  const sorties: ReactNode[] = [];
  for (let idx = 0; idx < blocs.length; idx++) {
    const bloc = blocs[idx];
    const replie =
      bloc.genre === "titre" && titresReplies.some((titre) => memeTitre(titre, bloc.texte));
    if (!replie) {
      sorties.push(rendus[idx]);
      continue;
    }
    let fin = idx + 1;
    while (fin < blocs.length && blocs[fin].genre !== "titre") fin++;
    sorties.push(
      <details key={`d-${idx}`} className="rounded-md border border-bordure px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">{bloc.texte}</summary>
        <div className="mt-2">{rendus.slice(idx + 1, fin)}</div>
      </details>,
    );
    idx = fin - 1;
  }

  return <div className="prose-exo">{sorties}</div>;
});
