/**
 * Assistant d'orientation et diagnostic express pour le profil d'apprentissage.
 *
 * Fournit une structure en 3 étapes simples pour aider un nouvel utilisateur
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
    id: "academique",
    titre: "Étudiant / Formation initiale",
    description: "J'ai des bases théoriques ou un cursus en cours, je veux consolider.",
    formationType: "Formation académique ou cursus initial en cours",
  },
  {
    id: "autodidacte",
    titre: "Autodidacte / Pratique informelle",
    description: "J'ai déjà expérimenté ou bricolé par moi-même, je veux structurer.",
    formationType: "Pratique autodidacte et expérimentations personnelles",
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
    pointDeDepartExemple: "Cours de développement web suivi, ou bases en programmation",
    preferencesExemples: ["Pratiquer d'abord", "Pas à pas"],
  },
  {
    id: "data-ia",
    nom: "Data & IA",
    sujetExemple: "Machine Learning, LLMs, Python, pipelines de données et prompt engineering",
    objectifExemple: "Analyser des données complexes et intégrer des modèles d'IA",
    pointDeDepartExemple: "Cours de statistiques, ou bases en programmation",
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
    pointDeDepartExemple: "Cours d'expression orale, pratique associative ou professionnelle",
    preferencesExemples: ["Pratiquer d'abord", "Court et rapide"],
  },
];

export interface ReponsesOrientation {
  sujet: string;
  /** Fait déclaré par la personne, jamais dérivé du sujet ou du niveau. */
  intention: string;
  niveauId?: string;
  pointDeDepartPersonnalise?: string;
  preferencesChoisies: string[];
}

export interface ProfilSynthetise {
  sujet: string;
  formation: string;
  intentionDeDepart: string;
  preferencesPedagogiques: string[];
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
    "";

  /*
   * L'intention appartient à Connaît : elle est déclarée, jamais fabriquée à
   * partir du sujet ou d'un niveau présélectionné. La synthèse nettoie la
   * réponse, elle ne la complète pas.
   */
  const intentionDeDepart = reponses.intention.trim();

  const preferencesPedagogiques =
    reponses.preferencesChoisies.map((preference) => preference.trim()).filter(Boolean);

  return {
    sujet: sujetPropre,
    formation,
    intentionDeDepart,
    preferencesPedagogiques,
  };
}
