"use client";

import { useEffect, useRef, useState, useDeferredValue, type RefObject } from "react";
import { insererFormuleDansTexte } from "@/lib/ui/insertion-formule";
import { contientFormuleLatex } from "@/lib/ui/formule";
import { Markdown } from "@/components/ui/markdown";

/**
 * Palette de symboles mathématiques pour la barre d'outils d'un éditeur.
 *
 * ## Le problème qu'elle règle (23/08/2026)
 *
 * La barre de l'espace documentaire offrait six insertions : formule en ligne,
 * fraction, racine, somme, intégrale, exposant. Pas de multiplication, pas de
 * « inférieur ou égal », pas une lettre grecque — c'est-à-dire pas de quoi
 * écrire la moindre formule réelle sans connaître LaTeX par cœur. Écrire des
 * mathématiques revenait à se souvenir de `\leq` et à le taper à la main.
 *
 * ## Ce qu'elle est, et ce qu'elle n'est pas
 *
 * Un **clavier**, pas un éditeur d'équations : chaque touche insère du LaTeX
 * au curseur, et c'est tout. Le rendu reste le travail de `FormuleMath`
 * (KaTeX), le repli textuel celui de `lib/ui/formule.ts`. Aucun symbole
 * proposé ici n'est absent de ces deux-là — une touche qui insérerait une
 * commande que le repli ne sait pas lire produirait un texte illisible dès que
 * KaTeX refuse la formule.
 *
 * Le libellé d'une touche est le **glyphe rendu**, jamais le nom de la
 * commande : on choisit « ≤ », on n'apprend pas `\leq`.
 */

/** Une touche : ce qu'on voit, ce qui s'écrit, où le curseur atterrit. */
type SymboleFormule = {
  /** Glyphe affiché sur la touche. */
  glyphe: string;
  /** LaTeX inséré au curseur. */
  insere: string;
  /** Nom lisible — infobulle et nom accessible. */
  nom: string;
  /**
   * Nombre de caractères dont reculer le curseur après insertion. `\frac{}{}`
   * vaut 3 : le curseur se pose dans le numérateur, prêt à écrire.
   */
  recul?: number;
  /** Touche large : les structures ont besoin de deux colonnes. */
  large?: boolean;
};

type CategorieSymboles = { titre: string; symboles: readonly SymboleFormule[] };

const CATEGORIES: readonly CategorieSymboles[] = [
  {
    titre: "Opérations",
    symboles: [
      { glyphe: "×", insere: "\\times ", nom: "Multiplié par" },
      { glyphe: "÷", insere: "\\div ", nom: "Divisé par" },
      { glyphe: "·", insere: "\\cdot ", nom: "Point de multiplication" },
      { glyphe: "±", insere: "\\pm ", nom: "Plus ou moins" },
      { glyphe: "∓", insere: "\\mp ", nom: "Moins ou plus" },
      { glyphe: "∘", insere: "\\circ ", nom: "Composition" },
      { glyphe: "⊗", insere: "\\otimes ", nom: "Produit tensoriel" },
      { glyphe: "⊕", insere: "\\oplus ", nom: "Somme directe" },
    ],
  },
  {
    titre: "Relations",
    symboles: [
      { glyphe: "≤", insere: "\\leq ", nom: "Inférieur ou égal" },
      { glyphe: "≥", insere: "\\geq ", nom: "Supérieur ou égal" },
      { glyphe: "≠", insere: "\\neq ", nom: "Différent de" },
      { glyphe: "≈", insere: "\\approx ", nom: "Environ égal" },
      { glyphe: "≡", insere: "\\equiv ", nom: "Congru à" },
      { glyphe: "≃", insere: "\\simeq ", nom: "Isomorphe à" },
      { glyphe: "∝", insere: "\\propto ", nom: "Proportionnel à" },
      { glyphe: "∞", insere: "\\infty ", nom: "Infini" },
      { glyphe: "≪", insere: "\\ll ", nom: "Très inférieur à" },
      { glyphe: "≫", insere: "\\gg ", nom: "Très supérieur à" },
      { glyphe: "°", insere: "^\\circ ", nom: "Degré" },
      { glyphe: "′", insere: "'", nom: "Prime" },
    ],
  },
  {
    titre: "Structures",
    symboles: [
      { glyphe: "a⁄b", insere: "\\frac{}{}", nom: "Fraction", recul: 3, large: true },
      { glyphe: "√", insere: "\\sqrt{}", nom: "Racine carrée", recul: 1 },
      { glyphe: "ⁿ√", insere: "\\sqrt[]{}", nom: "Racine n-ième", recul: 3 },
      { glyphe: "xⁿ", insere: "^{}", nom: "Exposant", recul: 1 },
      { glyphe: "xₙ", insere: "_{}", nom: "Indice", recul: 1 },
      { glyphe: "∑", insere: "\\sum_{}^{}", nom: "Somme", recul: 4 },
      { glyphe: "∏", insere: "\\prod_{}^{}", nom: "Produit", recul: 4 },
      { glyphe: "∫", insere: "\\int_{}^{}", nom: "Intégrale", recul: 4 },
      { glyphe: "∮", insere: "\\oint ", nom: "Intégrale curviligne" },
      { glyphe: "lim", insere: "\\lim_{}", nom: "Limite", recul: 1 },
      { glyphe: "∂", insere: "\\partial ", nom: "Dérivée partielle" },
      { glyphe: "∇", insere: "\\nabla ", nom: "Nabla" },
      { glyphe: "|x|", insere: "\\left|\\right|", nom: "Valeur absolue", recul: 7 },
      { glyphe: "‖x‖", insere: "\\left\\|\\right\\|", nom: "Norme", recul: 8 },
      { glyphe: "x̄", insere: "\\bar{}", nom: "Moyenne (barre)", recul: 1 },
      { glyphe: "x⃗", insere: "\\vec{}", nom: "Vecteur", recul: 1 },
      { glyphe: "x̂", insere: "\\hat{}", nom: "Estimateur (chapeau)", recul: 1 },
      { glyphe: "C(n,k)", insere: "\\binom{}{}", nom: "Coefficient binomial", recul: 3, large: true },
      {
        glyphe: "( ⋮ )",
        insere: "\\begin{pmatrix} & \\\\ & \\end{pmatrix}",
        nom: "Matrice 2×2",
        recul: 20,
        large: true,
      },
      {
        glyphe: "{ ⋮",
        insere: "\\begin{cases} \\\\ \\end{cases}",
        nom: "Système d'équations",
        recul: 14,
        large: true,
      },
    ],
  },
  {
    titre: "Grec",
    symboles: [
      { glyphe: "α", insere: "\\alpha ", nom: "Alpha" },
      { glyphe: "β", insere: "\\beta ", nom: "Bêta" },
      { glyphe: "γ", insere: "\\gamma ", nom: "Gamma" },
      { glyphe: "δ", insere: "\\delta ", nom: "Delta" },
      { glyphe: "ε", insere: "\\varepsilon ", nom: "Epsilon" },
      { glyphe: "θ", insere: "\\theta ", nom: "Thêta" },
      { glyphe: "λ", insere: "\\lambda ", nom: "Lambda" },
      { glyphe: "μ", insere: "\\mu ", nom: "Mu" },
      { glyphe: "ν", insere: "\\nu ", nom: "Nu" },
      { glyphe: "π", insere: "\\pi ", nom: "Pi" },
      { glyphe: "ρ", insere: "\\rho ", nom: "Rhô" },
      { glyphe: "σ", insere: "\\sigma ", nom: "Sigma" },
      { glyphe: "τ", insere: "\\tau ", nom: "Tau" },
      { glyphe: "φ", insere: "\\varphi ", nom: "Phi" },
      { glyphe: "χ", insere: "\\chi ", nom: "Chi" },
      { glyphe: "ψ", insere: "\\psi ", nom: "Psi" },
      { glyphe: "ω", insere: "\\omega ", nom: "Oméga" },
      { glyphe: "Γ", insere: "\\Gamma ", nom: "Gamma majuscule" },
      { glyphe: "Δ", insere: "\\Delta ", nom: "Delta majuscule" },
      { glyphe: "Θ", insere: "\\Theta ", nom: "Thêta majuscule" },
      { glyphe: "Λ", insere: "\\Lambda ", nom: "Lambda majuscule" },
      { glyphe: "Π", insere: "\\Pi ", nom: "Pi majuscule" },
      { glyphe: "Σ", insere: "\\Sigma ", nom: "Sigma majuscule" },
      { glyphe: "Φ", insere: "\\Phi ", nom: "Phi majuscule" },
      { glyphe: "Ω", insere: "\\Omega ", nom: "Oméga majuscule" },
    ],
  },
  {
    titre: "Ensembles et logique",
    symboles: [
      { glyphe: "∈", insere: "\\in ", nom: "Appartient à" },
      { glyphe: "∉", insere: "\\notin ", nom: "N'appartient pas à" },
      { glyphe: "⊂", insere: "\\subset ", nom: "Inclus dans" },
      { glyphe: "⊆", insere: "\\subseteq ", nom: "Inclus ou égal" },
      { glyphe: "∪", insere: "\\cup ", nom: "Union" },
      { glyphe: "∩", insere: "\\cap ", nom: "Intersection" },
      { glyphe: "∖", insere: "\\setminus ", nom: "Privé de" },
      { glyphe: "∅", insere: "\\emptyset ", nom: "Ensemble vide" },
      { glyphe: "∀", insere: "\\forall ", nom: "Pour tout" },
      { glyphe: "∃", insere: "\\exists ", nom: "Il existe" },
      { glyphe: "∄", insere: "\\nexists ", nom: "Il n'existe pas" },
      { glyphe: "¬", insere: "\\neg ", nom: "Négation" },
      { glyphe: "∧", insere: "\\land ", nom: "Et logique" },
      { glyphe: "∨", insere: "\\lor ", nom: "Ou logique" },
      { glyphe: "⊥", insere: "\\perp ", nom: "Orthogonal" },
      { glyphe: "ℝ", insere: "\\mathbb{R}", nom: "Réels" },
      { glyphe: "ℕ", insere: "\\mathbb{N}", nom: "Entiers naturels" },
      { glyphe: "ℤ", insere: "\\mathbb{Z}", nom: "Entiers relatifs" },
      { glyphe: "ℚ", insere: "\\mathbb{Q}", nom: "Rationnels" },
      { glyphe: "ℂ", insere: "\\mathbb{C}", nom: "Complexes" },
    ],
  },
  {
    titre: "Flèches",
    symboles: [
      { glyphe: "→", insere: "\\to ", nom: "Vers" },
      { glyphe: "←", insere: "\\leftarrow ", nom: "Flèche gauche" },
      { glyphe: "⇒", insere: "\\Rightarrow ", nom: "Implique" },
      { glyphe: "⇐", insere: "\\Leftarrow ", nom: "Impliqué par" },
      { glyphe: "⇔", insere: "\\iff ", nom: "Équivaut à" },
      { glyphe: "↦", insere: "\\mapsto ", nom: "A pour image" },
      { glyphe: "↑", insere: "\\uparrow ", nom: "Flèche haut" },
      { glyphe: "↓", insere: "\\downarrow ", nom: "Flèche bas" },
      { glyphe: "∴", insere: "\\therefore ", nom: "Donc" },
      { glyphe: "∵", insere: "\\because ", nom: "Car" },
      { glyphe: "…", insere: "\\dots ", nom: "Points de suspension" },
      { glyphe: "⋯", insere: "\\cdots ", nom: "Points centrés" },
    ],
  },
];

/** Les deux enveloppes de formule — celles par lesquelles tout commence. */
const ENVELOPPES: readonly SymboleFormule[] = [
  { glyphe: "\\( \\)", insere: "\\(\\)", nom: "Formule dans le texte", recul: 2, large: true },
  { glyphe: "\\[ \\]", insere: "\\[\\]", nom: "Formule sur sa ligne", recul: 2, large: true },
];

export function PaletteFormules({
  onInserer,
  desactivee = false,
}: {
  /** Insère `latex` au curseur, puis recule le curseur de `recul` caractères. */
  onInserer: (latex: string, recul: number) => void;
  desactivee?: boolean;
}) {
  const [ouverte, setOuverte] = useState(false);
  const [categorie, setCategorie] = useState(CATEGORIES[0].titre);
  const racine = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouverte) return;
    function fermerSiExterieur(event: PointerEvent) {
      if (event.target instanceof Node && !racine.current?.contains(event.target)) {
        setOuverte(false);
      }
    }
    function fermerAvecEchap(event: KeyboardEvent) {
      if (event.key === "Escape") setOuverte(false);
    }
    document.addEventListener("pointerdown", fermerSiExterieur);
    document.addEventListener("keydown", fermerAvecEchap);
    return () => {
      document.removeEventListener("pointerdown", fermerSiExterieur);
      document.removeEventListener("keydown", fermerAvecEchap);
    };
  }, [ouverte]);

  const active = CATEGORIES.find((c) => c.titre === categorie) ?? CATEGORIES[0];

  return (
    <div ref={racine} className="relative">
      <button
        type="button"
        disabled={desactivee}
        onClick={() => setOuverte((etat) => !etat)}
        aria-expanded={ouverte}
        aria-label="Palette de symboles mathématiques"
        title="Symboles mathématiques"
        className={[
          "flex min-h-11 touch-manipulation items-center justify-center gap-0.5 rounded-full px-3 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-8 sm:px-2 sm:text-[0.6875rem]",
          ouverte
            ? "bg-primaire text-texte-inverse shadow-xs"
            : "text-texte-attenue hover:bg-primaire/15 hover:text-primaire",
        ].join(" ")}
      >
        <span className="font-serif italic">f</span>
        <span aria-hidden>(x)</span>
      </button>

      {ouverte && (
        /*
          `left-1/2 -translate-x-1/2` : le panneau est plus large que son
          déclencheur, et la barre d'outils flotte au centre de l'éditeur.
          Ancré à gauche, il débordait de l'écran sur les fenêtres étroites.
        */
        <div
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 max-h-[min(30rem,calc(100dvh-1.5rem))] overflow-y-auto rounded-xl border border-bordure bg-surface p-2 shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-full sm:mt-2 sm:w-[min(24rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:overflow-visible"
          /* Le clic ne doit pas voler le focus : la sélection dans l'éditeur
             est le point d'insertion, et un `blur` la perdrait. */
          onPointerDown={(event) => event.preventDefault()}
        >
          <div className="mb-2 grid grid-cols-2 gap-1">
            {ENVELOPPES.map((symbole) => (
              <button
                key={symbole.nom}
                type="button"
                onClick={() => onInserer(symbole.insere, symbole.recul ?? 0)}
                title={symbole.nom}
                className="flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-md border border-bordure bg-surface-2 px-2 py-2 text-[0.6875rem] text-texte transition-colors hover:border-primaire/40 hover:text-primaire cursor-pointer"
              >
                <span className="font-mono">{symbole.glyphe}</span>
                <span className="text-texte-discret">{symbole.nom}</span>
              </button>
            ))}
          </div>

          <div
            className="mb-2 flex gap-1 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Familles de symboles"
          >
            {CATEGORIES.map((c) => (
              <button
                key={c.titre}
                type="button"
                role="tab"
                aria-selected={c.titre === active.titre}
                onClick={() => setCategorie(c.titre)}
                className={[
                  "min-h-11 shrink-0 touch-manipulation rounded-full px-3 py-2 text-[0.6875rem] font-medium transition-colors cursor-pointer sm:min-h-8 sm:px-2 sm:py-1",
                  c.titre === active.titre
                    ? "bg-primaire text-texte-inverse"
                    : "text-texte-attenue hover:bg-primaire/15 hover:text-primaire",
                ].join(" ")}
              >
                {c.titre}
              </button>
            ))}
          </div>

          <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto">
            {active.symboles.map((symbole) => (
              <button
                key={symbole.nom}
                type="button"
                onClick={() => onInserer(symbole.insere, symbole.recul ?? 0)}
                title={symbole.nom}
                aria-label={symbole.nom}
                className={[
                  "flex h-11 touch-manipulation items-center justify-center rounded-md border border-transparent text-sm text-texte transition-colors hover:border-primaire/40 hover:bg-primaire/10 hover:text-primaire cursor-pointer sm:h-9",
                  symbole.large ? "col-span-2 text-[0.6875rem]" : "",
                ].join(" ")}
              >
                {symbole.glyphe}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * La palette branchée sur une zone de texte brut.
 *
 * C'est la variante qui sert partout où l'on écrit vraiment sans éditeur
 * riche : la **fiche de saisie** de l'Atelier (une zone par section), l'énoncé
 * et la correction d'un exercice, la réponse qu'on rédige. Ces surfaces
 * portent du Markdown, donc du LaTeX ; elles n'avaient aucun moyen d'en
 * produire autrement qu'en le tapant de mémoire.
 *
 * Le champ reste maître de sa valeur : on ne l'écrit pas directement, on rend
 * la nouvelle chaîne à son `onChange`. Le curseur est reposé après le rendu —
 * React aura remplacé la valeur d'ici là, et le poser avant ne survivrait pas.
 */
export function PaletteFormulesTexte({
  champ,
  valeur,
  onChange,
  desactivee = false,
}: {
  champ: RefObject<HTMLTextAreaElement | null>;
  valeur: string;
  onChange: (valeur: string) => void;
  desactivee?: boolean;
}) {
  return (
    <PaletteFormules
      desactivee={desactivee}
      onInserer={(latex, recul) => {
        const element = champ.current;
        const debut = element?.selectionStart ?? valeur.length;
        const fin = element?.selectionEnd ?? valeur.length;
        const { texte, curseur } = insererFormuleDansTexte(valeur, debut, fin, latex, recul);
        onChange(texte);
        requestAnimationFrame(() => {
          element?.focus();
          element?.setSelectionRange(curseur, curseur);
        });
      }}
    />
  );
}

/**
 * L'aperçu immédiat d'une zone de texte brut (25/08/2026).
 *
 * ## Le problème
 *
 * Les zones qui portent du Markdown+LaTeX (réponse d'exercice, chat, fiche de
 * saisie, intention) montraient la SOURCE : `\frac{a}{b}` restait des
 * antislashs jusqu'à l'enregistrement. Écrire une formule revenait à rédiger
 * à l'aveugle. Remplacer toutes les zones par un éditeur riche serait un
 * chantier disproportionné — et l'éditeur riche existe déjà là où le besoin
 * est réel (`EditeurDirect`, espace documentaire).
 *
 * ## Le choix
 *
 * La source RESTE éditable et maître du champ ; l'aperçu s'ajoute SOUS la
 * zone, rendu par le même `Markdown` que partout ailleurs — donc exactement ce
 * qui sera lu, y compris le repli Unicode quand KaTeX refuse une commande.
 * Il n'apparaît que si le texte contient une formule détectable
 * (`contientFormuleLatex`, même détection que le rendu) : pas de panneau de
 * plus sur une note sans mathématiques.
 *
 * Le rendu passe par `useDeferredValue` : la frappe reste prioritaire sur le
 * calcul KaTeX, qui peut coûter sur une longue réponse.
 *
 * Opt-in par surface (`<ApercuFormulesTexte valeur={...} />` posé sous le
 * champ) : les surfaces compactes (barre de marge fixe) décident elles-mêmes.
 */
export function ApercuFormulesTexte({ valeur }: { valeur: string }) {
  const valeurDifferree = useDeferredValue(valeur);
  if (!contientFormuleLatex(valeurDifferree)) return null;

  return (
    <div className="rounded-md border border-bordure bg-surface-2/50 px-3 py-2">
      <p className="mb-1 text-[0.625rem] font-semibold uppercase tracking-wider text-texte-discret">
        Aperçu
      </p>
      <div className="max-h-60 overflow-y-auto text-sm">
        <Markdown contenu={valeurDifferree} />
      </div>
    </div>
  );
}
