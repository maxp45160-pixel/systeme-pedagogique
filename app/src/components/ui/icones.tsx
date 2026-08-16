/**
 * Jeu d'icônes minimal, tracé à la main.
 *
 * Un seul style : trait de 1,5 px, extrémités arrondies, grille 24.
 * Aucune bibliothèque, aucune icône décorative — chaque icône identifie
 * une destination, une action ou un type de fiche.
 *
 * Les icônes de type de fiche sont associées aux types documentaires par
 * `NomIcone` (`lib/documents/types-documents.ts`) et résolues en composant
 * par `icone-document.tsx` : le registre reste sans JSX.
 */

type Props = { className?: string };

function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-[18px]"}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const IconeTableauBord = ({ className }: Props) => (
  <Svg className={className}>
    <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
    <rect x="13.5" y="12" width="7.5" height="9" rx="1.5" />
    <rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5" />
  </Svg>
);

export const IconeCompetences = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M4 20V10M9.33 20V5M14.67 20v-7M20 20V8" />
  </Svg>
);

export const IconeExercices = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H17a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5A1.5 1.5 0 0 1 5 19.5Z" />
    <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
  </Svg>
);

/** L'administration des comptes et des accès — voir `app/(app)/admin`. */
export const IconeCle = ({ className }: Props) => (
  <Svg className={className}>
    <circle cx="8" cy="15" r="4" />
    <path d="M10.85 12.15 20 3M17 6l2.5 2.5M14 9l2.5 2.5" />
  </Svg>
);

/** Le point d'entrée unique de création — voir `components/intention`. */
export const IconePlus = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconeFleche = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const IconeAmpoule = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M9 17.5h6M10 20.5h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9V15a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-1.1A6 6 0 0 0 12 3Z" />
  </Svg>
);

export const IconeValide = ({ className }: Props) => (
  <Svg className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const IconeFeuille = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M5 20c-1-8 4-15 15-16 1 11-5 16-15 16Z" />
    <path d="M5 20c2.5-4.5 6-7.5 11-9" />
  </Svg>
);

export const IconeDocuments = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M6 3.5h8l4 4V20.5H6Z" />
    <path d="M14 3.5v4h4M9 12h6M9 15.5h6" />
  </Svg>
);

export const IconeChevron = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

export const IconeDossier = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M3 7V6a2 2 0 0 1 2-2h4.5L12 6h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </Svg>
);

export const IconeDomaine = ({ className }: Props) => (
  <Svg className={className}>
    <path d="m12 3 7 4-7 4-7-4Z" />
    <path d="m5 11 7 4 7-4" />
    <path d="m5 15 7 4 7-4" />
  </Svg>
);

export const IconeTheme = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M3 12 7 8V6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2Z" />
    <circle cx="15" cy="12" r="1.2" />
  </Svg>
);

export const IconeNote = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M6 3.5V20.5h8.5L18 17V3.5H6Z" />
    <path d="M14.5 20.5V17h3.5" />
    <path d="M9 9h6M9 12.5h6" />
  </Svg>
);

export const IconeReference = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M7 3.5h10a2 2 0 0 1 2 2V21l-6-3.5-6 3.5V5.5a2 2 0 0 1 2-2Z" />
  </Svg>
);

export const IconeArticle = ({ className }: Props) => (
  <Svg className={className}>
    <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
    <path d="M7 8.5h4M7 12h4M7 15.5h3" />
    <path d="M13.5 8.5h3.5M13.5 12h2.5M13.5 15.5h3" />
  </Svg>
);

export const IconeCours = ({ className }: Props) => (
  <Svg className={className}>
    <rect x="3.5" y="4" width="17" height="11" rx="1.5" />
    <path d="M12 15v4M8 21h8" />
  </Svg>
);

export const IconeLivre = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H12v16H6.5A1.5 1.5 0 0 1 5 18.5Z" />
    <path d="M19 5.5A1.5 1.5 0 0 0 17.5 4H12v16h5.5A1.5 1.5 0 0 0 19 18.5Z" />
  </Svg>
);

export const IconeFormule = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M10 4.5c-2 2-2 13 0 15" />
    <path d="M14 4.5c2 2 2 13 0 15" />
    <path d="m11 9.5 4 5m-4 0 4-5" />
  </Svg>
);

export const IconeProjet = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M4.5 3v18" />
    <path d="M4.5 4.5h10l-2.5 3 2.5 3h-10Z" />
  </Svg>
);

export const IconeEtudeDeCas = ({ className }: Props) => (
  <Svg className={className}>
    <circle cx="10.5" cy="10.5" r="4.5" />
    <path d="m14 14 5 5" />
    <path d="M4 19.5h7M4 21.5h6" />
  </Svg>
);

export const IconeRedaction = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M7 21a2.85 2.83 0 1 1-4-4L16.5 3.5 22 2l-1.5 5.5Z" />
  </Svg>
);

export const IconeSchema = ({ className }: Props) => (
  <Svg className={className}>
    <circle cx="7" cy="7" r="2.5" />
    <circle cx="17" cy="7" r="2.5" />
    <circle cx="12" cy="17" r="2.5" />
    <path d="M9 8.5 10.5 14.5M15 8.5 13.5 14.5" />
  </Svg>
);

export const IconeExperimentation = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M9.5 3v5L5 18a2 2 0 0 0 1.9 3h10.2A2 2 0 0 0 19 18L14.5 8V3Z" />
    <path d="M8.5 3h7" />
    <path d="M6.5 15.5h11" />
  </Svg>
);

export const IconePreuve = ({ className }: Props) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.5 2.5 2.5 4.5-5" />
  </Svg>
);
