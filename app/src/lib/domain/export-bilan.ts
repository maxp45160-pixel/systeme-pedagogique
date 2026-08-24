import type { SkillState, Skill } from "@/lib/domain/types";
import type { Engagement } from "@/lib/domain/engagement";
import { estOuvert, joursRestants, libelleCompte } from "@/lib/domain/engagement";

export interface DonneesExportBilan {
  identite?: {
    nom?: string;
    email?: string;
  };
  dateExport: Date;
  scoreGlobal: number | null;
  nombreCompetences: number;
  nombreExercices: number;
  joursActifs: number;
  etats: SkillState[];
  skillsParCode: Map<string, Skill>;
  engagements?: Engagement[];
}

/**
 * Génère une synthèse textuelle en Markdown du profil de compétences de l'apprenant.
 * Document sobre, vérifiable et partageable (tuteur, professeur, employeur, archive personnelle).
 */
export function genererBilanMarkdown(donnees: DonneesExportBilan): string {
  const dateFormatee = donnees.dateExport.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const lignes: string[] = [];

  // En-tête
  lignes.push("# Bilan de compétences — Système pédagogique");
  lignes.push(`*Relevé généré le ${dateFormatee}*`);
  if (donnees.identite?.nom || donnees.identite?.email) {
    lignes.push(`**Apprenant** : ${donnees.identite.nom || donnees.identite.email}`);
  }
  lignes.push("");

  // Synthèse globale
  lignes.push("## 1. Synthèse globale");
  lignes.push(`- **Score global mesuré** : ${donnees.scoreGlobal !== null ? `${donnees.scoreGlobal} / 100` : "Non mesuré"}`);
  lignes.push(`- **Compétences actives suivies** : ${donnees.nombreCompetences}`);
  lignes.push(`- **Exercices réalisés avec succès** : ${donnees.nombreExercices}`);
  lignes.push(`- **Régularité (30 derniers jours)** : ${donnees.joursActifs} jours d'activité`);
  lignes.push("");

  // Répartition par niveau
  const solides: { code: string; intitule: string; niveau: number; observations: number }[] = [];
  const enCours: { code: string; intitule: string; niveau: number; observations: number }[] = [];
  const aDemontrer: { code: string; intitule: string }[] = [];

  for (const etat of donnees.etats) {
    const code = etat.skill.code;
    const intitule = etat.skill.intitule ?? code;
    const nbObs = etat.observations?.length ?? 0;

    if (etat.niveau !== null && etat.niveau >= 2) {
      solides.push({ code, intitule, niveau: etat.niveau, observations: nbObs });
    } else if (etat.niveau !== null && etat.niveau >= 1) {
      enCours.push({ code, intitule, niveau: etat.niveau, observations: nbObs });
    } else {
      aDemontrer.push({ code, intitule });
    }
  }

  lignes.push("## 2. État d'avancement des compétences");
  lignes.push("");
  lignes.push(`### Compétences consolidées (${solides.length})`);
  if (solides.length === 0) {
    lignes.push("*Aucune compétence consolidée au niveau 2+ pour le moment.*");
  } else {
    for (const s of solides) {
      lignes.push(`- **${s.intitule}** (${s.code}) : Niveau ${s.niveau}/4 · ${s.observations} observation(s) probante(s)`);
    }
  }
  lignes.push("");

  lignes.push(`### Compétences en cours d'acquisition (${enCours.length})`);
  if (enCours.length === 0) {
    lignes.push("*Aucune compétence au niveau 1.*");
  } else {
    for (const s of enCours) {
      lignes.push(`- **${s.intitule}** (${s.code}) : Niveau ${s.niveau}/4 · ${s.observations} observation(s)`);
    }
  }
  lignes.push("");

  if (aDemontrer.length > 0) {
    lignes.push(`### Compétences à aborder ou démontrer (${aDemontrer.length})`);
    for (const s of aDemontrer.slice(0, 10)) {
      lignes.push(`- ${s.intitule} (${s.code})`);
    }
    if (aDemontrer.length > 10) {
      lignes.push(`- *... et ${aDemontrer.length - 10} autre(s) compétence(s)*`);
    }
    lignes.push("");
  }

  // Échéances déclarées (si présentes)
  const engagementsOuverts = (donnees.engagements ?? []).filter(estOuvert);

  if (engagementsOuverts.length > 0) {
    lignes.push("## 3. Engagements & Échéances préparées");
    for (const eng of engagementsOuverts) {
      const restants = joursRestants(eng.echeanceLe, donnees.dateExport);
      lignes.push(`- **${eng.libelle}** (Date : ${eng.echeanceLe} — ${libelleCompte(restants)})`);
      if (eng.codes.length > 0) {
        lignes.push(`  - Compétences ciblées : ${eng.codes.join(", ")}`);
      }
    }
    lignes.push("");
  }

  // Note de bas de page méthodologique
  lignes.push("---");
  lignes.push(
    "*Document issu du Système pédagogique. Les niveaux indiqués sont dérivés uniquement d'observations directes et vérifiées lors d'exercices résolus sans extrapolation factice.*",
  );

  return lignes.join("\n");
}
