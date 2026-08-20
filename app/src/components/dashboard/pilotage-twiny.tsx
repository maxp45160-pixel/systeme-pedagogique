import Link from "next/link";

import { Carte, CodeCompetence, classesLienBouton } from "@/components/ui/primitives";
import { IconeFleche } from "@/components/ui/icones";
import type { Recommandation } from "@/lib/engine/recommend";
import {
  resumerPilotageTwiny,
  type CarteIndividuelle,
  type EspaceActif,
} from "@/lib/engine/vues-twiny";

export function PilotageTwiny({
  carte,
  espace,
  recommandation,
}: {
  carte: CarteIndividuelle;
  espace: EspaceActif;
  recommandation?: Recommandation;
}) {
  const resume = resumerPilotageTwiny(carte, espace);
  const ancrePriorite = resume.priorite?.origine === "parcours" ? "parcours" : "objectifs";

  return (
    <Carte className="overflow-hidden">
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-texte">Pilotage Twiny</h2>
            <span className="rounded-full bg-primaire-faible px-2 py-0.5 text-[0.6875rem] font-medium text-primaire">
              {resume.elementsActifs} repère{resume.elementsActifs > 1 ? "s" : ""} actif{resume.elementsActifs > 1 ? "s" : ""}
            </span>
          </div>

          {resume.priorite ? (
            <div className="mt-2.5">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-texte-discret">
                {resume.priorite.origine === "parcours" ? "Parcours prioritaire" : "Objectif prioritaire"}
              </p>
              <p className="mt-1 text-sm font-medium leading-snug text-texte">
                {resume.priorite.libelle}
              </p>
              {recommandation && (
                <p className="mt-1.5 text-xs text-texte-attenue">
                  Cette priorité fait remonter <CodeCompetence code={recommandation.etat.skill.code} />{" "}
                  {recommandation.etat.skill.intitule} dans la prochaine action.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-2.5">
              <p className="text-sm font-medium text-texte">Aucune priorité structurée active</p>
              <p className="mt-1 text-xs text-texte-attenue">
                La prochaine action suit pour l&apos;instant le classement du référentiel local.
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texte-attenue">
            <span><strong className="font-semibold text-texte">{resume.objectifsActifs}</strong> objectif{resume.objectifsActifs > 1 ? "s" : ""} actif{resume.objectifsActifs > 1 ? "s" : ""}</span>
            <span><strong className="font-semibold text-texte">{resume.parcoursActifs}</strong> parcours actif{resume.parcoursActifs > 1 ? "s" : ""}</span>
            <span><strong className="font-semibold text-texte">{resume.selectionsGlobales}</strong> repère{resume.selectionsGlobales > 1 ? "s" : ""} suivi{resume.selectionsGlobales > 1 ? "s" : ""}</span>
            <span><strong className="font-semibold text-texte">{resume.correspondances}</strong> lien{resume.correspondances > 1 ? "s" : ""} confirmé{resume.correspondances > 1 ? "s" : ""}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Link
            href={`/progression#${resume.priorite ? ancrePriorite : "objectifs"}`}
            className={classesLienBouton("principal")}
          >
            {resume.priorite ? "Gérer la priorité" : "Définir un objectif"}
            <IconeFleche className="size-3.5" />
          </Link>
          <Link href="/progression#explorer" className={classesLienBouton("secondaire")}>
            Explorer la carte
          </Link>
        </div>
      </div>
    </Carte>
  );
}
