import katex from "katex";
import "katex/dist/katex.min.css";
import { latexVersTexte } from "@/lib/ui/formule";

/**
 * Rendu d'une formule LaTeX par KaTeX.
 *
 * Décision du 23/08/2026 (révise l'option « aucune librairie mathématique »
 * notée dans `lib/ui/formule.ts`) : le convertisseur LaTeX→Unicode maison
 * reste le **filet** — il rend quelque chose de lisible pour tout — mais la
 * composition visée est KaTeX, qui dessine les fractions, matrices et
 * intégrales que du texte ne peut pas porter.
 *
 * `throwOnError: true` + repli : une formule que KaTeX refuse retombe sur le
 * texte Unicode, jamais sur un message d'erreur rouge ni sur du vide.
 */
export function FormuleMath({
  latex,
  display = false,
}: {
  latex: string;
  /** Mode hors-ligne (`$$…$$`, `\[…\]`) : centré sur son propre bloc. */
  display?: boolean;
}) {
  let html: string | null = null;
  try {
    html = katex.renderToString(latex, {
      throwOnError: true,
      displayMode: display,
      output: "html",
      strict: false,
    });
  } catch {
    html = null;
  }

  if (html === null) {
    return (
      <span className="formule">
        {latexVersTexte(latex)}
      </span>
    );
  }

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
