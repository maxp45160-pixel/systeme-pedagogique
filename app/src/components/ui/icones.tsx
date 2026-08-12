/**
 * Jeu d'icônes minimal, tracé à la main.
 *
 * Un seul style : trait de 1,5 px, extrémités arrondies, grille 24.
 * Aucune bibliothèque, aucune icône décorative — chaque icône identifie
 * une destination ou une action.
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
