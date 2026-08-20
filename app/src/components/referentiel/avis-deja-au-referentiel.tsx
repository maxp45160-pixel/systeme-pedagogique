"use client";

import { BandeauInfo } from "@/components/ui/primitives";
import type { CompetenceDejaAuReferentiel } from "@/lib/domain/gouvernance-referentiel";

/**
 * Dit ce qui a été rattaché plutôt que recréé.
 *
 * La personne a demandé ces savoir-faire dans ce domaine ; elle les y trouvera.
 * Mais elle doit savoir **sous quelle forme** : ce sont les compétences
 * existantes, avec leur code d'origine et leurs observations, et non de nouvelles.
 * Le taire laisserait croire à une création, et le premier code affiché —
 * `STA-01` dans un domaine préfixé `LOG` — passerait pour un bug.
 */
export function AvisDejaAuReferentiel({
  competences,
}: {
  competences: CompetenceDejaAuReferentiel[];
}) {
  if (competences.length === 0) return null;
  const rattachees = competences.filter(({ aRattacher }) => aRattacher);
  const archivees = competences.filter(({ archive }) => archive);
  return (
    <BandeauInfo ton="info" taille="compacte">
      <p className="font-medium">
        {rattachees.length > 0
          ? rattachees.length === 1
            ? "Une compétence existait déjà : elle a été rattachée à ce domaine, pas recréée."
            : `${rattachees.length} compétences existaient déjà : elles ont été rattachées à ce domaine, pas recréées.`
          : "Ces compétences étaient déjà dans ce domaine : rien n’a changé."}
      </p>
      <ul className="mt-2 space-y-1">
        {competences.map((competence) => (
          <li key={competence.code} className="text-xs">
            <span className="font-mono font-semibold">{competence.code}</span>
            {" · "}
            {competence.intitule}
            {" — "}
            <span className="text-texte-attenue">
              {competence.aRattacher ? `portée par ${competence.domaineNom}` : "déjà ici"}
              {competence.archive ? ", archivée" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-texte-attenue">
        Elles gardent leur code d’origine et leurs observations : un second code dédoublerait la mesure
        d’un seul savoir-faire.
        {archivees.length > 0
          ? " Une compétence archivée reste archivée — elle se désarchive depuis son domaine porteur."
          : ""}
      </p>
    </BandeauInfo>
  );
}
