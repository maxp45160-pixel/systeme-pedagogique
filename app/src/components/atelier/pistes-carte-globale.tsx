"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Skill } from "@/lib/domain/types";
import type {
  CarteGlobale,
  CorrespondanceCarteGlobale,
  SelectionCarteGlobale,
} from "@/lib/domain/carte-globale";
import {
  deselectionnerElementGlobal,
  rattacherCompetenceElementGlobal,
  retirerCorrespondanceCompetenceElementGlobal,
  selectionnerElementGlobal,
} from "@/lib/store/carte-globale-actions";
import { Bouton, cx } from "@/components/ui/primitives";

const provenance = {
  type: "declaration-utilisateur",
  reference: "Déclaré depuis le graphe de l’Atelier",
};

function libelleRelation(type: string): string {
  return type === "PART_OF"
    ? "fait partie de"
    : type === "PREREQUISITE_OF"
      ? "est prérequis de"
      : type === "RELATED_TO"
        ? "est lié à"
        : type === "APPLIED_IN"
          ? "s’applique dans"
          : "rend possible";
}

function relationDescription(
  carte: CarteGlobale,
  elementId: string,
  relation: CarteGlobale["relations"][number],
): string {
  const autreId = relation.sourceId === elementId ? relation.cibleId : relation.sourceId;
  const autre = carte.elements.find((item) => item.id === autreId);
  if (!autre) return "Relation publiée vers un repère retiré.";
  return relation.sourceId === elementId
    ? `${libelleRelation(relation.type)} ${autre.nom}`
    : `${autre.nom} ${libelleRelation(relation.type)} ce repère`;
}

export function PistesCarteGlobaleAtelier({
  carte,
  selections,
  correspondances,
  competences,
  onOuvrirReferentiel,
}: {
  carte: CarteGlobale;
  selections: SelectionCarteGlobale[];
  correspondances: CorrespondanceCarteGlobale[];
  competences: Skill[];
  onOuvrirReferentiel: () => void;
}) {
  const router = useRouter();
  const [elementId, setElementId] = useState<string | null>(selections[0]?.elementId ?? carte.elements[0]?.id ?? null);
  const [competenceCode, setCompetenceCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const selectionIds = new Set(selections.map((selection) => selection.elementId));
  const element = carte.elements.find((item) => item.id === elementId) ?? carte.elements[0];
  const relations = element
    ? carte.relations.filter((relation) => relation.sourceId === element.id || relation.cibleId === element.id)
    : [];
  const correspondancesElement = element
    ? correspondances.filter((correspondance) => correspondance.elementGlobalId === element.id)
    : [];

  function executer(action: () => Promise<void>, succes: string) {
    setMessage(null);
    demarrer(async () => {
      try {
        await action();
        setMessage(succes);
        router.refresh();
      } catch (erreur) {
        setMessage(erreur instanceof Error ? erreur.message : "Action impossible.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-bordure bg-surface-2/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-bordure/60 pb-4">
        <div>
          <h2 className="font-serif text-lg font-medium tracking-tight">Pistes depuis la carte globale</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-texte-attenue">
            Le graphe est votre carte personnelle. Les repères suivis ici donnent des pistes pour vérifier,
            relier ou faire évoluer votre référentiel local ; rien n&apos;est ajouté automatiquement.
          </p>
        </div>
        <span className="text-xs text-texte-discret">
          {selections.length} repère{selections.length > 1 ? "s" : ""} suivi{selections.length > 1 ? "s" : ""}
        </span>
      </div>

      {carte.elements.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-bordure px-3 py-4 text-xs text-texte-discret">
          La carte globale ne contient encore aucun repère publié. Le graphe local reste disponible pour travailler votre référentiel.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
          <ul className="grid gap-2 sm:grid-cols-2">
            {carte.elements.map((item) => {
              const actif = item.id === element?.id;
              const suivi = selectionIds.has(item.id);
              return (
                <li
                  key={item.id}
                  className={cx(
                    "rounded-lg border p-3 transition-colors",
                    actif ? "border-primaire bg-primaire/5" : "border-bordure bg-surface",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => setElementId(item.id)} className="min-w-0 text-left">
                      <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-texte-discret">{item.type}</span>
                      <span className="mt-1 block text-sm font-medium text-texte">{item.nom}</span>
                    </button>
                    <Bouton
                      type="button"
                      variante={suivi ? "principal" : "secondaire"}
                      taille="compacte"
                      disabled={enCours}
                      onClick={() => executer(
                        () => suivi ? deselectionnerElementGlobal(item.id) : selectionnerElementGlobal(item.id),
                        suivi ? "Piste retirée du graphe." : "Piste ajoutée au graphe.",
                      )}
                    >
                      {suivi ? "Suivi" : "Suivre"}
                    </Bouton>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-texte-attenue">{item.description || "Aucune description."}</p>
                </li>
              );
            })}
          </ul>

          <div className="space-y-4 rounded-lg border border-bordure bg-surface p-4">
            {element ? (
              <>
                <div>
                  <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-texte-discret">Repère choisi</span>
                  <h3 className="mt-1 text-sm font-semibold text-texte">{element.nom}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-texte-attenue">{element.description || "Aucune description."}</p>
                  <p className="mt-2 text-[0.6875rem] text-texte-discret">Source : {element.provenance.reference}</p>
                </div>

                <div className="border-t border-bordure/60 pt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Relations publiées</h3>
                  {relations.length > 0 ? (
                    <ul className="mt-2 space-y-1.5 text-xs text-texte-attenue">
                      {relations.map((relation) => <li key={relation.id}>{relationDescription(carte, element.id, relation)}.</li>)}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-texte-discret">Aucune relation publiée pour ce repère.</p>
                  )}
                </div>

                <div className="border-t border-bordure/60 pt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Relier au référentiel local</h3>
                  <p className="mt-1 text-xs text-texte-attenue">Cette correspondance est privée, explicite et ne mesure pas la compétence.</p>
                  <div className="mt-2 flex gap-2">
                    <select
                      aria-label="Compétence locale à relier"
                      value={competenceCode}
                      onChange={(event) => setCompetenceCode(event.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-bordure bg-surface-2 px-2.5 py-2 text-xs text-texte"
                    >
                      <option value="">Choisir une compétence</option>
                      {competences.filter((competence) => competence.active && !competence.archive).map((competence) => (
                        <option key={competence.code} value={competence.code}>{competence.intitule}</option>
                      ))}
                    </select>
                    <Bouton
                      type="button"
                      variante="secondaire"
                      taille="compacte"
                      disabled={!competenceCode || enCours}
                      onClick={() => executer(
                        () => rattacherCompetenceElementGlobal(competenceCode, element.id, provenance),
                        "Correspondance enregistrée.",
                      )}
                    >
                      Relier
                    </Bouton>
                  </div>
                  {correspondancesElement.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {correspondancesElement.map((correspondance) => {
                        const competence = competences.find((item) => item.code === correspondance.competenceCode);
                        return (
                          <li key={`${correspondance.competenceCode}-${correspondance.elementGlobalId}`} className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate text-texte">{competence?.intitule ?? correspondance.competenceCode}</span>
                            <button
                              type="button"
                              disabled={enCours}
                              onClick={() => executer(
                                () => retirerCorrespondanceCompetenceElementGlobal(correspondance.competenceCode, correspondance.elementGlobalId),
                                "Correspondance retirée.",
                              )}
                              className="shrink-0 text-primaire hover:underline"
                            >
                              Retirer
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="border-t border-bordure/60 pt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Faire évoluer le référentiel</h3>
                  <p className="mt-1 text-xs leading-relaxed text-texte-attenue">
                    Vérifiez cette piste dans vos domaines, puis ajoutez ou reformulez une compétence si elle correspond à votre besoin réel.
                  </p>
                  <Bouton type="button" variante="secondaire" taille="compacte" className="mt-3" onClick={onOuvrirReferentiel}>
                    Ouvrir les domaines
                  </Bouton>
                </div>
              </>
            ) : (
              <p className="text-xs text-texte-discret">Choisissez un repère pour voir ses relations et ses correspondances.</p>
            )}
            {message && <p className="text-xs text-texte-attenue" role="status">{message}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
