"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { BandeauInfo, Bouton } from "@/components/ui/primitives";
import { IconeChevronDroit, IconeDocuments, IconePlus } from "@/components/ui/icones";
import type { OrganisationDurableModule } from "@/lib/domain/organisation-module";
import { creerBranche, taguerCompetences } from "@/lib/store/referentiel-actions";

export function OrganisationDurableDuModule({
  organisation,
  ouvrirCompetence,
}: {
  organisation: OrganisationDurableModule;
  ouvrirCompetence: (code: string) => void;
}) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [codesSelectionnes, setCodesSelectionnes] = useState<Set<string>>(
    () => new Set(organisation.competencesAOrganiser.map(({ code }) => code)),
  );
  const [domainesSelectionnes, setDomainesSelectionnes] = useState<Set<string>>(() => new Set());
  const [nomDomaine, setNomDomaine] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const nombreAOrganiser = organisation.competencesAOrganiser.length;
  const codesValides = useMemo(
    () => [...codesSelectionnes].filter((code) =>
      organisation.competences.some((competence) => competence.code === code),
    ),
    [codesSelectionnes, organisation.competences],
  );

  function basculerCode(code: string) {
    setCodesSelectionnes((precedents) => {
      const suivants = new Set(precedents);
      if (suivants.has(code)) suivants.delete(code);
      else suivants.add(code);
      return suivants;
    });
  }

  function basculerDomaine(id: string) {
    setDomainesSelectionnes((precedents) => {
      const suivants = new Set(precedents);
      if (suivants.has(id)) suivants.delete(id);
      else suivants.add(id);
      return suivants;
    });
  }

  function appliquerRangement() {
    if (codesValides.length === 0) {
      setErreur("Sélectionnez au moins une compétence du module.");
      return;
    }
    if (domainesSelectionnes.size === 0) {
      setErreur("Choisissez au moins un domaine durable.");
      return;
    }

    setErreur(null);
    demarrer(async () => {
      let domainesAppliques = 0;
      try {
        for (const domaineId of domainesSelectionnes) {
          await taguerCompetences(domaineId, codesValides, true);
          domainesAppliques += 1;
        }
        setDomainesSelectionnes(new Set());
        router.refresh();
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : "Le rangement n’a pas abouti.";
        setErreur(
          domainesAppliques > 0
            ? `${domainesAppliques} domaine${domainesAppliques > 1 ? "s" : ""} mis à jour. ${detail}`
            : detail,
        );
        router.refresh();
      }
    });
  }

  function creerDomaine() {
    const nom = nomDomaine.trim();
    if (nom.length < 3) {
      setErreur("Donnez un nom explicite au domaine durable.");
      return;
    }
    if (codesValides.length === 0) {
      setErreur("Sélectionnez les compétences qui alimenteront ce domaine.");
      return;
    }

    setErreur(null);
    demarrer(async () => {
      try {
        await creerBranche({
          domaine: nom,
          prefixe: "",
          description: "",
          competences: [],
          rattachementsExistants: codesValides,
          origine: "utilisateur",
          signalerCroissanceReferentiel: false,
          usage: { type: "continu" },
        });
        setNomDomaine("");
        setCreationOuverte(false);
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Le domaine n’a pas pu être créé.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-bordure bg-surface">
      <button
        type="button"
        onClick={() => setOuverte((valeur) => !valeur)}
        aria-expanded={ouverte}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left sm:px-5"
      >
        <IconeDocuments className="size-5 shrink-0 text-primaire" />
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-lg font-medium text-texte">Organisation durable</span>
          <span className="mt-0.5 block text-xs text-texte-discret">
            {organisation.domainesAlimentes.length === 0
              ? "Aucun domaine durable alimenté pour l’instant"
              : `${organisation.domainesAlimentes.length} domaine${organisation.domainesAlimentes.length > 1 ? "s" : ""} alimenté${organisation.domainesAlimentes.length > 1 ? "s" : ""}`}
          </span>
        </span>
        {nombreAOrganiser > 0 && (
          <span
            className="grid size-8 shrink-0 place-items-center rounded-full bg-danger text-sm font-semibold text-texte-inverse"
            aria-label={`${nombreAOrganiser} compétences à organiser`}
          >
            {nombreAOrganiser}
          </span>
        )}
        <span className="text-xs font-medium text-texte-attenue">{ouverte ? "Réduire" : "Organiser"}</span>
        <IconeChevronDroit className={`size-4 shrink-0 text-texte-discret transition-transform ${ouverte ? "rotate-90" : ""}`} />
      </button>

      {ouverte && (
        <div className="border-t border-bordure px-4 pb-5 sm:px-5">
          <div className="grid gap-6 pt-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)]">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-sm font-semibold text-texte">Compétences du module</h4>
                <button
                  type="button"
                  onClick={() => setCodesSelectionnes(new Set(organisation.competences.map(({ code }) => code)))}
                  className="cursor-pointer text-xs font-medium text-primaire hover:underline"
                >
                  Tout sélectionner
                </button>
              </div>
              {organisation.competences.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-bordure px-3 py-5 text-center text-sm text-texte-discret">
                  Ajoutez d’abord une compétence à ce module.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-bordure rounded-lg border border-bordure">
                  {organisation.competences.map((competence) => (
                    <li key={competence.code} className="flex items-start gap-3 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={codesSelectionnes.has(competence.code)}
                        onChange={() => basculerCode(competence.code)}
                        aria-label={`Sélectionner ${competence.titre}`}
                        className="mt-0.5 size-4 rounded border-bordure accent-primaire"
                      />
                      <button
                        type="button"
                        onClick={() => ouvrirCompetence(competence.code)}
                        className="min-w-0 flex-1 cursor-pointer text-left"
                      >
                        <span className="block text-sm font-medium text-texte hover:text-primaire">
                          {competence.titre}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {competence.domainesDurables.length === 0 ? (
                            <span className="text-xs text-danger">À organiser</span>
                          ) : (
                            competence.domainesDurables.map((domaine) => (
                              <span key={domaine.id} className="rounded-md bg-primaire-faible px-2 py-0.5 text-[0.6875rem] font-medium text-primaire">
                                {domaine.nom}
                              </span>
                            ))
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-texte">Envoyer la sélection vers</h4>
              {organisation.domainesDisponibles.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-texte-discret">
                  Vous n’avez pas encore de domaine durable. Créez-en un avec la sélection actuelle.
                </p>
              ) : (
                <div className="mt-2 space-y-1 rounded-lg border border-bordure p-2">
                  {organisation.domainesDisponibles.map((domaine) => (
                    <label key={domaine.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-texte hover:bg-surface-2">
                      <input
                        type="checkbox"
                        checked={domainesSelectionnes.has(domaine.id)}
                        onChange={() => basculerDomaine(domaine.id)}
                        className="size-4 rounded border-bordure accent-primaire"
                      />
                      {domaine.nom}
                    </label>
                  ))}
                </div>
              )}

              {organisation.domainesDisponibles.length > 0 && (
                <Bouton
                  variante="principal"
                  taille="petite"
                  enChargement={enCours}
                  onClick={appliquerRangement}
                  className="mt-3 w-full justify-center"
                >
                  Ajouter aux domaines sélectionnés
                </Bouton>
              )}

              <button
                type="button"
                onClick={() => setCreationOuverte((valeur) => !valeur)}
                className="mt-3 flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-primaire hover:underline"
              >
                <IconePlus className="size-3.5" />
                Créer un domaine durable
              </button>

              {creationOuverte && (
                <div className="mt-2 rounded-lg border border-bordure bg-surface-2/50 p-3">
                  <label className="block">
                    <span className="text-xs font-medium text-texte">Nom du domaine</span>
                    <input
                      value={nomDomaine}
                      onChange={(event) => setNomDomaine(event.target.value)}
                      placeholder="Ex. Analyse économique"
                      className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none placeholder:text-texte-discret focus:border-primaire focus:ring-1 focus:ring-primaire/20"
                    />
                  </label>
                  <p className="mt-2 text-[0.6875rem] leading-relaxed text-texte-discret">
                    Les {codesValides.length} compétence{codesValides.length > 1 ? "s" : ""} sélectionnée{codesValides.length > 1 ? "s" : ""} y seront rattachées sans changer de code.
                  </p>
                  <Bouton
                    variante="principal"
                    taille="petite"
                    enChargement={enCours}
                    onClick={creerDomaine}
                    className="mt-3 w-full justify-center"
                  >
                    Créer et rattacher
                  </Bouton>
                </div>
              )}
            </div>
          </div>

          {erreur && (
            <BandeauInfo ton="danger" taille="compacte" className="mt-4">
              {erreur}
            </BandeauInfo>
          )}
        </div>
      )}
    </section>
  );
}
