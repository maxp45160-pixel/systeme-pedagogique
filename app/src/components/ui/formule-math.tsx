import "katex/dist/katex.min.css";
import { rendreFormule } from "@/lib/ui/rendu-formule";

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
  const { html, texteAccessible } = rendreFormule(latex, display);

  if (html === null) {
    return (
      <span className="formule" role="math" aria-label={texteAccessible}>
        {texteAccessible}
      </span>
    );
  }

  return (
    <span
      className={display ? "formule-rendu formule-rendu-bloc" : "formule-rendu"}
      role="math"
      aria-label={texteAccessible}
    >
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
    </span>
  );
}
