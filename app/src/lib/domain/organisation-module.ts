import type { Domaine, Skill } from "./types";
import { slugifier } from "./referentiel-compte";
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
  module: { id: string; nom: string; closLe: string | null };
  competences: CompetenceOrganisationModule[];
  domainesAlimentes: DomaineAlimenteModule[];
  competencesAOrganiser: Array<{ code: string; titre: string }>;
  domainesDisponibles: Array<{ id: string; nom: string }>;
}

export type DestinationDomaineLongTerme =
  | { type: "module-existant" }
  | { type: "domaine-existant"; domaine: { id: string; nom: string } }
  | { type: "nouveau" };

/**
 * Résout le nom saisi avant toute écriture : le module temporaire ne peut pas
 * être recréé comme domaine continu, tandis qu'un domaine continu portant déjà
 * ce nom doit être réutilisé plutôt que dupliqué.
 */
export function destinationDomaineLongTerme(
  nom: string,
  organisation: OrganisationDurableModule,
): DestinationDomaineLongTerme {
  const nomNettoye = nom.trim();
  const id = slugifier(nomNettoye);
  const memeNom = (candidat: string) =>
    candidat.trim().localeCompare(nomNettoye, "fr", { sensitivity: "base" }) === 0;
  if (id === organisation.module.id || memeNom(organisation.module.nom)) {
    return { type: "module-existant" };
  }
  const domaine = organisation.domainesDisponibles.find(
    (candidat) => candidat.id === id || memeNom(candidat.nom),
  );
  return domaine ? { type: "domaine-existant", domaine } : { type: "nouveau" };
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
  const domaineModule = domaines.find((domaine) => domaine.id === moduleId);
  const usageModule = domaineModule ? usageDuDomaine(domaineModule) : null;
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
    module: {
      id: moduleId,
      nom: domaineModule?.nom ?? moduleId,
      closLe: usageModule?.type === "module" ? usageModule.module.closLe ?? null : null,
    },
    competences,
    domainesAlimentes,
    competencesAOrganiser: competences
      .filter(({ domainesDurables }) => domainesDurables.length === 0)
      .map(({ code, titre }) => ({ code, titre })),
    domainesDisponibles,
  };
}
