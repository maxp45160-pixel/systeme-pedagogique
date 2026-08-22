import { Fragment } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Confiance, NiveauCompetence } from "@/lib/domain/types";
import { IconeFeuille } from "./icones";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function Carte({
  children,
  className,
  accent,
  interactive,
  id,
}: {
  children: ReactNode;
  className?: string;
  /** Liseré supérieur pour distinguer la carte principale d'un écran. */
  accent?: boolean;
  /**
   * La carte enveloppe un lien ou un bouton et doit le signaler au survol.
   * `shadow-levee` — pas le `shadow-md` par défaut de Tailwind, sans lien
   * avec l'échelle à 3 niveaux du produit. La carte reste un `<section>` :
   * c'est l'enfant interactif qui porte le focus et le clic, jamais elle.
   */
  interactive?: boolean;
  /** Identifiant d'ancrage (ex. `#observation-manuelle` pour un lien ciblé). */
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cx(
        "rounded-carte border bg-surface shadow-[var(--ombre-carte)]",
        accent ? "border-primaire/40 ring-1 ring-primaire/10" : "border-bordure",
        interactive && "transition-shadow hover:shadow-levee",
        className,
      )}
    >
      {children}
    </section>
  );
}

/**
 * Filigrane botanique — le rappel décoratif des grandes surfaces.
 *
 * Une feuille en très faible opacité, ancrée en bas à droite d'un conteneur
 * `relative overflow-hidden`. Purement ornementale : jamais interactive,
 * jamais porteuse d'information. Le conteneur doit être `isolate` (ou porter
 * un empilement maîtrisé) si l'appelant veut la feuille derrière son contenu
 * (`-z-10`) ; dans une carte au contenu enveloppé dans un `relative`, la
 * position par défaut suffit.
 */
export function Filigrane({ className }: { className?: string }) {
  return (
    <IconeFeuille
      aria-hidden
      className={cx(
        "pointer-events-none absolute -bottom-8 -right-6 size-36 text-primaire opacity-[0.05]",
        className,
      )}
    />
  );
}

export function EnTeteCarte({
  titre,
  legende,
  action,
  id,
}: {
  titre: string;
  legende?: string;
  action?: ReactNode;
  /**
   * Posé sur le `<h2>`, avec `tabIndex={-1}` — rend le titre focusable par
   * programme, sans l'ajouter à l'ordre de tabulation normal. Sert un écran
   * qui déplace le focus vers un titre après une transition (un nouvel acte
   * qui remplace le précédent), sans en faire un arrêt au clavier de plus.
   */
  id?: string;
}) {
  return (
    // Sans légende le titre tient sur une ligne et l'action se centre dessus ;
    // avec légende le bloc devient haut, et une action centrée flotterait.
    <div
      className={cx(
        "flex justify-between gap-4 border-b border-bordure px-5 py-3.5",
        legende ? "items-start" : "items-center",
      )}
    >
      <div className="min-w-0">
        <h2
          id={id}
          tabIndex={id ? -1 : undefined}
          className="font-serif text-[1.0625rem] font-medium tracking-tight outline-none"
        >
          {titre}
        </h2>
        {legende && <p className="mt-0.5 text-xs text-texte-attenue">{legende}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Corps de carte.
 *
 * L'espacement intérieur des cartes était réécrit à chaque appel — on trouvait
 * six valeurs verticales différentes pour le même rôle. Une seule primitive le
 * possède désormais : changer la densité de l'application est une modification
 * d'une ligne, ici.
 */
export function CorpsCarte({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("px-5 py-4", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Bandeaux d'information                                              */
/* ------------------------------------------------------------------ */

type TonBandeau = "info" | "primaire" | "alerte" | "succes" | "danger";

const TONS_BANDEAU: Record<TonBandeau, string> = {
  info: "border-info/30 bg-info-faible",
  primaire: "border-primaire/30 bg-surface-2",
  alerte: "border-alerte/30 bg-alerte-faible",
  succes: "border-succes/30 bg-succes-faible",
  danger: "border-danger/30 bg-danger-faible",
};

const TAILLES_BANDEAU = {
  normale: "gap-2.5 rounded-carte px-4 py-2.5",
  /* Forme des 31 paragraphes d'alerte retapés à la main avant ce composant. */
  compacte: "gap-2 rounded-md px-3 py-2",
} as const;

/**
 * Bandeau d'information, utilisé en tête de page ou comme message de
 * formulaire. Uniformise un pattern qui était réécrit à la main dans 16
 * fichiers, 31 fois.
 *
 * `role` se déduit du ton : `alerte`/`danger` posent `role="alert"` — la
 * plupart de ces bandeaux apparaissent après une action ratée et doivent
 * être annoncés. `info`/`primaire`/`succes` n'en posent aucun : beaucoup sont
 * un texte explicatif statique, toujours affiché, et `role="alert"` dessus
 * annoncerait sans raison à chaque lecture d'écran.
 */
export function BandeauInfo({
  ton = "info",
  taille = "normale",
  children,
  className,
}: {
  ton?: TonBandeau;
  taille?: keyof typeof TAILLES_BANDEAU;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={ton === "alerte" || ton === "danger" ? "alert" : undefined}
      className={cx(
        "flex items-start border text-xs",
        TAILLES_BANDEAU[taille],
        TONS_BANDEAU[ton],
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sélecteur segmenté                                                   */
/* ------------------------------------------------------------------ */

export interface OptionSegmentee<T extends string> {
  cle: T;
  libelle: string;
}

/**
 * Sélecteur segmenté — un état parmi plusieurs, montrés côte à côte.
 *
 * Trois copies visuellement identiques existaient (bascule de vue sur
 * sélecteur de référentiel, sélecteur de période, choix d'apparence), mais deux natures
 * différentes se cachaient dessous : un état **partageable par URL** (un
 * `<Link>`, on doit pouvoir l'ouvrir dans un nouvel onglet ou le mettre en
 * favori) et une **préférence locale** (un `<button aria-pressed>`, elle ne
 * vit que dans cette session). Un composant qui forcerait l'un des deux
 * casserait l'autre — celui-ci ne possède donc que l'habillage et l'état actif
 * calculé ; l'élément concret (`<Link>` ou `<button>`) reste au choix de
 * l'appelant, via `rendreItem`.
 */
export function SelecteurSegmente<T extends string>({
  options,
  actif,
  className,
  rendreItem,
}: {
  options: OptionSegmentee<T>[];
  actif: T;
  className?: string;
  /**
   * Rend une option : reçoit ses classes déjà calculées (actif/inactif) à
   * appliquer sur l'élément interactif choisi par l'appelant.
   */
  rendreItem: (option: OptionSegmentee<T>, classesItem: string, estActif: boolean) => ReactNode;
}) {
  return (
    <div className={cx("flex flex-wrap rounded-md border border-bordure p-0.5", className)}>
      {options.map((o) => {
        const estActifItem = o.cle === actif;
        const classesItem = cx(
          "rounded px-2.5 py-1 text-xs font-medium transition-colors",
          estActifItem ? "bg-primaire-faible text-primaire" : "text-texte-attenue hover:text-texte",
        );
        return <Fragment key={o.cle}>{rendreItem(o, classesItem, estActifItem)}</Fragment>;
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Étiquettes                                                          */
/* ------------------------------------------------------------------ */

type Ton = "neutre" | "primaire" | "succes" | "alerte" | "info" | "danger";

const TONS: Record<Ton, string> = {
  neutre: "border-bordure bg-surface-2 text-texte-attenue",
  primaire: "border-primaire/25 bg-primaire-faible text-primaire",
  succes: "border-succes/25 bg-succes-faible text-succes",
  alerte: "border-alerte/25 bg-alerte-faible text-alerte",
  info: "border-info/25 bg-info-faible text-info",
  danger: "border-danger/25 bg-danger-faible text-danger",
};

export function Etiquette({
  children,
  ton = "neutre",
  mono,
  className,
}: {
  children: ReactNode;
  ton?: Ton;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.6875rem] font-medium leading-normal",
        TONS[ton],
        mono && "font-mono tracking-tight",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Point pulsant — signale une activité en cours (réponse du tuteur en train
 * de s'écrire, action en attente). Dupliqué à l'identique dans 8 endroits
 * avant ce composant.
 */
export function PointActif({ className }: { className?: string }) {
  return <span aria-hidden className={cx("size-1.5 animate-pulse rounded-full bg-primaire", className)} />;
}

export function CodeCompetence({ code }: { code: string }) {
  return (
    <span className="font-mono text-[0.6875rem] font-medium tracking-tight text-texte-discret">
      {code}
    </span>
  );
}

const TON_CONFIANCE: Record<Confiance, Ton> = {
  nulle: "neutre",
  faible: "alerte",
  moyenne: "info",
  forte: "succes",
};

/**
 * Ce que la confiance dit — et ce qu'elle ne dit pas.
 *
 * Elle porte sur **les observations**, pas sur la personne : combien il y en a, sur
 * combien de contextes, à quelle distance dans le temps. Une confiance faible
 * n'est donc pas un mauvais niveau, c'est un niveau mal établi — les deux se
 * corrigent par des gestes opposés (refaire un exercice du même genre pour la
 * confiance, monter en difficulté pour le niveau).
 *
 * L'étiquette seule laissait les deux se confondre : elle est affichée à côté
 * de la jauge de niveau, dans le même bandeau, et rien ne disait qu'on ne lit
 * pas la même chose. L'explication est portée par `title` (survol) et par un
 * texte hors écran (lecteurs d'écran) plutôt que par une ligne de plus : le
 * bandeau est déjà dense, et cette précision n'est utile qu'une fois.
 */
const AIDE_CONFIANCE =
  "La confiance mesure l'assise des observations — leur nombre, leur variété, leur fraîcheur — pas le niveau atteint. Une confiance faible signale qu'il manque des mesures, pas que la compétence est faible.";

export function TagConfiance({ confiance }: { confiance: Confiance }) {
  return (
    <span title={AIDE_CONFIANCE} className="inline-flex">
      <Etiquette ton={TON_CONFIANCE[confiance]}>
        Confiance&nbsp;: {confiance === "nulle" ? "non évaluable" : confiance}
        <span className="sr-only"> — {AIDE_CONFIANCE}</span>
      </Etiquette>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Indicateurs                                                         */
/* ------------------------------------------------------------------ */

/** Niveau 0-5 en six segments. `null` = jamais évalué, tous les segments vides. */
export function JaugeNiveau({
  niveau,
  taille = "normale",
}: {
  niveau: NiveauCompetence | null;
  taille?: "normale" | "compacte";
}) {
  const h = taille === "compacte" ? "h-1" : "h-1.5";
  return (
    <div className="flex items-center gap-[3px]" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const rempli = niveau !== null && i <= niveau;
        return (
          <span
            key={i}
            className={cx("w-full rounded-[1px]", h)}
            style={{
              background: rempli ? `var(--niveau-${niveau})` : "var(--niveau-vide)",
              opacity: rempli ? 1 : 0.65,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Barre de progression — une seule fraction, 0 à 1.
 *
 * `libelle` porte l'`aria-label` : sans lui, un lecteur d'écran n'a que
 * « barre de progression, 43 % » sans savoir de quoi. Facultatif seulement
 * parce que l'unique usage actuel place déjà l'intitulé dans un `<span>`
 * juste à côté — un futur usage isolé doit le passer.
 */
export function BarreProgression({
  fraction,
  ton = "primaire",
  libelle,
  className,
}: {
  fraction: number;
  ton?: "primaire" | "neutre" | "succes";
  libelle?: string;
  className?: string;
}) {
  const couleur =
    ton === "succes" ? "var(--succes)" : ton === "neutre" ? "var(--bordure-forte)" : "var(--primaire)";
  const pourcent = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return (
    <div
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
      role="progressbar"
      aria-valuenow={pourcent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={libelle}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pourcent}%`, background: couleur }}
      />
    </div>
  );
}

/**
 * Valeur chiffrée. `valeur === null` affiche « — » : on ne remplace jamais
 * une absence de mesure par un zéro (protocole anti-hallucination §7).
 */
export function Statistique({
  libelle,
  valeur,
  unite,
  precision,
  ton,
}: {
  libelle: string;
  valeur: number | string | null;
  unite?: string;
  precision?: string;
  ton?: "primaire";
}) {
  return (
    <div className="min-w-0">
      <div className="text-[0.6875rem] uppercase tracking-wide text-texte-discret">{libelle}</div>
      {/* `chiffres` sur le conteneur, pas sur la valeur seule : l'unité (« / 100 »,
          « / 5 ») porte elle aussi des chiffres qui doivent rester alignés. */}
      <div className="chiffres mt-1 flex items-baseline gap-1">
        <span
          className={cx(
            "text-xl font-semibold tracking-tight",
            valeur === null && "text-texte-discret",
            ton === "primaire" && valeur !== null && "text-primaire",
          )}
        >
          {valeur === null ? "—" : valeur}
        </span>
        {unite && <span className="text-xs text-texte-attenue">{unite}</span>}
      </div>
      {precision && <div className="mt-0.5 text-xs text-texte-discret">{precision}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* États vides                                                         */
/* ------------------------------------------------------------------ */

/**
 * Au jour 0 ce n'est pas un cas dégradé : c'est l'écran normal.
 * Le message dit ce qui manque et ce qui le débloque, sans jamais
 * simuler une donnée.
 */
export function EtatVide({
  titre,
  message,
  action,
  icone,
}: {
  titre: string;
  message: string;
  action?: ReactNode;
  icone?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icone && <div className="mb-3 text-texte-discret">{icone}</div>}
      <p className="text-sm font-medium">{titre}</p>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-texte-attenue">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Boutons                                                             */
/* ------------------------------------------------------------------ */

type VarianteBouton = "principal" | "secondaire" | "discret" | "danger";
type TailleBouton = "normale" | "compacte" | "petite";

const VARIANTES_BOUTON: Record<VarianteBouton, string> = {
  principal: "bg-primaire text-primaire-contraste hover:bg-primaire-fort border-transparent",
  secondaire: "bg-surface text-texte hover:bg-surface-2 border-bordure-forte",
  discret: "bg-transparent text-texte-attenue hover:bg-surface-2 hover:text-texte border-transparent",
  /*
    Une seule recette « danger », choisie parce qu'elle était déjà la
    majoritaire des trois qui coexistaient (validation-branche, gestion,
    compte). La version pleine (bg-danger text-white) n'est offerte nulle
    part : plus alarmante que toute action destructive réelle du produit.
  */
  danger: "border-danger/30 bg-danger-faible text-danger hover:bg-danger/10",
};

const TAILLES_BOUTON: Record<TailleBouton, string> = {
  normale: "h-9 px-3.5 text-sm",
  /* Calée sur l'usage réel de compte.tsx (6 boutons) — pas une invention. */
  compacte: "h-8 px-3 text-xs",
  petite: "h-7 px-2.5 text-xs",
};

function IconeChargement({ className }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeWidth="2.5" className="stroke-current opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeWidth="2.5" strokeLinecap="round" className="stroke-current" />
    </svg>
  );
}

/**
 * Classes visuelles de `Bouton`, pour les rares cas où l'élément ne peut pas
 * être un `<button>` — un `<Link>` de navigation qui doit avoir l'apparence
 * d'une action (ex. « Commencer », « Réaliser un diagnostic »). `Bouton`
 * les utilise en interne ; aucun appelant ne doit retaper ces chaînes.
 */
export function classesLienBouton(
  variante: VarianteBouton = "secondaire",
  taille: TailleBouton = "normale",
): string {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors",
    VARIANTES_BOUTON[variante],
    TAILLES_BOUTON[taille],
  );
}

/**
 * Intercalaire — l'onglet d'un séparateur de cahier.
 *
 * Les outils du workspace étaient une barre de boutons flottante posée sur la
 * page : quatre pastilles qui disaient « application », pas « cahier ». Un
 * intercalaire dit la même chose en une forme que l'objet possède déjà — une
 * languette qui monte de la ligne, arrondie en haut seulement, ouverte en bas
 * parce qu'elle appartient à ce qu'elle sépare.
 *
 * Une seule implémentation, consommée par `OutilSeance` et `TiroirTuteur` :
 * deux recettes divergentes pour le même objet, c'est exactement le défaut que
 * `classesLienBouton` existe pour empêcher.
 *
 * ⚠️ `-mb-px` : la languette doit mordre la ligne qui la porte, sinon elle
 * flotte un pixel au-dessus et le dessin se casse.
 */
export function classesIntercalaire(actif = false): string {
  return cx(
    "relative -mb-px inline-flex cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-xs transition-colors",
    actif
      ? "border-bordure bg-surface font-semibold text-texte shadow-[inset_0_-1px_0_var(--primaire)]"
      : "border-transparent text-texte-attenue hover:bg-surface-2/60 hover:text-texte",
  );
}

/**
 * Bouton d'action, seule primitive de bouton de l'application.
 *
 * `type="button"` par défaut — un `<button>` natif dans un `<form>` vaut
 * `submit` par défaut, et c'est exactement le piège qu'un composant wrapper
 * peut cacher. `type="submit"` reste possible, explicitement.
 *
 * Le focus ne porte aucune classe : la règle globale `:focus-visible` de
 * `globals.css` s'en charge, comme elle le fait déjà pour tout le reste.
 *
 * `enChargement` force `disabled` (pas de double-soumission), pose
 * `aria-busy`, et préfixe le libellé d'un indicateur — le libellé reste
 * affiché, jamais remplacé : le faire disparaître au moment où l'état
 * change prive les lecteurs d'écran du nom de l'action en cours.
 */
export function Bouton({
  variante = "secondaire",
  taille = "normale",
  enChargement = false,
  disabled,
  type = "button",
  className,
  children,
  ...reste
}: {
  variante?: VarianteBouton;
  taille?: TailleBouton;
  enChargement?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={disabled || enChargement}
      aria-busy={enChargement || undefined}
      className={cx(
        classesLienBouton(variante, taille),
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...reste}
    >
      {enChargement && <IconeChargement className="size-3.5 shrink-0" />}
      {children}
      {enChargement && (
        <span className="sr-only" aria-live="polite">
          Chargement…
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Divers                                                              */
/* ------------------------------------------------------------------ */


export function TitreSection({
  children,
  legende,
  action,
}: {
  children: ReactNode;
  legende?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{children}</h2>
        {legende && <p className="mt-0.5 text-xs text-texte-attenue">{legende}</p>}
      </div>
      {action}
    </div>
  );
}
