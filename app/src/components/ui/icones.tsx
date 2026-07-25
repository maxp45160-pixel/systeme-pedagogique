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

export const IconeProjets = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h9A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18Z" />
  </Svg>
);

export const IconeConnaissances = ({ className }: Props) => (
  <Svg className={className}>
    <circle cx="12" cy="5" r="2.2" />
    <circle cx="5" cy="17" r="2.2" />
    <circle cx="19" cy="17" r="2.2" />
    <path d="M10.4 6.8 6.6 15.2M13.6 6.8l3.8 8.4M7.2 17h9.6" />
  </Svg>
);

export const IconeLectures = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M12 6.5C10.5 5 8.5 4.5 4 4.5v13c4.5 0 6.5.5 8 2 1.5-1.5 3.5-2 8-2v-13c-4.5 0-6.5.5-8 2Z" />
    <path d="M12 6.5v13" />
  </Svg>
);

export const IconeProgression = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M3 19h18" />
    <path d="M4.5 15.5 9 10.5l3.5 3 6-7.5" />
    <path d="M18.5 6h-3.2M18.5 6v3.2" />
  </Svg>
);

export const IconeTuteur = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6.5L7 20v-4H6a2 2 0 0 1-2-2Z" />
    <path d="M9.5 8.75a2.5 2.5 0 1 1 3 2.45V12" />
  </Svg>
);

export const IconeJournal = ({ className }: Props) => (
  <Svg className={className}>
    <rect x="4" y="4" width="16" height="17" rx="2" />
    <path d="M8 3v3M16 3v3M4 9.5h16M8 13.5h2M8 17h2M14 13.5h2" />
  </Svg>
);

export const IconeErreurs = ({ className }: Props) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V13M12 16.2v.3" />
  </Svg>
);

export const IconeSoleil = ({ className }: Props) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
  </Svg>
);

export const IconeLune = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
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

export const IconeMenu = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const IconeFeuille = ({ className }: Props) => (
  <Svg className={className}>
    <path d="M5 20c-1-8 4-15 15-16 1 11-5 16-15 16Z" />
    <path d="M5 20c2.5-4.5 6-7.5 11-9" />
  </Svg>
);
