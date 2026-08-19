/**
 * Assistant d'orientation et diagnostic express pour le profil d'apprentissage.
 *
 * Fournit une structure en 3 questions simples pour aider un nouvel utilisateur
 * (ou un utilisateur souhaitant recalibrer son profil) à expliciter son point de
 * départ, son ambition et ses préférences pédagogiques, sans jargon abstrait.
 *
 * Module pur et déterministe : peut fonctionner hors ligne ou sans clé IA,
 * garantissant qu'aucune panne réseau ni absence de fournisseur ne bloque
 * l'onboarding (ADR-007, P1, P7).
 */

export interface NiveauDepartOption {
  id: string;
  titre: string;
  description: string;
  formationType: string;
}

export interface PreferenceApprentissageOption {
  id: string;
  libelle: string;
  description: string;
}

export interface SuggestionDomaine {
  id: string;
  nom: string;
  sujetExemple: string;
  objectifExemple: string;
  pointDeDepartExemple?: string;
  preferencesExemples?: string[];
}

export const NIVEAUX_DEPART: NiveauDepartOption[] = [
  {
    id: "debutant",
    titre: "Débutant complet",
    description: "Je découvre le sujet de zéro, sans prérequis particulier.",
    formationType: "Débutant complet — découverte du sujet",
  },
  {
    id: "autodidacte",
    titre: "Autodidacte / Pratique informelle",
    description: "J'ai déjà expérimenté ou bricolé par moi-même, je veux structurer.",
    formationType: "Pratique autodidacte et expérimentations personnelles",
  },
  {
    id: "academique",
    titre: "Formation initiale ou étudiant",
    description: "J'ai des bases théoriques ou un cursus en cours, je veux consolider.",
    formationType: "Formation académique ou cursus initial en cours",
  },
  {
    id: "professionnel",
    titre: "Professionnel / Reconversion",
    description: "J'ai un bagage pro et je vise une montée en compétences opérationnelle.",
    formationType: "Profil professionnel en montée en compétences ou reconversion",
  },
];

export const PREFERENCES_APPRENTISSAGE: PreferenceApprentissageOption[] = [
  {
    id: "pratiquer",
    libelle: "Pratiquer d'abord",
    description: "Mettre les mains dans le cambouis immédiatement avec des exercices.",
  },
  {
    id: "cas-concrets",
    libelle: "Des cas concrets",
    description: "Résoudre des situations réelles plutôt que des exemples abstraits.",
  },
  {
    id: "fondations",
    libelle: "Les fondations d'abord",
    description: "Comprendre les principes théoriques et la structure avant la pratique.",
  },
  {
    id: "pas-a-pas",
    libelle: "Pas à pas",
    description: "Découpage progressif, guidage pas-à-pas avec feedbacks détaillés.",
  },
  {
    id: "court-rapide",
    libelle: "Court et rapide",
    description: "Sessions ciblées et rythmées de 15 à 30 minutes.",
  },
  {
    id: "questions",
    libelle: "Beaucoup de questions",
    description: "Démarche socratique pour tester la compréhension en profondeur.",
  },
];

export const SUGGESTIONS_DOMAINES: SuggestionDomaine[] = [
  {
    id: "web",
    nom: "Développement Web",
    sujetExemple: "Architecture web moderne, React, TypeScript, APIs et bases de données",
    objectifExemple: "Concevoir et déployer des applications web complètes en autonomie",
    pointDeDepartExemple: "Notions de base en programmation ou reconversion",
    preferencesExemples: ["Pratiquer d'abord", "Pas à pas"],
  },
  {
    id: "data-ia",
    nom: "Data & IA",
    sujetExemple: "Machine Learning, LLMs, Python, pipelines de données et prompt engineering",
    objectifExemple: "Analyser des données complexes et intégrer des modèles d'IA",
    pointDeDepartExemple: "Bases en programmation ou statistiques",
    preferencesExemples: ["Pratiquer d'abord", "Des cas concrets"],
  },
  {
    id: "droit",
    nom: "Droit & Fiscalité",
    sujetExemple: "Droit des affaires, fiscalité d'entreprise, TVA, IS et contrats",
    objectifExemple: "Sécuriser des montages juridiques et maîtriser la conformité",
    pointDeDepartExemple: "Formation initiale en droit ou gestion",
    preferencesExemples: ["Des cas concrets", "Les fondations d'abord"],
  },
  {
    id: "langues",
    nom: "Anglais pro",
    sujetExemple: "Anglais professionnel, communication et négociation internationale",
    objectifExemple: "Animer des réunions et négocier avec aisance en anglais",
    pointDeDepartExemple: "Niveau intermédiaire (B1/B2)",
    preferencesExemples: ["Pratiquer d'abord", "Court et rapide"],
  },
  {
    id: "maths",
    nom: "Maths & Logique",
    sujetExemple: "Algèbre linéaire, probabilités appliquées et raisonnement formel",
    objectifExemple: "Résoudre des problèmes formels et structurer le raisonnement",
    pointDeDepartExemple: "Niveau scientifique / prépa",
    preferencesExemples: ["Les fondations d'abord", "Pas à pas"],
  },
  {
    id: "communication",
    nom: "Communication",
    sujetExemple: "Prise de parole en public, argumentation et persuasion",
    objectifExemple: "Captiver un auditoire et défendre des idées avec clarté",
    pointDeDepartExemple: "Pratique informelle / professionnel",
    preferencesExemples: ["Pratiquer d'abord", "Court et rapide"],
  },
];

export interface ReponsesOrientation {
  sujet: string;
  niveauId?: string;
  pointDeDepartPersonnalise?: string;
  preferencesChoisies: string[];
  rythmeHebdoHeures?: number;
}

export interface ProfilSynthetise {
  sujet: string;
  formation: string;
  objectifMoyenTerme: string;
  objectifLongTerme: string;
  preferencesPedagogiques: string[];
  plan: string;
}

/**
 * Synthétise un profil cohérent à partir des réponses de l'orientation express.
 * Fonction pure et sans effet de bord.
 */
export function synthetiserProfilDeterministe(
  reponses: ReponsesOrientation,
): ProfilSynthetise {
  const sujetPropre = reponses.sujet.trim();
  const niveau = NIVEAUX_DEPART.find((n) => n.id === reponses.niveauId);

  const formation =
    reponses.pointDeDepartPersonnalise?.trim() ||
    niveau?.formationType ||
    "Point de départ en cours de définition";

  // Formuler un objectif moyen terme pertinent selon le sujet et le niveau
  let objectifMoyenTerme = "";
  if (sujetPropre) {
    if (niveau?.id === "debutant") {
      objectifMoyenTerme = `Acquérir les fondamentaux solides et réussir mes premiers exercices autonomes sur ${sujetPropre}`;
    } else if (niveau?.id === "autodidacte") {
      objectifMoyenTerme = `Combler les angles morts, structurer mes connaissances et gagner en rigueur sur ${sujetPropre}`;
    } else if (niveau?.id === "professionnel") {
      objectifMoyenTerme = `Maîtriser les savoir-faire opérationnels avancés et les appliquer directement à mes projets sur ${sujetPropre}`;
    } else {
      objectifMoyenTerme = `Développer une pratique autonome et rigoureuse sur ${sujetPropre}`;
    }
  } else {
    objectifMoyenTerme = "Consolider mes compétences et mesurer ma progression réelle";
  }

  const objectifLongTerme = sujetPropre
    ? `Atteindre une autonomie complète et un haut niveau d'expertise sur ${sujetPropre}`
    : "Maîtrise approfondie et durable";

  const preferencesPedagogiques =
    reponses.preferencesChoisies.length > 0
      ? reponses.preferencesChoisies
      : ["Pratiquer d'abord", "Des cas concrets"];

  const heures = reponses.rythmeHebdoHeures ?? 2;
  const plan = [
    `Priorité : consolider les compétences clés de ${sujetPropre || "mon parcours"}.`,
    `Rythme visé : environ ${heures}h par semaine en séances régulières.`,
    `Approche : ${preferencesPedagogiques.join(", ")}.`,
  ].join("\n");

  return {
    sujet: sujetPropre,
    formation,
    objectifMoyenTerme,
    objectifLongTerme,
    preferencesPedagogiques,
    plan,
  };
}
