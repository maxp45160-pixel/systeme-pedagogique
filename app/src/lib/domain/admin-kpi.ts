/**
 * Calcul des indicateurs clés de performance (KPI) pour le cockpit administrateur.
 *
 * Logique pure (Couche 3 - Décide) : ne stocke rien, ne lit rien en base.
 * Reçoit la liste des comptes administrés et en déduit les métriques agrégées,
 * les répartitions d'usage et les filtres.
 *
 * Respecte l'invariant P8 : calcul uniquement sur des métriques quantitatives
 * et des horodatages agrégés, sans aucun accès aux contenus personnels.
 */

import { type CompteAdministre, estSuspendu } from "./acces";

export interface RepartitionActivite {
  /** 0 séance et 0 exercice */
  aucune: number;
  /** 1 à 3 séances */
  debutant: number;
  /** 4 à 10 séances */
  regulier: number;
  /** Plus de 10 séances */
  intensif: number;
}

export interface StatistiquesAdmin {
  totalComptes: number;
  comptesActifs: number;
  comptesSuspendus: number;
  totalAdmins: number;
  totalMembres: number;

  /** Inscrits dans les 7 derniers jours */
  nouveaux7j: number;
  /** Inscrits dans les 30 derniers jours */
  nouveaux30j: number;

  /** Ayant eu une activité dans les 7 derniers jours */
  actifs7j: number;
  /** Ayant eu une activité dans les 30 derniers jours */
  actifs30j: number;

  /** Total cumulé de toutes les observations */
  totalObservations: number;
  /** Total cumulé de tous les exercices créés */
  totalExercices: number;
  /** Total cumulé de toutes les séances menées */
  totalSeances: number;
  /** Total cumulé des compétences déclarées */
  totalCompetences: number;

  /** Moyenne d'observations par compte actif (arrondie à 1 décimale) */
  moyenneObservations: number;
  /** Moyenne d'exercices par compte actif (arrondie à 1 décimale) */
  moyenneExercices: number;
  /** Moyenne de séances par compte actif (arrondie à 1 décimale) */
  moyenneSeances: number;

  /** Pourcentage de comptes ayant mené au moins 1 séance ou 1 exercice (0-100) */
  tauxEngagement: number;

  /** Répartition des utilisateurs selon leur volume de séances */
  repartitionActivite: RepartitionActivite;

  /** Les 5 comptes les plus récemment actifs */
  topActifs: CompteAdministre[];
  /** Les 5 comptes les plus récemment inscrits */
  derniersInscrits: CompteAdministre[];
}

const MS_JOUR = 24 * 60 * 60 * 1000;

function differenceJours(dateStr: string | null, maintenant: Date): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return (maintenant.getTime() - d.getTime()) / MS_JOUR;
}

/**
 * Calcule les indicateurs d'administration à partir de la liste des comptes.
 */
export function calculerStatistiquesAdmin(
  comptes: readonly CompteAdministre[],
  maintenant: Date = new Date(),
): StatistiquesAdmin {
  const totalComptes = comptes.length;
  let comptesActifs = 0;
  let comptesSuspendus = 0;
  let totalAdmins = 0;
  let totalMembres = 0;

  let nouveaux7j = 0;
  let nouveaux30j = 0;
  let actifs7j = 0;
  let actifs30j = 0;

  let totalObservations = 0;
  let totalExercices = 0;
  let totalSeances = 0;
  let totalCompetences = 0;

  let comptesEngages = 0;

  const repartition: RepartitionActivite = {
    aucune: 0,
    debutant: 0,
    regulier: 0,
    intensif: 0,
  };

  for (const c of comptes) {
    const suspendu = estSuspendu(c);
    if (suspendu) comptesSuspendus++;
    else comptesActifs++;

    if (c.role === "admin") totalAdmins++;
    else totalMembres++;

    totalObservations += c.observations;
    totalExercices += c.exercices;
    totalSeances += c.seances;
    totalCompetences += c.competences;

    if (c.seances > 0 || c.exercices > 0 || c.observations > 0) {
      comptesEngages++;
    }

    if (c.seances === 0 && c.exercices === 0) {
      repartition.aucune++;
    } else if (c.seances <= 3) {
      repartition.debutant++;
    } else if (c.seances <= 10) {
      repartition.regulier++;
    } else {
      repartition.intensif++;
    }

    const diffInscrit = differenceJours(c.creeLe, maintenant);
    if (diffInscrit !== null && diffInscrit >= 0) {
      if (diffInscrit <= 7) nouveaux7j++;
      if (diffInscrit <= 30) nouveaux30j++;
    }

    const diffActif = differenceJours(c.derniereActivite, maintenant);
    if (diffActif !== null && diffActif >= 0) {
      if (diffActif <= 7) actifs7j++;
      if (diffActif <= 30) actifs30j++;
    }
  }

  const denominateur = totalComptes > 0 ? totalComptes : 1;
  const moyenneObservations = Math.round((totalObservations / denominateur) * 10) / 10;
  const moyenneExercices = Math.round((totalExercices / denominateur) * 10) / 10;
  const moyenneSeances = Math.round((totalSeances / denominateur) * 10) / 10;
  const tauxEngagement = totalComptes > 0 ? Math.round((comptesEngages / totalComptes) * 100) : 0;

  // Tri pour les comptes les plus récemment actifs
  const topActifs = [...comptes]
    .filter((c) => c.derniereActivite !== null)
    .sort((a, b) => {
      const ta = a.derniereActivite ? new Date(a.derniereActivite).getTime() : 0;
      const tb = b.derniereActivite ? new Date(b.derniereActivite).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 5);

  // Tri pour les derniers inscrits
  const derniersInscrits = [...comptes]
    .filter((c) => c.creeLe !== null)
    .sort((a, b) => {
      const ta = a.creeLe ? new Date(a.creeLe).getTime() : 0;
      const tb = b.creeLe ? new Date(b.creeLe).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 5);

  return {
    totalComptes,
    comptesActifs,
    comptesSuspendus,
    totalAdmins,
    totalMembres,
    nouveaux7j,
    nouveaux30j,
    actifs7j,
    actifs30j,
    totalObservations,
    totalExercices,
    totalSeances,
    totalCompetences,
    moyenneObservations,
    moyenneExercices,
    moyenneSeances,
    tauxEngagement,
    repartitionActivite: repartition,
    topActifs,
    derniersInscrits,
  };
}

export type FiltreStatutCompte = "tous" | "actifs" | "inactifs" | "suspendus" | "recents";

export interface OptionsFiltreCompte {
  recherche?: string;
  role?: "tous" | "admin" | "membre";
  statut?: FiltreStatutCompte;
}

/**
 * Filtre et recherche dans la liste des comptes selon les critères sélectionnés.
 */
export function filtrerComptes(
  comptes: readonly CompteAdministre[],
  options: OptionsFiltreCompte = {},
  maintenant: Date = new Date(),
): CompteAdministre[] {
  const { recherche = "", role = "tous", statut = "tous" } = options;
  const rechercheNorm = recherche.trim().toLowerCase();

  return comptes.filter((c) => {
    // Filtre rôle
    if (role !== "tous" && c.role !== role) return false;

    // Filtre statut
    if (statut === "actifs" && estSuspendu(c)) return false;
    if (statut === "suspendus" && !estSuspendu(c)) return false;
    if (statut === "recents") {
      if (estSuspendu(c)) return false;
      const diff = differenceJours(c.derniereActivite, maintenant);
      if (diff === null || diff > 7) return false;
    }
    if (statut === "inactifs") {
      if (estSuspendu(c)) return false;
      if (c.derniereActivite === null) return true;
      const diff = differenceJours(c.derniereActivite, maintenant);
      return diff === null || diff > 30;
    }

    // Recherche textuelle sur prénom et email
    if (rechercheNorm) {
      const email = (c.email ?? "").toLowerCase();
      const prenom = (c.prenom ?? "").toLowerCase();
      const match = email.includes(rechercheNorm) || prenom.includes(rechercheNorm);
      if (!match) return false;
    }

    return true;
  });
}
