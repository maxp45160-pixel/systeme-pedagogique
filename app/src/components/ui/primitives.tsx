import type { ReactNode } from "react";
import type { Confiance, NiveauCompetence } from "@/lib/domain/types";

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
  id,
}: {
  children: ReactNode;
  className?: string;
  /** Liseré supérieur pour distinguer la carte principale d'un écran. */
  accent?: boolean;
  /** Identifiant d'ancrage (ex. `#preuve-manuelle` pour un lien ciblé). */
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cx(
        "rounded-carte border bg-surface shadow-[var(--ombre-carte)]",
        accent ? "border-primaire/40 ring-1 ring-primaire/10" : "border-bordure",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function EnTeteCarte({
  titre,
  legende,
  action,
}: {
  titre: string;
  legende?: string;
  action?: ReactNode;
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
        <h2 className="font-serif text-[1.0625rem] font-medium tracking-tight">{titre}</h2>
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

type TonBandeau = "info" | "primaire" | "alerte";

const TONS_BANDEAU: Record<TonBandeau, string> = {
  info: "border-info/30 bg-info-faible",
  primaire: "border-primaire/30 bg-surface-2",
  alerte: "border-alerte/30 bg-alerte-faible",
};

/**
 * Bandeau d'information resserré, utilisé en tête de page pour signaler un
 * état (initialisation, périmètre, exercice en cours…). Uniformise le pattern
 * qui était réécrit à chaque page.
 */
export function BandeauInfo({
  ton = "info",
  children,
  className,
}: {
  ton?: TonBandeau;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex items-start gap-2.5 rounded-carte border px-4 py-2.5 text-xs",
        TONS_BANDEAU[ton],
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lignes de liste                                                     */
/* ------------------------------------------------------------------ */

/**
 * Ligne de liste, standard de l'application.
 *
 * Le padding et le survol étaient réécrits dans chaque page (`LigneExercice`,
 * `LigneCompetence`, manifeste du tuteur…). Une seule primitive les porte.
 * Le contenu (lien, actions…) est passé en children pour rester flexible.
 */
export function LigneListe({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <li className={cx("px-5 py-3.5 transition-colors hover:bg-surface-2", className)}>
      {children}
    </li>
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
 * La confiance accompagne systématiquement tout indicateur chiffré
 * (protocole anti-hallucination §10 et §14).
 */
export function TagConfiance({ confiance }: { confiance: Confiance }) {
  return (
    <Etiquette ton={TON_CONFIANCE[confiance]}>
      Confiance&nbsp;: {confiance === "nulle" ? "non évaluable" : confiance}
    </Etiquette>
  );
}

/** « Basé sur N preuves » — jamais un chiffre sans son assise. */
export function NombrePreuves({ n }: { n: number }) {
  return (
    <span className="text-xs text-texte-discret">
      {n === 0 ? "Aucune preuve" : `Basé sur ${n} preuve${n > 1 ? "s" : ""}`}
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

export function BarreProgression({
  fraction,
  ton = "primaire",
  className,
}: {
  fraction: number;
  ton?: "primaire" | "neutre" | "succes";
  className?: string;
}) {
  const couleur =
    ton === "succes" ? "var(--succes)" : ton === "neutre" ? "var(--bordure-forte)" : "var(--primaire)";
  return (
    <div
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
      role="presentation"
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, background: couleur }}
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

const VARIANTES = {
  principal:
    "bg-primaire text-primaire-contraste hover:bg-primaire-fort border-transparent",
  secondaire:
    "bg-surface text-texte hover:bg-surface-2 border-bordure-forte",
  discret: "bg-transparent text-texte-attenue hover:bg-surface-2 hover:text-texte border-transparent",
} as const;

const TAILLES = {
  normale: "h-9 px-3.5 text-sm",
  petite: "h-7 px-2.5 text-xs",
} as const;

export function classesBouton(
  variante: keyof typeof VARIANTES = "secondaire",
  taille: keyof typeof TAILLES = "normale",
): string {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTES[variante],
    TAILLES[taille],
  );
}

/* ------------------------------------------------------------------ */
/* Divers                                                              */
/* ------------------------------------------------------------------ */

export function Separateur({ className }: { className?: string }) {
  return <div className={cx("h-px w-full bg-bordure", className)} />;
}

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