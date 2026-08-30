import katex from "katex";
import { latexVersTexte } from "@/lib/ui/formule";

/**
 * Résultat commun de composition d'une formule.
 *
 * KaTeX reste la composition visuelle de référence. Le texte Unicode est
 * calculé dans tous les cas : il sert à l'accessibilité et prend le relais si
 * KaTeX refuse une entrée incomplète ou inconnue.
 */
export interface RenduFormule {
  html: string | null;
  texteAccessible: string;
}

/** Compose une formule avec le contrat partagé lecture / éditeur WYSIWYG. */
export function rendreFormule(latex: string, display = false): RenduFormule {
  const texteAccessible = latexVersTexte(latex);
  try {
    return {
      html: katex.renderToString(latex, {
        throwOnError: true,
        displayMode: display,
        output: "html",
        strict: false,
      }),
      texteAccessible,
    };
  } catch {
    return { html: null, texteAccessible };
  }
}
