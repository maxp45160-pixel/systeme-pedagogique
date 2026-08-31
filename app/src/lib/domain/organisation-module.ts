import type { Domaine, Skill } from "./types";
import { usageDuDomaine } from "./usage-domaine";

export interface CompetenceOrganisationModule {
  code: string;
  titre: string;
  domainesDurables: Array<{ id: string; nom: string }>;
}

export interface DomaineAlimenteModule {
  id: string;
  nom: string;
  competences: Array<{ code: string; titre: string }>;
}

export interface OrganisationDurableModule {
  competences: CompetenceOrganisationModule[];
  domainesAlimentes: DomaineAlimenteModule[];
  competencesAOrganiser: Array<{ code: string; titre: string }>;
  domainesDisponibles: Array<{ id: string; nom: string }>;
}

/**
 * Projection du rangement durable d'un module.
 *
 * Le tag du module décrit le semestre. Seuls les tags vers des domaines à
 * usage continu comptent comme rangement durable. Rien n'est déplacé ni
 * recopié : le code et tout son historique restent uniques.
 */
export function organisationDurableDuModule(
  moduleId: string,
  skills: readonly Skill[],
  domaines: readonly Domaine[],
): OrganisationDurableModule {
  const domainesDisponibles = domaines
    .filter((domaine) => !domaine.archive && usageDuDomaine(domaine).type === "continu")
    .map(({ id, nom }) => ({ id, nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const durablesParId = new Map(domainesDisponibles.map((domaine) => [domaine.id, domaine]));

  const competences = skills
    .filter(
      (skill) =>
        skill.active
        && !skill.archive
        && (skill.tagsDomaine ?? []).includes(moduleId),
    )
    .map((skill) => ({
      code: skill.code,
      titre: skill.intitule,
      domainesDurables: (skill.tagsDomaine ?? [])
        .map((id) => durablesParId.get(id))
        .filter((domaine): domaine is { id: string; nom: string } => Boolean(domaine)),
    }))
    .sort((a, b) => a.titre.localeCompare(b.titre, "fr"));

  const domainesAlimentes = domainesDisponibles
    .map((domaine) => ({
      ...domaine,
      competences: competences
        .filter((competence) =>
          competence.domainesDurables.some(({ id }) => id === domaine.id),
        )
        .map(({ code, titre }) => ({ code, titre })),
    }))
    .filter(({ competences: rattachees }) => rattachees.length > 0);

  return {
    competences,
    domainesAlimentes,
    competencesAOrganiser: competences
      .filter(({ domainesDurables }) => domainesDurables.length === 0)
      .map(({ code, titre }) => ({ code, titre })),
    domainesDisponibles,
  };
}
