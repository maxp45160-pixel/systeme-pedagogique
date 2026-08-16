"use client";

import { BandeauInfo } from "@/components/ui/primitives";
import type { CompetenceDejaAuReferentiel } from "@/lib/store/referentiel-actions";

/**
 * Dit ce qui n'a pas été créé, et pourquoi.
 *
 * Écarter une compétence sans le dire serait pire que la dupliquer : la
 * personne croirait l'avoir ajoutée et la chercherait dans un domaine où elle
 * n'est pas. On nomme donc le code qui existe et son domaine, pour qu'elle
 * puisse aller l'y travailler.
 */
export function AvisDejaAuReferentiel({
  competences,
}: {
  competences: CompetenceDejaAuReferentiel[];
}) {
  if (competences.length === 0) return null;
  const archivees = competences.filter(({ archive }) => archive);
  return (
    <BandeauInfo ton="info" taille="compacte">
      <p className="font-medium">
        {competences.length === 1
          ? "Une compétence proposée est déjà au référentiel — elle n’a pas été recréée."
          : `${competences.length} compétences proposées sont déjà au référentiel — elles n’ont pas été recréées.`}
      </p>
      <ul className="mt-2 space-y-1">
        {competences.map((competence) => (
          <li key={competence.code} className="text-xs">
            <span className="font-mono font-semibold">{competence.code}</span>
            {" · "}
            {competence.intitule}
            {" — "}
            <span className="text-texte-attenue">
              {competence.domaineNom}
              {competence.archive ? ", archivée" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-texte-attenue">
        Un second code dédoublerait ses preuves : le niveau serait calculé deux fois sur un seul
        savoir-faire.{" "}
        {archivees.length > 0
          ? "Une compétence archivée se désarchive depuis son domaine — la recréer couperait son historique."
          : "Travaille-la depuis son domaine."}
      </p>
    </BandeauInfo>
  );
}
