import Link from "next/link";
import type {
  CarteIndividuelle,
  EspaceActif,
} from "@/lib/engine/vues-twiny";
import {
  Carte,
  CorpsCarte,
  EnTeteCarte,
  Etiquette,
} from "@/components/ui/primitives";

function libelleOrigine(origin: EspaceActif["elements"][number]["origine"]): string {
  return origin === "parcours"
    ? "Parcours actif"
    : origin === "objectif"
      ? "Objectif actif"
      : origin === "selection-globale"
        ? "Sélection globale"
        : "Référentiel local";
}

function EtatConnaissance({ nom }: { nom: string }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-bordure bg-surface-2 px-3 py-2.5">
      <span className="min-w-0 text-sm text-texte">{nom}</span>
      <span className="shrink-0 text-xs text-texte-discret">Pas encore mesurée</span>
    </li>
  );
}

export function CarteIndividuelleTwiny({
  carte,
  espace,
}: {
  carte: CarteIndividuelle;
  espace: EspaceActif;
}) {
  const connaissances = carte.elementsGlobaux.filter((element) => element.type === "connaissance");
  const competencesVisibles = carte.competencesLocales.slice(0, 6);

  return (
    <Carte>
      <EnTeteCarte
        titre="Votre carte personnelle"
        legende="Une vue privée, dérivée à la demande. Elle rassemble vos repères sans créer de nouvelle mesure."
      />
      <CorpsCarte className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-bordure bg-surface-2 px-3 py-2.5">
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-texte-discret">Repères globaux</p>
            <p className="mt-1 text-lg font-semibold text-texte">{carte.elementsGlobaux.length}</p>
            <p className="text-xs text-texte-discret">Sélections et cibles pertinentes</p>
          </div>
          <div className="rounded-lg border border-bordure bg-surface-2 px-3 py-2.5">
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-texte-discret">Compétences locales</p>
            <p className="mt-1 text-lg font-semibold text-texte">{carte.competencesLocales.length}</p>
            <p className="text-xs text-texte-discret">États recalculés à la lecture</p>
          </div>
          <div className="rounded-lg border border-bordure bg-surface-2 px-3 py-2.5">
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-texte-discret">Cibles personnelles</p>
            <p className="mt-1 text-lg font-semibold text-texte">{carte.objectifs.length + carte.parcours.length}</p>
            <p className="text-xs text-texte-discret">Objectifs et parcours conservés</p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Repères globaux</h3>
            {connaissances.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {connaissances.map((element) => (
                  <EtatConnaissance key={element.id} nom={element.nom} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-texte-discret">Aucun repère global sélectionné pour le moment.</p>
            )}
            {carte.elementsGlobaux.some((element) => element.type === "competence") && (
              <p className="mt-2 text-xs text-texte-discret">
                Les compétences globales restent distinctes des compétences locales : aucun rapprochement n&apos;est supposé.
              </p>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Compétences locales</h3>
              <Link href="/atelier" className="text-xs font-medium text-primaire hover:underline">Voir l&apos;Atelier</Link>
            </div>
            {competencesVisibles.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {competencesVisibles.map((etat) => (
                  <li key={etat.code} className="flex items-center justify-between gap-3 rounded-lg border border-bordure bg-surface-2 px-3 py-2.5">
                    <Link href={`/atelier?document=${encodeURIComponent(etat.code)}`} className="min-w-0 truncate text-sm font-medium text-texte hover:text-primaire">
                      {etat.etatConsolide.skill.intitule}
                    </Link>
                    <span className="shrink-0 text-xs text-texte-discret">
                      {etat.observationPonctuelle ? "Observation disponible" : "Non mesurée"}
                      {etat.maitrise.maitrisee ? " · maîtrise établie" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-texte-discret">Aucune compétence locale dans la carte pour le moment.</p>
            )}
            {carte.competencesLocales.length > competencesVisibles.length && (
              <p className="mt-2 text-xs text-texte-discret">
                {carte.competencesLocales.length - competencesVisibles.length} autre{carte.competencesLocales.length - competencesVisibles.length > 1 ? "s" : ""} compétence{carte.competencesLocales.length - competencesVisibles.length > 1 ? "s" : ""} sont consultables dans l&apos;Atelier.
              </p>
            )}
          </section>
        </div>

        <section className="border-t border-bordure/60 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Espace actif</h3>
              <p className="mt-1 text-xs text-texte-discret">{espace.elements.length} élément{espace.elements.length > 1 ? "s" : ""} affiché{espace.elements.length > 1 ? "s" : ""} sur une limite de {espace.limite}.</p>
            </div>
            <Etiquette ton="primaire">Priorités expliquées</Etiquette>
          </div>
          {espace.elements.length > 0 ? (
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {espace.elements.map((element, index) => {
                const codeCompetence =
                  element.type === "competence-locale" && element.actionnable ? element.codeCompetence : null;
                const contenu = (
                  <>
                    <span className="mr-2 text-xs text-texte-discret">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{element.libelle}</span>
                    <span className="ml-2 shrink-0 text-[0.625rem] text-texte-discret">{libelleOrigine(element.origine)}</span>
                  </>
                );
                return (
                  <li key={element.cle} className="rounded-lg border border-bordure bg-surface-2 px-3 py-2.5">
                    {codeCompetence ? (
                      <Link href={`/atelier?document=${encodeURIComponent(codeCompetence)}`} className="flex items-center hover:text-primaire">
                        {contenu}
                      </Link>
                    ) : (
                      <span className="flex items-center text-texte-attenue">{contenu}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-texte-discret">Aucun élément actif pour le moment.</p>
          )}
          {espace.reserves.length > 0 && (
            <ul className="mt-3 space-y-1">
              {espace.reserves.map((reserve) => (
                <li key={reserve} className="text-xs text-texte-discret">{reserve}</li>
              ))}
            </ul>
          )}
        </section>
      </CorpsCarte>
    </Carte>
  );
}
