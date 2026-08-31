"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Bouton, Etiquette } from "@/components/ui/primitives";
import {
  IconeCalendrier,
  IconeChevronDroit,
  IconeCours,
  IconeDocuments,
  IconePlus,
  IconePreuve,
  IconeRecherche,
} from "@/components/ui/icones";
import { BoutonEcheance } from "@/components/dashboard/bouton-echeance";
import { BoutonReviser } from "@/components/referentiel/bouton-reviser";
import { CompetencesMisesDeCote } from "@/components/referentiel/competences-mises-de-cote";
import { ModaleCompetence } from "@/components/referentiel/modale-competence";
import { ModaleUsageDomaine } from "@/components/referentiel/modale-usage-domaine";
import { libelleCompte } from "@/lib/domain/engagement";
import { motifsNonAtomique } from "@/lib/domain/atomicite";
import {
  libelleEffetIntervention,
  renduPourIntervention,
} from "@/lib/domain/intervention-rendus";
import { usageDuDomaine } from "@/lib/domain/usage-domaine";
import type {
  VueAClasserAtelier,
  VueDomaineAtelier,
} from "@/lib/documents/vue-atelier";
import type { PreparationState } from "@/lib/engine/planification-temporelle";
import { restaurerDomaine } from "@/lib/store/referentiel-actions";
import { ClassementDomaine } from "./classement-domaine";
import { dateCourte, LIBELLES_REPERES } from "./elements-fiche";
import { ParenteDomaine } from "./parente-domaine";

const LIBELLES_PREPARATION: Record<PreparationState, string> = {
  "non-estimable": "Non estimable",
  "a-eclaircir": "À éclaircir",
  "a-renforcer": "À renforcer",
  "en-bonne-voie": "En bonne voie",
  "pret-d-apres-les-preuves-disponibles": "Prêt d'après les preuves disponibles",
};

function libelleTypeRessource(type: string | null): string {
  if (type === "cours") return "Cours";
  if (type === "note") return "Note";
  if (type === "definition") return "Définition";
  if (type === "exercice") return "Exercice";
  return "Ressource";
}

const LIBELLES_RESULTAT = {
  reussi: "Réussi",
  partiel: "Partiel",
  echec: "À reprendre",
} as const;

const TONS_RESULTAT = {
  reussi: "succes",
  partiel: "alerte",
  echec: "danger",
} as const;

function libelleTypeTravail(type: VueDomaineAtelier["travailRealise"][number]["type"]): string {
  if (type === "etude-de-cas") return "Étude de cas";
  if (type === "correction-erreur") return "Correction";
  if (type === "multiple") return "Travail évalué";
  return type.charAt(0).toLocaleUpperCase("fr") + type.slice(1);
}

export function VueDomaine({
  vue,
  ouvrirElement,
  compteId,
  onRestaurerDomaine,
  domainesExistants = [],
  aClasser = [],
}: {
  vue: VueDomaineAtelier;
  ouvrirElement: (id: string) => void;
  compteId: string;
  onRestaurerDomaine?: (domaineId: string) => void;
  domainesExistants?: { id: string; nom: string; prefixe: string }[];
  aClasser?: VueAClasserAtelier[];
}) {
  const router = useRouter();
  const [restaurationEnCours, demarrerRestauration] = useTransition();
  const [ajoutCompetenceOuvert, setAjoutCompetenceOuvert] = useState(false);
  const [usageOuvert, setUsageOuvert] = useState(false);
  const [menuAjoutOuvert, setMenuAjoutOuvert] = useState(false);
  const [competencesOuvertes, setCompetencesOuvertes] = useState(false);
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  const [rechercheCompetence, setRechercheCompetence] = useState("");
  const usage = usageDuDomaine(vue.domaine);
  const estModule = usage.type === "module";
  const moduleActif = estModule && !usage.module.closLe && !vue.domaine.archive;
  const termeCompetence = rechercheCompetence.trim().toLocaleLowerCase("fr");
  const competencesFiltrees = useMemo(
    () =>
      vue.competences.filter((competence) =>
        `${competence.titre} ${competence.code}`
          .toLocaleLowerCase("fr")
          .includes(termeCompetence),
      ),
    [termeCompetence, vue.competences],
  );
  const competencesAClasser = aClasser.filter(
    (competence) => competence.domaineCreationNom === vue.nom,
  );
  const prochaineSeance =
    vue.orchestrationModule.thisWeek.find((session) => session.status === "en-cours")
    ?? vue.orchestrationModule.thisWeek[0];
  const prochaineEcheance =
    vue.orchestrationModule.deadlines.find((deadline) => deadline.daysRemaining >= 0)
    ?? vue.orchestrationModule.deadlines[0];
  const derniereRessource = vue.ressources[0];
  const travailVisible = historiqueOuvert ? vue.travailRealise : vue.travailRealise.slice(0, 4);
  const nombreElementsTravail =
    vue.orchestrationModule.thisWeek.length + vue.ressources.length + vue.travailRealise.length;
  const misesDeCote = vue.skills
    .filter((skill) => skill.archive)
    .map((skill) => ({ code: skill.code, intitule: skill.intitule }));
  const competencesRevisables = vue.skills
    .filter((skill) => !skill.archive)
    .map((skill) => ({
      code: skill.code,
      intitule: skill.intitule,
      palier: skill.palier,
      observations: vue.retraits[skill.code]?.observations ?? 0,
      modeRetrait: vue.retraits[skill.code]?.mode ?? ("suppression" as const),
      reformulationManuelleRequise: motifsNonAtomique(skill.intitule).length > 0,
    }));

  function deposerCours() {
    setMenuAjoutOuvert(false);
    router.push(`/atelier?creation=cours&domaine=${encodeURIComponent(vue.domaine.id)}`);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-surface">
      <header className="border-b border-bordure px-5 py-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="font-serif text-2xl font-medium tracking-tight text-texte lg:text-[2rem]">
                {vue.nom}
              </h2>
              {vue.domaine.archive ? (
                <Etiquette ton="neutre">Mis de côté</Etiquette>
              ) : estModule ? (
                <Etiquette ton="primaire">
                  {usage.module.closLe ? "Module clôturé" : "Module en cours"}
                </Etiquette>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-texte-discret">
              {estModule && <span>{usage.module.anneeAcademique}</span>}
              {estModule && usage.module.periode && <span>· {usage.module.periode}</span>}
              {!estModule && <span>{vue.description || "Domaine de compétences"}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!vue.domaine.archive && compteId && (
              <>
                <Bouton variante="secondaire" taille="normale" onClick={() => setUsageOuvert(true)}>
                  {usage.type === "indetermine" ? "Préciser le cadre" : "Modifier le cadre"}
                </Bouton>
                <div className="relative">
                  <Bouton
                    variante="principal"
                    taille="normale"
                    onClick={() => setMenuAjoutOuvert((ouvert) => !ouvert)}
                    aria-expanded={menuAjoutOuvert}
                  >
                    <IconePlus className="size-4" />
                    Ajouter
                  </Bouton>
                  {menuAjoutOuvert && (
                    <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-bordure bg-surface p-1.5 shadow-[var(--ombre-levee)]">
                      {estModule && (
                        <button
                          type="button"
                          onClick={deposerCours}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-texte hover:bg-surface-2"
                        >
                          <IconeCours className="size-4 text-primaire" />
                          Déposer un cours
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setMenuAjoutOuvert(false);
                          setAjoutCompetenceOuvert(true);
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-texte hover:bg-surface-2"
                      >
                        <IconeDocuments className="size-4 text-primaire" />
                        Ajouter une compétence
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            {vue.domaine.archive && (
              <Bouton
                variante="principal"
                taille="normale"
                enChargement={restaurationEnCours}
                disabled={restaurationEnCours}
                onClick={() => {
                  demarrerRestauration(async () => {
                    onRestaurerDomaine?.(vue.domaine.id);
                    await restaurerDomaine(vue.domaine.id);
                    router.refresh();
                  });
                }}
              >
                Reprendre ce domaine
              </Bouton>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-8 px-5 py-6 lg:px-8 lg:py-7">
        {moduleActif && (
          <section>
            <h3 className="font-serif text-xl font-medium text-texte">Maintenant</h3>
            <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-primaire/20 bg-primaire-faible/15 px-4 py-4 sm:px-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-full border border-primaire/20 bg-surface text-primaire">
                {prochaineSeance ? <IconeCalendrier className="size-5" /> : <IconeCours className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-lg font-medium text-texte">
                  {prochaineSeance?.interventionLabel
                    ?? (derniereRessource ? `Reprendre ${derniereRessource.titre}` : "Commencer ce module")}
                </p>
                <p className="mt-0.5 text-xs text-texte-attenue">
                  {prochaineSeance
                    ? `${dateCourte(prochaineSeance.plannedFor)}${prochaineSeance.durationMinutes ? ` · ${prochaineSeance.durationMinutes} min` : ""}`
                    : prochaineEcheance
                      ? `${prochaineEcheance.label} · ${libelleCompte(prochaineEcheance.daysRemaining)}`
                      : derniereRessource
                        ? "Dernier contenu du module"
                        : "Déposez un premier cours pour commencer à travailler."}
                </p>
              </div>
              <Bouton
                variante="principal"
                taille="normale"
                onClick={() => {
                  if (prochaineSeance) {
                    router.push(`/seances?session=${encodeURIComponent(prochaineSeance.sessionId)}`);
                  } else if (derniereRessource) {
                    ouvrirElement(derniereRessource.documentId);
                  } else {
                    deposerCours();
                  }
                }}
              >
                {prochaineSeance ? "Ouvrir" : derniereRessource ? "Reprendre" : "Déposer un cours"}
              </Bouton>
            </div>
          </section>
        )}

        <div className={estModule ? "grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]" : "space-y-8"}>
          <section className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-serif text-xl font-medium text-texte">
                {estModule ? "Travail du module" : "Travail du domaine"}
              </h3>
              <span className="text-xs text-texte-discret">
                {nombreElementsTravail} élément{nombreElementsTravail > 1 ? "s" : ""}
              </span>
            </div>

            {nombreElementsTravail === 0 ? (
              <div className="mt-3 border-y border-bordure py-8 text-center">
                <p className="text-sm text-texte-attenue">Aucun contenu, séance ni travail observé pour l’instant.</p>
                {moduleActif && (
                  <button type="button" onClick={deposerCours} className="mt-2 cursor-pointer text-sm font-semibold text-primaire hover:underline">
                    Déposer le premier cours
                  </button>
                )}
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-bordure border-y border-bordure">
                {vue.orchestrationModule.thisWeek.map((session) => (
                  <li key={session.sessionId}>
                    <button
                      type="button"
                      onClick={() => router.push(`/seances?session=${encodeURIComponent(session.sessionId)}`)}
                      className="group flex w-full cursor-pointer items-center gap-3 py-3.5 text-left"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-bordure text-texte-attenue">
                        <IconeCalendrier className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-texte-discret">Séance</span>
                        <span className="block truncate text-sm font-medium text-texte group-hover:text-primaire">
                          {session.interventionLabel ?? "Intervention à préciser"}
                        </span>
                        <span className="mt-0.5 block text-xs text-texte-discret">
                          {session.interventionType && session.expectedEffect
                            ? `${renduPourIntervention({ type: session.interventionType }).label} · ${libelleEffetIntervention(session.expectedEffect)}`
                            : session.reservations[0]}
                        </span>
                      </span>
                      <Etiquette ton={session.status === "en-cours" ? "primaire" : "neutre"}>
                        {session.status === "en-cours" ? "En cours" : dateCourte(session.plannedFor)}
                      </Etiquette>
                      <IconeChevronDroit className="size-4 shrink-0 text-texte-discret group-hover:text-primaire" />
                    </button>
                  </li>
                ))}
                {travailVisible.map((travail) => (
                  <li key={travail.id}>
                    <button
                      type="button"
                      onClick={() => ouvrirElement(travail.documentId ?? travail.competences[0].code)}
                      className="group flex w-full cursor-pointer items-center gap-3 py-3.5 text-left"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-bordure text-texte-attenue">
                        <IconePreuve className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-texte-discret">
                          {libelleTypeTravail(travail.type)} · {dateCourte(travail.date)}
                        </span>
                        <span className="block truncate text-sm font-medium text-texte group-hover:text-primaire">
                          {travail.titre}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-texte-discret">
                          {travail.competences.map((competence) => competence.titre).join(" · ")}
                        </span>
                      </span>
                      {travail.resultat && (
                        <Etiquette ton={TONS_RESULTAT[travail.resultat]}>
                          {LIBELLES_RESULTAT[travail.resultat]}
                        </Etiquette>
                      )}
                      <IconeChevronDroit className="size-4 shrink-0 text-texte-discret group-hover:text-primaire" />
                    </button>
                  </li>
                ))}
                {vue.ressources.map((ressource) => (
                  <li key={ressource.documentId}>
                    <button
                      type="button"
                      onClick={() => ouvrirElement(ressource.documentId)}
                      className="group flex w-full cursor-pointer items-center gap-3 py-3.5 text-left"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-bordure text-texte-attenue">
                        <IconeCours className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-texte-discret">
                          {libelleTypeRessource(ressource.type)}
                        </span>
                        <span className="block truncate text-sm font-medium text-texte group-hover:text-primaire">
                          {ressource.titre}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-xs text-texte-discret sm:block">
                        {ressource.derniereActivite ? dateCourte(ressource.derniereActivite) : "Jamais mobilisée"}
                      </span>
                      <IconeChevronDroit className="size-4 shrink-0 text-texte-discret group-hover:text-primaire" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {vue.travailRealise.length > 4 && (
              <button
                type="button"
                onClick={() => setHistoriqueOuvert((ouvert) => !ouvert)}
                className="mt-3 cursor-pointer text-sm font-semibold text-primaire hover:underline"
              >
                {historiqueOuvert
                  ? "Réduire l’historique"
                  : `Voir les ${vue.travailRealise.length} travaux réalisés`}
              </button>
            )}
          </section>

          {estModule && (
            <aside className="min-w-0 border-t border-bordure pt-6 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-serif text-xl font-medium text-texte">Repères</h3>
                {!vue.domaine.archive && (
                  <BoutonEcheance
                    competences={vue.skills.filter((skill) => !skill.archive).map(({ code, intitule }) => ({ code, intitule }))}
                    modules={vue.domainesExistants.map(({ id, nom }) => ({ id, nom }))}
                    initial={{ moduleDomaineId: vue.domaine.id }}
                    libelle="Ajouter"
                  />
                )}
              </div>
              {vue.orchestrationModule.deadlines.length === 0 ? (
                <p className="mt-4 text-sm leading-relaxed text-texte-discret">Aucune échéance déclarée pour ce module.</p>
              ) : (
                <ul className="mt-3 divide-y divide-bordure">
                  {vue.orchestrationModule.deadlines.slice(0, 3).map((deadline) => (
                    <li key={deadline.id} className="py-3">
                      <div className="flex gap-3">
                        <IconeCalendrier className="mt-0.5 size-4 shrink-0 text-primaire" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-texte">{deadline.label}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texte-discret">
                            <span>{libelleCompte(deadline.daysRemaining)}</span>
                            <span>·</span>
                            <span>{LIBELLES_PREPARATION[deadline.preparation]}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {competencesAClasser.length > 0 && (
                <button
                  type="button"
                  onClick={() => router.push("/atelier")}
                  className="mt-5 flex w-full cursor-pointer items-center gap-3 rounded-xl border border-primaire/20 bg-primaire-faible/15 px-3.5 py-3 text-left transition-colors hover:bg-primaire-faible/30"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primaire text-sm font-semibold text-texte-inverse">
                    {competencesAClasser.length}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-texte">
                    compétence{competencesAClasser.length > 1 ? "s" : ""} à organiser
                  </span>
                  <IconeChevronDroit className="size-4 shrink-0 text-primaire" />
                </button>
              )}
            </aside>
          )}
        </div>

        <section className="rounded-xl border border-bordure">
          <button
            type="button"
            onClick={() => setCompetencesOuvertes((ouvertes) => !ouvertes)}
            aria-expanded={competencesOuvertes}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left sm:px-5"
          >
            <IconeDocuments className="size-5 shrink-0 text-primaire" />
            <span className="min-w-0 flex-1 font-serif text-lg font-medium text-texte">
              Compétences {estModule ? "du module" : "du domaine"}
              <span className="ml-2 font-sans text-sm font-normal text-texte-discret">{vue.competences.length}</span>
            </span>
            <span className="text-xs font-medium text-texte-attenue">{competencesOuvertes ? "Réduire" : "Voir les compétences"}</span>
            <IconeChevronDroit className={`size-4 shrink-0 text-texte-discret transition-transform ${competencesOuvertes ? "rotate-90" : ""}`} />
          </button>

          {competencesOuvertes && (
            <div className="border-t border-bordure px-4 pb-4 sm:px-5">
              <label className="mt-3 flex items-center gap-2 rounded-lg border border-bordure bg-surface-2/50 px-3 py-2 text-sm text-texte-attenue">
                <IconeRecherche className="size-4 shrink-0 text-texte-discret" />
                <span className="sr-only">Rechercher une compétence</span>
                <input
                  type="search"
                  value={rechercheCompetence}
                  onChange={(event) => setRechercheCompetence(event.target.value)}
                  placeholder="Rechercher une compétence…"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-texte-discret"
                />
              </label>
              <ul className="mt-2 divide-y divide-bordure">
                {competencesFiltrees.map((competence) => (
                  <li key={competence.code}>
                    <button
                      type="button"
                      onClick={() => ouvrirElement(competence.code)}
                      className="group flex w-full cursor-pointer items-center gap-3 py-3 text-left"
                    >
                      <span className="chiffres w-14 shrink-0 text-xs text-texte-discret">{competence.code}</span>
                      <span className="min-w-0 flex-1 text-sm font-medium text-texte group-hover:text-primaire">{competence.titre}</span>
                      <span className="hidden text-xs text-texte-discret sm:block">
                        {competence.niveau === null ? "À découvrir" : LIBELLES_REPERES[competence.confiance]}
                      </span>
                      <IconeChevronDroit className="size-4 shrink-0 text-texte-discret group-hover:text-primaire" />
                    </button>
                  </li>
                ))}
              </ul>
              {competencesFiltrees.length === 0 && (
                <p className="py-6 text-center text-sm text-texte-discret">Aucune compétence ne correspond à cette recherche.</p>
              )}
              {!vue.domaine.archive && <CompetencesMisesDeCote competences={misesDeCote} />}
            </div>
          )}
        </section>

        <details className="group rounded-xl border border-bordure bg-surface-2/30">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-texte-attenue sm:px-5">
            Organisation du domaine
            <IconeChevronDroit className="size-4 transition-transform group-open:rotate-90" />
          </summary>
          <div className="space-y-4 border-t border-bordure p-4 sm:p-5">
            <ClassementDomaine
              domaineId={vue.domaine.id}
              compteId={compteId}
              rattachement={vue.rattachementCarte}
              classification={vue.classificationCarte}
              modifiable={!vue.domaine.archive && Boolean(compteId)}
            />
            <ParenteDomaine
              domaineId={vue.domaine.id}
              chemin={vue.chemin}
              enfants={vue.enfants}
              destinations={vue.parentsPossibles}
              modifiable={!vue.domaine.archive}
              ouvrirDomaine={(id) => ouvrirElement(`domaine:${id}`)}
            />
            {!vue.domaine.archive && compteId && (
              <BoutonReviser
                domaineId={vue.domaine.id}
                domaineNom={vue.domaine.nom}
                competences={competencesRevisables}
                compteId={compteId}
              />
            )}
          </div>
        </details>
      </div>

      {ajoutCompetenceOuvert && compteId && (
        <ModaleCompetence
          compteId={compteId}
          domainesExistants={domainesExistants}
          modeCible="competence"
          domaineInitial={vue.domaine.id}
          onFermer={() => setAjoutCompetenceOuvert(false)}
        />
      )}
      {usageOuvert && !vue.domaine.archive && (
        <ModaleUsageDomaine
          domaineId={vue.domaine.id}
          domaineNom={vue.domaine.nom}
          usageInitial={usage}
          onFermer={() => setUsageOuvert(false)}
          onEnregistre={() => router.refresh()}
        />
      )}
    </div>
  );
}
