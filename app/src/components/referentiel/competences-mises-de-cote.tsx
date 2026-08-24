"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Bouton } from "@/components/ui/primitives";
import { reprendreCompetence } from "@/lib/store/referentiel-actions";

export interface CompetenceMiseDeCote {
  code: string;
  intitule: string;
}

/**
 * Ce que le domaine a mis de côté, et le geste qui le reprend.
 *
 * ## Pourquoi cet écran existe
 *
 * Mettre de côté était sans retour. La proposition de dormance annonçait « vous
 * pouvez la reprendre quand vous voulez » ; une compétence archivée sortait de
 * `actifs`, disparaissait de la liste du domaine, et **aucun geste ne la
 * ramenait** — la commande SQL `desarchiver_competence` existait depuis le
 * 20/08/2026 sans être appelée par quoi que ce soit. Une promesse d'écran que
 * rien ne tient est un défaut (ADR-118).
 *
 * ## Pourquoi ici et pas ailleurs
 *
 * Sur la fiche du domaine, à la suite de ses compétences : c'est là qu'on
 * constate un manque (« où est passée celle-là ? »), et c'est le domaine qui
 * gouverne le retrait comme la reprise (ADR-065). Une corbeille globale
 * rangerait ensemble des compétences de domaines sans rapport, et demanderait
 * de chercher là où l'on ne s'est aperçu de rien.
 *
 * Le bloc n'existe pas quand rien n'est mis de côté : pas de section vide qui
 * apprend à ne plus regarder cet endroit.
 */
export function CompetencesMisesDeCote({
  competences,
}: {
  competences: CompetenceMiseDeCote[];
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  /*
   * Le code en cours de reprise, pas un simple booléen : sans lui, les trois
   * boutons d'une liste de trois passent en chargement ensemble, et l'on ne
   * sait plus lequel on a demandé.
   */
  const [reprise, setReprise] = useState<string | null>(null);

  if (competences.length === 0) return null;

  return (
    <section className="rounded-xl border border-bordure bg-surface px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-texte-discret">
          Mises de côté
        </h3>
        <span className="chiffres text-[0.6875rem] text-texte-discret">
          {competences.length}
        </span>
      </div>
      <p className="mt-1 text-[0.6875rem] leading-relaxed text-texte-attenue">
        Elles ne comptent plus dans votre couverture et ne sont plus proposées.
        Rien n’a été supprimé : les reprendre les remet dans le périmètre de
        travail, telles qu’elles étaient.
      </p>
      <ul className="mt-2 divide-y divide-bordure/60">
        {competences.map((competence) => (
          <li
            key={competence.code}
            className="flex flex-wrap items-center justify-between gap-3 py-2"
          >
            <span className="min-w-0 flex-1 text-sm text-texte-attenue">
              <span className="chiffres mr-2 rounded-md bg-surface-2 px-1.5 py-0.5 text-[0.625rem] text-texte-discret">
                {competence.code}
              </span>
              {competence.intitule}
            </span>
            <Bouton
              variante="secondaire"
              taille="petite"
              enChargement={enCours && reprise === competence.code}
              disabled={enCours}
              onClick={() => {
                setReprise(competence.code);
                demarrer(async () => {
                  await reprendreCompetence(competence.code);
                  router.refresh();
                });
              }}
            >
              Reprendre
            </Bouton>
          </li>
        ))}
      </ul>
    </section>
  );
}
